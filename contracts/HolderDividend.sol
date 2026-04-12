// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title HolderDividend
 * @notice Phase 1 holder dividend contract for CNOVA.
 *
 * Mechanism:
 *   1. Holders with ≥ minimumBalance CNOVA call register() to join the pool.
 *      Their balance is snapshotted at registration time (registeredBalance).
 *   2. BNB enters via receive() / notifyReward():
 *      accBnbPerShare increases proportionally to each holder's registeredBalance.
 *   3. Holders call claim() to withdraw earned BNB at any time.
 *
 * Notes:
 *   - registeredBalance is fixed at registration (simple, no gaming).
 *   - If a user sells below minimum after registering, they keep their accrued share
 *     but can be evicted by owner via forceDeregister() to keep the pool fair.
 *   - Phase 2: replace with dynamic balance tracking using snapshots.
 *
 * Deployment order:
 *   1. Deploy this contract (CNOVA address required).
 *   2. Deploy TaxReceiver (this contract's address required).
 *   3. Call setTaxReceiver(TaxReceiver address) here.
 */
contract HolderDividend is Ownable, ReentrancyGuard {

    IERC20 public immutable token;

    uint256 public minimumBalance;
    uint256 public constant PRECISION = 1e18;

    address public taxReceiver;

    uint256 public accBnbPerShare;
    uint256 public totalRegisteredSupply;

    uint256 public totalReceived;
    uint256 public totalClaimed;

    struct UserInfo {
        uint256 registeredBalance;
        uint256 rewardDebt;
        uint256 totalClaimed;
        uint256 registeredAt;
        bool registered;
    }

    mapping(address => UserInfo) public users;
    address[] public registeredList;

    // ─────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────

    event Registered(address indexed user, uint256 balance);
    event Deregistered(address indexed user);
    event Claimed(address indexed user, uint256 amount);
    event RewardReceived(address indexed sender, uint256 amount);
    event TaxReceiverUpdated(address indexed prev, address indexed next);
    event MinimumBalanceUpdated(uint256 prev, uint256 next);

    // ─────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────

    error AlreadyRegistered();
    error NotRegistered();
    error InsufficientBalance(uint256 have, uint256 need);
    error NothingToClaim();
    error TransferFailed();
    error ZeroAddress();
    error CallerNotTaxReceiver();

    // ─────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────

    /**
     * @param _token          CNOVA token address
     * @param _minimumBalance Minimum CNOVA balance required to register (in wei, e.g. 200_000 * 1e18)
     * @param _owner          Contract owner
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

    // ─────────────────────────────────────────
    // BNB Inflow
    // ─────────────────────────────────────────

    /**
     * @notice Receive BNB from TaxReceiver via low-level call.
     *         Also accepts direct BNB sends (e.g. manual top-up by owner).
     */
    receive() external payable {
        _addReward(msg.value);
    }

    /**
     * @notice Explicit notify — same as receive() but callable by anyone.
     *         TaxReceiver calls this via abi.encodeWithSignature("notifyReward()").
     */
    function notifyReward() external payable {
        _addReward(msg.value);
    }

    function _addReward(uint256 amount) internal {
        if (amount == 0) return;
        totalReceived += amount;

        if (totalRegisteredSupply > 0) {
            accBnbPerShare += (amount * PRECISION) / totalRegisteredSupply;
        }
        // If nobody is registered yet, BNB stays in contract.
        // First registrants will not get historical rewards — fair by design.

        emit RewardReceived(msg.sender, amount);
    }

    // ─────────────────────────────────────────
    // Registration
    // ─────────────────────────────────────────

    /**
     * @notice Register msg.sender into the dividend pool.
     *         Caller must hold ≥ minimumBalance CNOVA at call time.
     *         registeredBalance is snapshotted at this moment.
     */
    function register() external nonReentrant {
        if (users[msg.sender].registered) revert AlreadyRegistered();

        uint256 bal = token.balanceOf(msg.sender);
        if (bal < minimumBalance) revert InsufficientBalance(bal, minimumBalance);

        // Snapshot
        users[msg.sender] = UserInfo({
            registeredBalance: bal,
            rewardDebt: (bal * accBnbPerShare) / PRECISION,
            totalClaimed: 0,
            registeredAt: block.timestamp,
            registered: true
        });

        totalRegisteredSupply += bal;
        registeredList.push(msg.sender);

        emit Registered(msg.sender, bal);
    }

    /**
     * @notice Deregister self. Pending rewards are automatically claimed first.
     */
    function deregister() external nonReentrant {
        UserInfo storage u = users[msg.sender];
        if (!u.registered) revert NotRegistered();

        // Claim pending before removal
        uint256 pending = _pendingReward(u);
        if (pending > 0) {
            u.rewardDebt = (u.registeredBalance * accBnbPerShare) / PRECISION;
            u.totalClaimed += pending;
            totalClaimed += pending;
            _transferBnb(msg.sender, pending);
            emit Claimed(msg.sender, pending);
        }

        totalRegisteredSupply -= u.registeredBalance;
        delete users[msg.sender];
        emit Deregistered(msg.sender);
    }

    // ─────────────────────────────────────────
    // Claim
    // ─────────────────────────────────────────

    /**
     * @notice Claim all pending BNB dividends.
     */
    function claim() external nonReentrant {
        UserInfo storage u = users[msg.sender];
        if (!u.registered) revert NotRegistered();

        uint256 pending = _pendingReward(u);
        if (pending == 0) revert NothingToClaim();

        u.rewardDebt = (u.registeredBalance * accBnbPerShare) / PRECISION;
        u.totalClaimed += pending;
        totalClaimed += pending;

        _transferBnb(msg.sender, pending);
        emit Claimed(msg.sender, pending);
    }

    // ─────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────

    /**
     * @notice Returns claimable BNB for a registered user.
     */
    function pendingReward(address _user) external view returns (uint256) {
        UserInfo storage u = users[_user];
        if (!u.registered) return 0;
        return _pendingReward(u);
    }

    /**
     * @notice Returns full UserInfo struct for a given address.
     */
    function userInfo(address _user)
        external
        view
        returns (
            bool registered,
            uint256 registeredBalance,
            uint256 rewardDebt,
            uint256 totalClaimedByUser,
            uint256 registeredAt,
            uint256 pending
        )
    {
        UserInfo storage u = users[_user];
        return (
            u.registered,
            u.registeredBalance,
            u.rewardDebt,
            u.totalClaimed,
            u.registeredAt,
            u.registered ? _pendingReward(u) : 0
        );
    }

    /**
     * @notice Returns how many addresses are registered.
     */
    function registeredCount() external view returns (uint256) {
        return registeredList.length;
    }

    // ─────────────────────────────────────────
    // Owner
    // ─────────────────────────────────────────

    /**
     * @notice Set the TaxReceiver address (for documentation / access control purposes).
     *         Not strictly enforced in Phase 1 — any BNB sender is accepted.
     */
    function setTaxReceiver(address _taxReceiver) external onlyOwner {
        emit TaxReceiverUpdated(taxReceiver, _taxReceiver);
        taxReceiver = _taxReceiver;
    }

    /**
     * @notice Update the minimum holding threshold required to register.
     */
    function setMinimumBalance(uint256 _minimumBalance) external onlyOwner {
        emit MinimumBalanceUpdated(minimumBalance, _minimumBalance);
        minimumBalance = _minimumBalance;
    }

    /**
     * @notice Force-deregister a user who has sold below threshold (keeps pool clean).
     *         Pending rewards are sent to the user before removal.
     */
    function forceDeregister(address _user) external onlyOwner nonReentrant {
        UserInfo storage u = users[_user];
        if (!u.registered) revert NotRegistered();

        uint256 pending = _pendingReward(u);
        if (pending > 0) {
            u.totalClaimed += pending;
            totalClaimed += pending;
            _transferBnb(_user, pending);
            emit Claimed(_user, pending);
        }

        totalRegisteredSupply -= u.registeredBalance;
        delete users[_user];
        emit Deregistered(_user);
    }

    /**
     * @notice Emergency: withdraw all BNB to owner (only if something goes wrong).
     */
    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        if (bal == 0) revert NothingToClaim();
        (bool ok, ) = owner().call{value: bal}("");
        if (!ok) revert TransferFailed();
    }

    // ─────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────

    function _pendingReward(UserInfo storage u) internal view returns (uint256) {
        uint256 accumulated = (u.registeredBalance * accBnbPerShare) / PRECISION;
        return accumulated > u.rewardDebt ? accumulated - u.rewardDebt : 0;
    }

    function _transferBnb(address to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
