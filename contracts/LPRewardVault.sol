// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title LPRewardVault
 * @notice Phase 1: deployed & accumulates BNB, staking NOT active until token graduates.
 *         Phase 2: owner calls activate(_lpToken) after DEX launch to enable staking.
 *
 * Frontend display:
 *   active == false  → "Deployed / Not Activated (Awaiting Graduation)"
 *   active == true   → LP staking & reward claim enabled
 *
 * Deploy order: deploy after HolderDividend & TaxReceiver.
 *   Constructor only needs owner address — no LP token required until graduation.
 */
contract LPRewardVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────────────────────
    IERC20 public lpToken;       // set by activate(); zero until graduation
    bool   public active;        // false until activate() is called

    uint256 public totalStaked;
    uint256 public accRewardPerShare;
    uint256 public pendingRewards;  // BNB queued while totalStaked == 0
    uint256 public totalReceived;
    uint256 public totalDistributed;
    uint256 public constant PRECISION = 1e18;

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    mapping(address => UserInfo) public userInfo;

    // ─── Events ───────────────────────────────────────────────────────────────
    event Activated(address indexed lpToken);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 reward);
    event RewardAdded(uint256 amount);
    event EmergencyWithdrawn(address indexed to, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error NotActive();
    error AlreadyActive();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientStake();
    error NothingToClaim();
    error TransferFailed();

    // ─── Constructor ─────────────────────────────────────────────────────────
    /**
     * @param _owner Deployer / multisig. LP token is set later via activate().
     */
    constructor(address _owner) Ownable(_owner) {
        active = false;
    }

    // ─── BNB receive ─────────────────────────────────────────────────────────
    receive() external payable {
        totalReceived += msg.value;
        if (totalStaked > 0) {
            uint256 total = msg.value + pendingRewards;
            pendingRewards = 0;
            accRewardPerShare += (total * PRECISION) / totalStaked;
        } else {
            pendingRewards += msg.value;
        }
        emit RewardAdded(msg.value);
    }

    fallback() external payable {
        totalReceived += msg.value;
        pendingRewards += msg.value;
        emit RewardAdded(msg.value);
    }

    // ─── Activation (Phase 2) ────────────────────────────────────────────────
    /**
     * @notice Owner activates LP staking after token graduates to DEX.
     * @param _lpToken PancakeSwap CNOVA/WBNB LP token address.
     */
    function activate(address _lpToken) external onlyOwner {
        if (active) revert AlreadyActive();
        if (_lpToken == address(0)) revert ZeroAddress();
        lpToken = IERC20(_lpToken);
        active  = true;
        emit Activated(_lpToken);
    }

    // ─── Staking (Phase 2 only) ───────────────────────────────────────────────
    function stake(uint256 _amount) external nonReentrant {
        if (!active) revert NotActive();
        if (_amount == 0) revert ZeroAmount();

        UserInfo storage u = userInfo[msg.sender];

        if (u.amount > 0) {
            uint256 pend = _pendingReward(u);
            if (pend > 0) {
                totalDistributed += pend;
                _safeTransferBNB(msg.sender, pend);
                emit Claimed(msg.sender, pend);
            }
        }

        lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        u.amount     += _amount;
        totalStaked  += _amount;

        // Absorb any pending BNB now that staked > 0
        if (pendingRewards > 0 && totalStaked > 0) {
            accRewardPerShare += (pendingRewards * PRECISION) / totalStaked;
            pendingRewards = 0;
        }

        u.rewardDebt = (u.amount * accRewardPerShare) / PRECISION;
        emit Staked(msg.sender, _amount);
    }

    function unstake(uint256 _amount) external nonReentrant {
        if (!active) revert NotActive();
        UserInfo storage u = userInfo[msg.sender];
        if (u.amount < _amount) revert InsufficientStake();
        if (_amount == 0) revert ZeroAmount();

        uint256 pend = _pendingReward(u);
        if (pend > 0) {
            totalDistributed += pend;
            _safeTransferBNB(msg.sender, pend);
            emit Claimed(msg.sender, pend);
        }

        u.amount    -= _amount;
        totalStaked -= _amount;
        u.rewardDebt = (u.amount * accRewardPerShare) / PRECISION;
        lpToken.safeTransfer(msg.sender, _amount);
        emit Unstaked(msg.sender, _amount);
    }

    function claim() external nonReentrant {
        if (!active) revert NotActive();
        UserInfo storage u = userInfo[msg.sender];
        uint256 pend = _pendingReward(u);
        if (pend == 0) revert NothingToClaim();
        totalDistributed += pend;
        u.rewardDebt = (u.amount * accRewardPerShare) / PRECISION;
        _safeTransferBNB(msg.sender, pend);
        emit Claimed(msg.sender, pend);
    }

    // ─── Views ────────────────────────────────────────────────────────────────
    function earned(address _user) external view returns (uint256) {
        return _pendingReward(userInfo[_user]);
    }

    function accumulatedBnb() external view returns (uint256) {
        return address(this).balance;
    }

    // ─── Emergency ────────────────────────────────────────────────────────────
    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        if (bal == 0) revert NothingToClaim();
        (bool ok, ) = owner().call{value: bal}("");
        if (!ok) revert TransferFailed();
        emit EmergencyWithdrawn(owner(), bal);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────
    function _pendingReward(UserInfo storage u) internal view returns (uint256) {
        if (u.amount == 0) return 0;
        return (u.amount * accRewardPerShare) / PRECISION - u.rewardDebt;
    }

    function _safeTransferBNB(address to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
