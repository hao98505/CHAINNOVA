// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title HolderDividend  v2
 * @notice Phase 1 holder dividend contract — time-weighted batch settlement model.
 *
 * ── Mechanism ────────────────────────────────────────────────────────────────
 *   • Holders with ≥ minimumBalance CNOVA call register().
 *     Balance is snapshotted as registeredBalance; timer starts (weightedStartTs = now).
 *
 *   • BNB arrives from TaxReceiver via notifyReward(). At that moment:
 *       1. Total weight = Σ(balance_i × elapsed_i) over all registered users.
 *       2. A Settlement record is stored: { bnbAmount, totalWeight, settledAt }.
 *       3. Any previously forfeited BNB is swept into this settlement.
 *
 *   • Users call claim() at any time. For each unclaimed settlement:
 *       userShare = (userBalance × (settlement.settledAt − user.weightedStartTs))
 *                  / settlement.totalWeight × settlement.bnbAmount
 *     Claiming does NOT reset weightedStartTs.
 *
 *   • Top-up (buy more):
 *       Keeper calls updateBalance(user). Contract reads token.balanceOf(user).
 *       If balance increased: weightedStartTs slides forward via weighted average
 *       (new tokens dilute the clock, but old tokens keep their full elapsed time).
 *       registeredBalance is updated; nextSettlementIdx unchanged.
 *
 *   • Sell detection (permissionless keeper):
 *       Keeper calls updateBalance(user) whenever it sees an outgoing Transfer.
 *       If token.balanceOf(user) < registeredBalance → _invalidate:
 *         - User is removed from the pool.
 *         - Their share of all unclaimed past settlements is forfeited → forfeitedPool.
 *         - forfeitedPool is swept into the NEXT settlement automatically.
 *
 * ── Sell invalidation model ───────────────────────────────────────────────────
 *   NOT a token hook (CNOVA contract is unmodified).
 *   INSTEAD: off-chain keeper (server/dividend-keeper.ts) watches ERC-20 Transfer
 *   events on BSC and calls updateBalance(from) for any registered user.
 *   updateBalance is PERMISSIONLESS — anyone can call for any address.
 *   No onlyOwner forceDeregister as main flow.
 *
 * ── Deployment order ──────────────────────────────────────────────────────────
 *   1. Deploy HolderDividend (CNOVA address, minimumBalance, owner)
 *   2. Deploy TaxReceiver (HolderDividend address, marketingWallet, owner)
 *   3. HolderDividend.setTaxReceiver(TaxReceiver address)
 *   4. After token graduates: set TaxReceiver as token tax address
 *   5. Call TaxReceiver.flush() periodically to trigger settlements
 */
contract HolderDividend is Ownable, ReentrancyGuard {

    IERC20 public immutable token;
    uint256 public minimumBalance;
    address public taxReceiver;

    // ─── Settlement records ──────────────────────────────────────────────────
    struct Settlement {
        uint256 bnbAmount;     // total BNB available in this settlement (incl. forfeitures)
        uint256 totalWeight;   // Σ(balance_i × elapsed_i) at settledAt
        uint256 settledAt;     // block.timestamp when settlement was created
    }

    Settlement[] public settlements;

    /// @notice BNB forfeited by invalidated users — swept into next settlement
    uint256 public forfeitedPool;

    // ─── User state ──────────────────────────────────────────────────────────
    struct UserInfo {
        uint256 registeredBalance;  // CNOVA tracked by contract (updated on top-up)
        uint256 weightedStartTs;    // effective holding start time (weighted avg on top-up)
        uint256 nextSettlementIdx;  // index of next settlement to claim (0 = from beginning)
        uint256 totalClaimed;       // lifetime BNB claimed by this user
        uint256 registeredAt;       // original registration timestamp
        bool    registered;
    }

    mapping(address => UserInfo) public users;

    /// @notice Full list of addresses that have ever registered.
    ///         Used by off-chain keeper for enumeration. May contain invalidated users.
    address[] public registeredList;

    // ─── Global totals ───────────────────────────────────────────────────────
    uint256 public totalRegisteredBalance;  // sum of all active registeredBalance values
    uint256 public totalReceived;           // all BNB ever received
    uint256 public totalClaimedGlobal;      // all BNB ever paid out

    // ─── Events ──────────────────────────────────────────────────────────────
    event Registered(address indexed user, uint256 balance);
    event BalanceUpdated(address indexed user, uint256 oldBalance, uint256 newBalance, uint256 newWeightedStartTs);
    event Invalidated(address indexed user, uint256 forfeitedBnb);
    event BatchSettled(uint256 indexed idx, uint256 bnbAmount, uint256 totalWeight, uint256 settledAt);
    event Claimed(address indexed user, uint256 amount, uint256 nextIdx);
    event TaxReceiverUpdated(address indexed prev, address indexed next);
    event MinimumBalanceUpdated(uint256 prev, uint256 next);

    // ─── Errors ──────────────────────────────────────────────────────────────
    error AlreadyRegistered();
    error NotRegistered();
    error InsufficientBalance(uint256 have, uint256 need);
    error NothingToClaim();
    error TransferFailed();
    error ZeroAddress();

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @param _token          CNOVA ERC-20 address (BSC mainnet: 0x0a9c...7777)
     * @param _minimumBalance Minimum CNOVA to register, in wei (e.g. 200_000 * 1e18)
     * @param _owner          Contract owner (multisig recommended)
     */
    constructor(
        address _token,
        uint256 _minimumBalance,
        address _owner
    ) Ownable(_owner) {
        if (_token == address(0)) revert ZeroAddress();
        token = IERC20(_token);
        minimumBalance = _minimumBalance;
    }

    // ─── BNB inflow ──────────────────────────────────────────────────────────

    /**
     * @notice Receive BNB. Incoming BNB waits in contract until notifyReward() creates a settlement.
     */
    receive() external payable {
        totalReceived += msg.value;
    }

    /**
     * @notice Called by TaxReceiver (or any sender) to trigger a settlement.
     *         Sweeps ALL available BNB (msg.value + forfeitedPool) into one settlement.
     *         If no users are registered yet, BNB stays in forfeitedPool for the next call.
     */
    function notifyReward() external payable {
        totalReceived += msg.value;
        uint256 bnbToSettle = msg.value + forfeitedPool;

        if (bnbToSettle == 0) return;

        uint256 tw = _computeTotalWeight();

        if (tw == 0) {
            // No registered users with elapsed time; keep BNB for next settlement
            forfeitedPool = bnbToSettle;
            return;
        }

        forfeitedPool = 0;

        uint256 idx = settlements.length;
        settlements.push(Settlement({
            bnbAmount:   bnbToSettle,
            totalWeight: tw,
            settledAt:   block.timestamp
        }));

        emit BatchSettled(idx, bnbToSettle, tw, block.timestamp);
    }

    // ─── Registration ────────────────────────────────────────────────────────

    /**
     * @notice Join the dividend pool.
     *         Caller must hold ≥ minimumBalance CNOVA at call time.
     *         Timer starts from this block. Eligible from the NEXT settlement onward.
     */
    function register() external nonReentrant {
        if (users[msg.sender].registered) revert AlreadyRegistered();

        uint256 bal = token.balanceOf(msg.sender);
        if (bal < minimumBalance) revert InsufficientBalance(bal, minimumBalance);

        users[msg.sender] = UserInfo({
            registeredBalance:  bal,
            weightedStartTs:    block.timestamp,
            nextSettlementIdx:  settlements.length, // only claims future settlements
            totalClaimed:       0,
            registeredAt:       block.timestamp,
            registered:         true
        });

        totalRegisteredBalance += bal;
        registeredList.push(msg.sender);

        emit Registered(msg.sender, bal);
    }

    // ─── Balance update (permissionless — keeper calls this) ─────────────────

    /**
     * @notice Sync a registered user's balance against the live token.balanceOf().
     *         Anyone may call for any address. This is how sell-detection works.
     *
     *   token.balanceOf(user) < registeredBalance  →  sold tokens → invalidate
     *   token.balanceOf(user) > registeredBalance  →  bought more → top-up (weighted avg start)
     *   token.balanceOf(user) == registeredBalance →  no-op
     */
    function updateBalance(address user) external nonReentrant {
        UserInfo storage u = users[user];
        if (!u.registered) return;

        uint256 live = token.balanceOf(user);

        if (live < u.registeredBalance) {
            // Any decrease = disqualify immediately
            _invalidate(user, u);
            return;
        }

        if (live > u.registeredBalance) {
            // Top-up: slide the effective start forward via weighted average.
            // Old tokens keep their elapsed time; new tokens start fresh.
            uint256 old    = u.registeredBalance;
            uint256 added  = live - old;
            uint256 now_   = block.timestamp;

            // weightedStart = (old × oldStart + added × now) / live
            uint256 newStart = (old * u.weightedStartTs + added * now_) / live;

            totalRegisteredBalance = totalRegisteredBalance - old + live;
            u.registeredBalance  = live;
            u.weightedStartTs    = newStart;

            emit BalanceUpdated(user, old, live, newStart);
        }
        // Equal → no-op (gas-efficient)
    }

    // ─── Claim ───────────────────────────────────────────────────────────────

    /**
     * @notice Claim all pending BNB from past settlements.
     *         Does NOT reset weightedStartTs — timer keeps running.
     */
    function claim() external nonReentrant {
        UserInfo storage u = users[msg.sender];
        if (!u.registered) revert NotRegistered();

        uint256 payout = _computePending(u);
        if (payout == 0) revert NothingToClaim();

        uint256 newIdx = settlements.length;
        u.nextSettlementIdx = newIdx;
        u.totalClaimed      += payout;
        totalClaimedGlobal  += payout;

        _transferBnb(msg.sender, payout);
        emit Claimed(msg.sender, payout, newIdx);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    /**
     * @notice Pending BNB claimable by a user.
     */
    function pendingReward(address user) external view returns (uint256) {
        UserInfo storage u = users[user];
        if (!u.registered) return 0;
        return _computePending(u);
    }

    /**
     * @notice A user's current weight in weight-seconds (balance × elapsed seconds).
     */
    function currentWeight(address user) external view returns (uint256) {
        UserInfo storage u = users[user];
        if (!u.registered) return 0;
        uint256 elapsed = block.timestamp > u.weightedStartTs
            ? block.timestamp - u.weightedStartTs : 0;
        return u.registeredBalance * elapsed;
    }

    /**
     * @notice Total weight of all registered users right now.
     */
    function totalCurrentWeight() external view returns (uint256) {
        return _computeTotalWeight();
    }

    /**
     * @notice A user's weight share as (numerator, denominator).
     *         Share % = numerator * 100 / denominator.
     */
    function userWeightShare(address user)
        external
        view
        returns (uint256 numerator, uint256 denominator)
    {
        UserInfo storage u = users[user];
        if (!u.registered) return (0, 1);
        uint256 elapsed = block.timestamp > u.weightedStartTs
            ? block.timestamp - u.weightedStartTs : 0;
        uint256 uw = u.registeredBalance * elapsed;
        uint256 tw = _computeTotalWeight();
        return (uw, tw == 0 ? 1 : tw);
    }

    /**
     * @notice Full user state — for frontend display.
     * @return registered         true if in the pool
     * @return registeredBalance  snapshotted CNOVA balance
     * @return weightedStartTs    effective holding start timestamp
     * @return holdingSeconds     seconds since weightedStartTs
     * @return registeredAt       original registration timestamp
     * @return nextSettlementIdx  next settlement to claim
     * @return userTotalClaimed   lifetime BNB claimed
     * @return pendingBnb         claimable right now
     */
    function userInfo(address user)
        external
        view
        returns (
            bool     registered,
            uint256  registeredBalance,
            uint256  weightedStartTs,
            uint256  holdingSeconds,
            uint256  registeredAt,
            uint256  nextSettlementIdx,
            uint256  userTotalClaimed,
            uint256  pendingBnb
        )
    {
        UserInfo storage u = users[user];
        uint256 elapsed = (u.registered && block.timestamp > u.weightedStartTs)
            ? block.timestamp - u.weightedStartTs : 0;
        return (
            u.registered,
            u.registeredBalance,
            u.weightedStartTs,
            elapsed,
            u.registeredAt,
            u.nextSettlementIdx,
            u.totalClaimed,
            u.registered ? _computePending(u) : 0
        );
    }

    /**
     * @notice Number of settlements created so far.
     */
    function settlementCount() external view returns (uint256) {
        return settlements.length;
    }

    /**
     * @notice Number of currently registered (active) users.
     */
    function activeRegisteredCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < registeredList.length; i++) {
            if (users[registeredList[i]].registered) count++;
        }
        return count;
    }

    // ─── Owner config ────────────────────────────────────────────────────────

    function setTaxReceiver(address _taxReceiver) external onlyOwner {
        emit TaxReceiverUpdated(taxReceiver, _taxReceiver);
        taxReceiver = _taxReceiver;
    }

    function setMinimumBalance(uint256 _minimumBalance) external onlyOwner {
        emit MinimumBalanceUpdated(minimumBalance, _minimumBalance);
        minimumBalance = _minimumBalance;
    }

    /**
     * @notice Emergency rescue: withdraw all BNB to owner.
     *         Only for catastrophic scenarios (e.g. contract bug found).
     */
    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        if (bal == 0) revert NothingToClaim();
        (bool ok, ) = owner().call{value: bal}("");
        if (!ok) revert TransferFailed();
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    /**
     * @dev Compute pending BNB for a user across all unclaimed settlements.
     *      For each settlement i ≥ user.nextSettlementIdx:
     *        - If settlement.settledAt ≤ user.weightedStartTs: user wasn't registered → 0
     *        - Else: user's share = (balance × elapsed) / totalWeight × bnbAmount
     */
    function _computePending(UserInfo storage u) internal view returns (uint256) {
        uint256 payout = 0;
        uint256 len    = settlements.length;

        for (uint256 i = u.nextSettlementIdx; i < len; i++) {
            Settlement memory s = settlements[i];

            if (s.settledAt <= u.weightedStartTs) continue; // user wasn't registered yet

            uint256 elapsed = s.settledAt - u.weightedStartTs;
            uint256 userW   = u.registeredBalance * elapsed;

            if (s.totalWeight > 0 && userW > 0) {
                payout += (userW * s.bnbAmount) / s.totalWeight;
            }
        }

        return payout;
    }

    /**
     * @dev Compute the sum of (balance × elapsed) for all active registered users.
     *      O(n) — acceptable for Phase 1 with small user count.
     *      Called once per settlement; NOT called on claim/register/updateBalance.
     */
    function _computeTotalWeight() internal view returns (uint256) {
        uint256 total = 0;
        uint256 now_  = block.timestamp;
        uint256 len   = registeredList.length;

        for (uint256 i = 0; i < len; i++) {
            address addr = registeredList[i];
            UserInfo storage u = users[addr];
            if (!u.registered) continue;
            uint256 elapsed = now_ > u.weightedStartTs ? now_ - u.weightedStartTs : 0;
            total += u.registeredBalance * elapsed;
        }

        return total;
    }

    /**
     * @dev Invalidate a user: compute their forfeited pending, add to forfeitedPool,
     *      remove from pool. The forfeited BNB is swept into the next settlement.
     */
    function _invalidate(address user, UserInfo storage u) internal {
        uint256 forfeited = _computePending(u);
        if (forfeited > 0) {
            forfeitedPool += forfeited;
        }

        totalRegisteredBalance -= u.registeredBalance;
        delete users[user];

        emit Invalidated(user, forfeited);
    }

    function _transferBnb(address to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
