// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TaxReceiver v3
 * @notice Pre-deployable three-route BNB tax distributor (40 / 30 / 30).
 *
 * Deployment flow
 * ───────────────
 *   Phase A — Before token launch:
 *     Deploy TaxReceiver(studioWallet, owner).
 *     holderDividend = address(0), bottomProtectionVault = address(0).
 *     Contract accepts BNB but flush() reverts until wired.
 *     → Use the deployed address as the tax wallet on the Flap launch page.
 *
 *   Phase B — After token address is known (one-click script):
 *     1. Deploy HolderDividend(token, minBalance, owner)
 *     2. Deploy BottomProtectionVault(token, owner)
 *     3. TaxReceiver.setHolderDividend(HD)
 *     4. TaxReceiver.setBottomProtectionVault(BPV)   ← wired = true automatically
 *     5. TaxReceiver.flush()                          ← clears any accumulated BNB
 *     6. HD.setTaxReceiver(TaxReceiver)
 *
 * Tax allocation (hard-coded, immutable ratios)
 * ─────────────────────────────────────────────
 *   40 % → HolderDividend        (notifyReward call)
 *   30 % → BottomProtectionVault (notifyReward call)
 *   30 % → studioWallet          (plain BNB, hidden from frontend)
 *
 * studioWallet is immutable — set once at deploy, never changeable.
 */
contract TaxReceiver is Ownable, ReentrancyGuard {

    // ─── Hard-coded allocation ────────────────────────────────────────────────
    uint256 public constant DIVIDEND_BPS = 4000;  // 40 %
    uint256 public constant BOTTOM_BPS   = 3000;  // 30 %
    uint256 public constant STUDIO_BPS   = 3000;  // 30 %
    uint256 public constant TOTAL_BPS    = 10_000;

    // ─── Immutable ────────────────────────────────────────────────────────────
    address public immutable studioWallet;

    // ─── Wired downstream (null until Phase B) ───────────────────────────────
    address public holderDividend;
    address public bottomProtectionVault;

    /// @notice True once both downstream addresses are set. flush() reverts until then.
    bool public wired;

    // ─── Accounting ───────────────────────────────────────────────────────────
    uint256 public totalReceived;
    uint256 public totalForwardedToDividend;
    uint256 public totalForwardedToBottom;
    uint256 public totalForwardedToStudio;

    // ─── Events ───────────────────────────────────────────────────────────────
    event Received(address indexed sender, uint256 amount);
    event HolderDividendSet(address indexed prev, address indexed next);
    event BottomProtectionVaultSet(address indexed prev, address indexed next);
    event Wired(address indexed holderDividend, address indexed bottomProtectionVault);
    event Flushed(uint256 toDividend, uint256 toBottom, uint256 toStudio);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error ZeroAddress();
    error NotWired();
    error NothingToFlush();
    error TransferFailed();

    // ─── Constructor (Phase A — studioWallet only) ───────────────────────────
    /**
     * @param _studioWallet Fixed 30 % BNB recipient. Immutable after deploy.
     * @param _owner        Contract owner (sets HD/BPV in Phase B).
     */
    constructor(address _studioWallet, address _owner) Ownable(_owner) {
        if (_studioWallet == address(0)) revert ZeroAddress();
        studioWallet = _studioWallet;
    }

    // ─── BNB accumulator ─────────────────────────────────────────────────────

    receive() external payable {
        totalReceived += msg.value;
        emit Received(msg.sender, msg.value);
    }

    fallback() external payable {
        totalReceived += msg.value;
        emit Received(msg.sender, msg.value);
    }

    // ─── Phase B wiring (owner-only) ─────────────────────────────────────────

    /**
     * @notice Set or update the HolderDividend downstream address.
     *         If both HD and BPV are now non-zero, wired flips to true.
     */
    function setHolderDividend(address _next) external onlyOwner {
        if (_next == address(0)) revert ZeroAddress();
        emit HolderDividendSet(holderDividend, _next);
        holderDividend = _next;
        _maybeWire();
    }

    /**
     * @notice Set or update the BottomProtectionVault downstream address.
     *         If both HD and BPV are now non-zero, wired flips to true.
     */
    function setBottomProtectionVault(address _next) external onlyOwner {
        if (_next == address(0)) revert ZeroAddress();
        emit BottomProtectionVaultSet(bottomProtectionVault, _next);
        bottomProtectionVault = _next;
        _maybeWire();
    }

    function _maybeWire() internal {
        if (!wired && holderDividend != address(0) && bottomProtectionVault != address(0)) {
            wired = true;
            emit Wired(holderDividend, bottomProtectionVault);
        }
    }

    // ─── Flush (anyone may call — reverts until wired) ───────────────────────

    /**
     * @notice Distribute the contract's full BNB balance via the 40/30/30 split.
     *         Reverts if downstream is not yet wired.
     *         Anyone may call — designed for keeper / post-deploy script.
     */
    function flush() external nonReentrant {
        if (!wired) revert NotWired();
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToFlush();
        _flush(balance);
    }

    /**
     * @notice Owner-only: flush a specific amount.
     */
    function flushAmount(uint256 amount) external onlyOwner nonReentrant {
        if (!wired) revert NotWired();
        if (amount == 0) revert NothingToFlush();
        _flush(amount);
    }

    function _flush(uint256 balance) internal {
        uint256 toDividend = (balance * DIVIDEND_BPS) / TOTAL_BPS;
        uint256 toBottom   = (balance * BOTTOM_BPS)   / TOTAL_BPS;
        uint256 toStudio   = balance - toDividend - toBottom; // rounding dust → studio

        if (toDividend > 0) {
            totalForwardedToDividend += toDividend;
            (bool okA, ) = holderDividend.call{value: toDividend}(
                abi.encodeWithSignature("notifyReward()")
            );
            if (!okA) revert TransferFailed();
        }

        if (toBottom > 0) {
            totalForwardedToBottom += toBottom;
            (bool okB, ) = bottomProtectionVault.call{value: toBottom}(
                abi.encodeWithSignature("notifyReward()")
            );
            if (!okB) revert TransferFailed();
        }

        if (toStudio > 0) {
            totalForwardedToStudio += toStudio;
            (bool okC, ) = studioWallet.call{value: toStudio}("");
            if (!okC) revert TransferFailed();
        }

        emit Flushed(toDividend, toBottom, toStudio);
    }

    // ─── Emergency ────────────────────────────────────────────────────────────

    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        if (bal == 0) revert NothingToFlush();
        (bool ok, ) = owner().call{value: bal}("");
        if (!ok) revert TransferFailed();
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice BNB pending distribution (not yet flushed).
    function pendingBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
