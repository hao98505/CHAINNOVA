// SPDX-License-Identifier: MIT
/// @custom:status ARCHIVED — replaced by TaxReceiver.sol v2 (three-route 40/30/30).
/// Do NOT deploy. Kept for historical reference only.
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MasterVault is Ownable, ReentrancyGuard {
    uint256 public constant TOTAL_BPS = 10000;

    uint256 public lpBps = 4286;
    uint256 public referralBps = 4286;
    uint256 public marketingBps = 1428;

    address public lpRewardVault;
    address public referralVault;
    address public marketingVault;

    uint256 public totalReceived;
    uint256 public totalDistributedToLP;
    uint256 public totalDistributedToReferral;
    uint256 public totalDistributedToMarketing;

    event Received(address indexed sender, uint256 amount);
    event Distributed(
        uint256 toLp,
        uint256 toReferral,
        uint256 toMarketing,
        uint256 timestamp
    );
    event RecipientsUpdated(
        address lpRewardVault,
        address referralVault,
        address marketingVault
    );
    event AllocationUpdated(
        uint256 lpBps,
        uint256 referralBps,
        uint256 marketingBps
    );

    constructor(
        address _lpRewardVault,
        address _referralVault,
        address _marketingVault,
        address _owner
    ) Ownable(_owner) {
        require(_lpRewardVault != address(0), "MV: zero lp");
        require(_referralVault != address(0), "MV: zero referral");
        require(_marketingVault != address(0), "MV: zero marketing");

        lpRewardVault = _lpRewardVault;
        referralVault = _referralVault;
        marketingVault = _marketingVault;
    }

    receive() external payable {
        totalReceived += msg.value;
        emit Received(msg.sender, msg.value);
    }

    fallback() external payable {
        totalReceived += msg.value;
        emit Received(msg.sender, msg.value);
    }

    function distribute() external nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "MV: nothing to distribute");

        uint256 toLp = (balance * lpBps) / TOTAL_BPS;
        uint256 toReferral = (balance * referralBps) / TOTAL_BPS;
        uint256 toMarketing = balance - toLp - toReferral;

        totalDistributedToLP += toLp;
        totalDistributedToReferral += toReferral;
        totalDistributedToMarketing += toMarketing;

        _safeTransfer(lpRewardVault, toLp);
        _safeTransfer(referralVault, toReferral);
        _safeTransfer(marketingVault, toMarketing);

        emit Distributed(toLp, toReferral, toMarketing, block.timestamp);
    }

    function setRecipients(
        address _lpRewardVault,
        address _referralVault,
        address _marketingVault
    ) external onlyOwner {
        require(_lpRewardVault != address(0), "MV: zero lp");
        require(_referralVault != address(0), "MV: zero referral");
        require(_marketingVault != address(0), "MV: zero marketing");

        lpRewardVault = _lpRewardVault;
        referralVault = _referralVault;
        marketingVault = _marketingVault;

        emit RecipientsUpdated(_lpRewardVault, _referralVault, _marketingVault);
    }

    function setAllocation(
        uint256 _lpBps,
        uint256 _referralBps,
        uint256 _marketingBps
    ) external onlyOwner {
        require(
            _lpBps + _referralBps + _marketingBps == TOTAL_BPS,
            "MV: bps must sum to 10000"
        );
        lpBps = _lpBps;
        referralBps = _referralBps;
        marketingBps = _marketingBps;

        emit AllocationUpdated(_lpBps, _referralBps, _marketingBps);
    }

    function _safeTransfer(address to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "MV: transfer failed");
    }
}
