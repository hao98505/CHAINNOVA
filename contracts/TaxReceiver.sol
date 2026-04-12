// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TaxReceiver
 * @notice Phase 1 — Single on-chain address that receives BNB from token sell tax.
 *         Forwards to HolderDividend and/or marketing multisig.
 *
 * Deployment note:
 *   Deploy AFTER HolderDividend. Pass HolderDividend address in constructor.
 *   Set this contract's address as the token tax receiver once graduated from Portal.
 */
contract TaxReceiver is Ownable, ReentrancyGuard {

    address public holderDividend;
    address public marketingWallet;

    // Basis points out of 10000: default 100 % to dividend, 0 % to marketing
    uint256 public dividendBps = 10000;
    uint256 public constant TOTAL_BPS = 10000;

    uint256 public totalReceived;
    uint256 public totalForwardedToDividend;
    uint256 public totalForwardedToMarketing;

    event Received(address indexed sender, uint256 amount);
    event ForwardedToDividend(uint256 amount);
    event ForwardedToMarketing(address indexed wallet, uint256 amount);
    event HolderDividendUpdated(address indexed prev, address indexed next);
    event MarketingWalletUpdated(address indexed prev, address indexed next);
    event AllocationUpdated(uint256 dividendBps);

    error ZeroAddress();
    error NothingToForward();
    error TransferFailed();
    error BpsOutOfRange();

    constructor(
        address _holderDividend,
        address _marketingWallet,
        address _owner
    ) Ownable(_owner) {
        if (_holderDividend == address(0)) revert ZeroAddress();
        holderDividend = _holderDividend;
        marketingWallet = _marketingWallet; // may be zero initially
    }

    receive() external payable {
        totalReceived += msg.value;
        emit Received(msg.sender, msg.value);
    }

    fallback() external payable {
        totalReceived += msg.value;
        emit Received(msg.sender, msg.value);
    }

    // ─────────────────────────────────────────
    // Core: flush accumulated BNB downstream
    // ─────────────────────────────────────────

    /**
     * @notice Flush the full contract balance using configured allocation.
     *         Anyone may call this — no permissions required.
     */
    function flush() external nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToForward();
        _flush(balance);
    }

    /**
     * @notice Owner-only: flush a specific amount.
     */
    function flushAmount(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert NothingToForward();
        _flush(amount);
    }

    function _flush(uint256 balance) internal {
        uint256 toDividend = (balance * dividendBps) / TOTAL_BPS;
        uint256 toMarketing = balance - toDividend;

        if (toDividend > 0) {
            totalForwardedToDividend += toDividend;
            // Call notifyReward on HolderDividend
            (bool ok, ) = holderDividend.call{value: toDividend}(
                abi.encodeWithSignature("notifyReward()")
            );
            if (!ok) revert TransferFailed();
            emit ForwardedToDividend(toDividend);
        }

        if (toMarketing > 0 && marketingWallet != address(0)) {
            totalForwardedToMarketing += toMarketing;
            (bool ok2, ) = marketingWallet.call{value: toMarketing}("");
            if (!ok2) revert TransferFailed();
            emit ForwardedToMarketing(marketingWallet, toMarketing);
        }
    }

    // ─────────────────────────────────────────
    // Owner configuration
    // ─────────────────────────────────────────

    function setHolderDividend(address _next) external onlyOwner {
        if (_next == address(0)) revert ZeroAddress();
        emit HolderDividendUpdated(holderDividend, _next);
        holderDividend = _next;
    }

    function setMarketingWallet(address _next) external onlyOwner {
        emit MarketingWalletUpdated(marketingWallet, _next);
        marketingWallet = _next;
    }

    /**
     * @param _dividendBps 10000 = 100% to dividend, 8000 = 80% dividend + 20% marketing.
     */
    function setAllocation(uint256 _dividendBps) external onlyOwner {
        if (_dividendBps > TOTAL_BPS) revert BpsOutOfRange();
        dividendBps = _dividendBps;
        emit AllocationUpdated(_dividendBps);
    }

    // ─────────────────────────────────────────
    // Emergency
    // ─────────────────────────────────────────

    /**
     * @notice Owner-only emergency rescue: withdraw full BNB balance to owner.
     */
    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        if (bal == 0) revert NothingToForward();
        (bool ok, ) = owner().call{value: bal}("");
        if (!ok) revert TransferFailed();
    }
}
