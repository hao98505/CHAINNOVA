// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LPRewardVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable lpToken;

    uint256 public totalStaked;
    uint256 public accRewardPerShare;
    uint256 public pendingRewards;
    uint256 public constant PRECISION = 1e18;

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    mapping(address => UserInfo) public userInfo;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 reward);
    event RewardAdded(uint256 amount);

    constructor(address _lpToken, address _owner) Ownable(_owner) {
        require(_lpToken != address(0), "LPR: zero lp token");
        lpToken = IERC20(_lpToken);
    }

    receive() external payable {
        if (totalStaked > 0) {
            uint256 total = msg.value + pendingRewards;
            pendingRewards = 0;
            accRewardPerShare += (total * PRECISION) / totalStaked;
        } else {
            pendingRewards += msg.value;
        }
        emit RewardAdded(msg.value);
    }

    function stake(uint256 _amount) external nonReentrant {
        require(_amount > 0, "LPR: zero amount");

        UserInfo storage user = userInfo[msg.sender];

        if (user.amount > 0) {
            uint256 pending = _pending(user);
            if (pending > 0) {
                _safeTransferBNB(msg.sender, pending);
                emit Claimed(msg.sender, pending);
            }
        }

        lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        user.amount += _amount;
        totalStaked += _amount;
        user.rewardDebt = (user.amount * accRewardPerShare) / PRECISION;

        emit Staked(msg.sender, _amount);
    }

    function unstake(uint256 _amount) external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "LPR: insufficient stake");
        require(_amount > 0, "LPR: zero amount");

        uint256 pending = _pending(user);
        if (pending > 0) {
            _safeTransferBNB(msg.sender, pending);
            emit Claimed(msg.sender, pending);
        }

        user.amount -= _amount;
        totalStaked -= _amount;
        user.rewardDebt = (user.amount * accRewardPerShare) / PRECISION;

        lpToken.safeTransfer(msg.sender, _amount);
        emit Unstaked(msg.sender, _amount);
    }

    function claim() external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        uint256 pending = _pending(user);
        require(pending > 0, "LPR: nothing to claim");

        user.rewardDebt = (user.amount * accRewardPerShare) / PRECISION;
        _safeTransferBNB(msg.sender, pending);

        emit Claimed(msg.sender, pending);
    }

    function earned(address _user) external view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        return _pending(user);
    }

    function _pending(UserInfo storage user) internal view returns (uint256) {
        return (user.amount * accRewardPerShare) / PRECISION - user.rewardDebt;
    }

    function _safeTransferBNB(address to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "LPR: BNB transfer failed");
    }
}
