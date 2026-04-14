// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TaxReceiver v2
 * @notice Three-route BNB tax distributor (40 / 30 / 30).
 *
 *   Route A — 40 %  → HolderDividend     (notifyReward call)
 *   Route B — 30 %  → BottomProtectionVault (notifyReward call)
 *   Route C — 30 %  → studioWallet       (plain BNB transfer, NOT shown in frontend)
 *
 * Ratios are hard-coded in basis-point constants; no runtime setter.
 * Owner may update target addresses but NOT the ratios.
 *
 * Deployment order:
 *   1. HolderDividend
 *   2. BottomProtectionVault
 *   3. TaxReceiver (pass addresses above + studioWallet + owner)
 *   4. HolderDividend.setTaxReceiver(TaxReceiver)
 */
contract TaxReceiver is Ownable, ReentrancyGuard {

    // ─── Hard-coded allocation ────────────────────────────────────────────────
    uint256 public constant DIVIDEND_BPS  = 4000;   // 40 %
    uint256 public constant BOTTOM_BPS    = 3000;   // 30 %
    uint256 public constant STUDIO_BPS    = 3000;   // 30 %
    uint256 public constant TOTAL_BPS     = 10000;

    // ─── Target addresses ─────────────────────────────────────────────────────
    address public holderDividend;
    address public bottomProtectionVault;
    address public studioWallet;

    // ─── Accounting ───────────────────────────────────────────────────────────
    uint256 public totalReceived;
    uint256 public totalForwardedToDividend;
    uint256 public totalForwardedToBottom;
    uint256 public totalForwardedToStudio;

    // ─── Events ───────────────────────────────────────────────────────────────
    event Received(address indexed sender, uint256 amount);
    event ForwardedToDividend(uint256 amount);
    event ForwardedToBottomProtection(uint256 amount);
    event ForwardedToStudio(address indexed wallet, uint256 amount);
    event HolderDividendUpdated(address indexed prev, address indexed next);
    event BottomProtectionVaultUpdated(address indexed prev, address indexed next);
    event StudioWalletUpdated(address indexed prev, address indexed next);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error ZeroAddress();
    error NothingToForward();
    error TransferFailed();

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        address _holderDividend,
        address _bottomProtectionVault,
        address _studioWallet,
        address _owner
    ) Ownable(_owner) {
        if (_holderDividend       == address(0)) revert ZeroAddress();
        if (_bottomProtectionVault == address(0)) revert ZeroAddress();
        if (_studioWallet          == address(0)) revert ZeroAddress();
        holderDividend        = _holderDividend;
        bottomProtectionVault = _bottomProtectionVault;
        studioWallet          = _studioWallet;
    }

    // ─── Receive ─────────────────────────────────────────────────────────────
    receive() external payable {
        totalReceived += msg.value;
        emit Received(msg.sender, msg.value);
    }

    fallback() external payable {
        totalReceived += msg.value;
        emit Received(msg.sender, msg.value);
    }

    // ─── Core flush ──────────────────────────────────────────────────────────

    /**
     * @notice Flush full contract balance using hard-coded 40/30/30 split.
     *         Anyone may call — no auth required.
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
        uint256 toDividend = (balance * DIVIDEND_BPS) / TOTAL_BPS;
        uint256 toBottom   = (balance * BOTTOM_BPS)   / TOTAL_BPS;
        uint256 toStudio   = balance - toDividend - toBottom; // absorb rounding dust

        // Route A: HolderDividend
        if (toDividend > 0) {
            totalForwardedToDividend += toDividend;
            (bool okA, ) = holderDividend.call{value: toDividend}(
                abi.encodeWithSignature("notifyReward()")
            );
            if (!okA) revert TransferFailed();
            emit ForwardedToDividend(toDividend);
        }

        // Route B: BottomProtectionVault
        if (toBottom > 0) {
            totalForwardedToBottom += toBottom;
            (bool okB, ) = bottomProtectionVault.call{value: toBottom}(
                abi.encodeWithSignature("notifyReward()")
            );
            if (!okB) revert TransferFailed();
            emit ForwardedToBottomProtection(toBottom);
        }

        // Route C: studioWallet (plain transfer)
        if (toStudio > 0) {
            totalForwardedToStudio += toStudio;
            (bool okC, ) = studioWallet.call{value: toStudio}("");
            if (!okC) revert TransferFailed();
            emit ForwardedToStudio(studioWallet, toStudio);
        }
    }

    // ─── Owner address management ─────────────────────────────────────────────

    function setHolderDividend(address _next) external onlyOwner {
        if (_next == address(0)) revert ZeroAddress();
        emit HolderDividendUpdated(holderDividend, _next);
        holderDividend = _next;
    }

    function setBottomProtectionVault(address _next) external onlyOwner {
        if (_next == address(0)) revert ZeroAddress();
        emit BottomProtectionVaultUpdated(bottomProtectionVault, _next);
        bottomProtectionVault = _next;
    }

    function setStudioWallet(address _next) external onlyOwner {
        if (_next == address(0)) revert ZeroAddress();
        emit StudioWalletUpdated(studioWallet, _next);
        studioWallet = _next;
    }

    // ─── Emergency ────────────────────────────────────────────────────────────

    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        if (bal == 0) revert NothingToForward();
        (bool ok, ) = owner().call{value: bal}("");
        if (!ok) revert TransferFailed();
    }
}
