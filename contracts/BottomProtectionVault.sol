// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BottomProtectionVault
 * @notice Buy-in principal return vault — 30 % of CNOVA tax BNB flows here.
 *
 * Mechanism
 * ─────────
 * Users record their weighted average buy price on-chain via `recordPurchase()`.
 * When they wish to redeem protection, they:
 *   1. Obtain a signed price attestation from the off-chain watcher service
 *      (POST /api/price-signature?user=0x...).
 *   2. Call `redeem(qty, refPrice, deadline, v, r, s)`.
 *
 * Loss tier table (lossRate = (weightedBuyPrice - refPrice) / weightedBuyPrice)
 * ──────────────────────────────────────────────────────────────────────────────
 *   lossRate < 50 %          → 0 % principal returned (not triggered)
 *   50 % ≤ lossRate < 60 %   → 30 % principal returned
 *   60 % ≤ lossRate < 70 %   → 50 % principal returned
 *   70 % ≤ lossRate < 80 %   → 60 % principal returned
 *   80 % ≤ lossRate < 90 %   → 70 % principal returned
 *   90 % ≤ lossRate < 100 %  → 80 % principal returned
 *   refPrice == 0 OR emergencyZero enabled → 100 % principal returned
 *
 * Payout formula:
 *   payoutBNB = redeemQty × weightedBuyPrice × payoutRatio / 1e18
 *
 * Redeemed tokens are burned to BURN_ADDRESS (0x…dEaD) — never re-enter market.
 *
 * Signed price attestation (EIP-191 simple hash)
 * ───────────────────────────────────────────────
 *   digest = keccak256(abi.encodePacked(
 *       "\x19Ethereum Signed Message:\n32",
 *       keccak256(abi.encodePacked(
 *           "BottomProtection",
 *           block.chainid,
 *           address(this),
 *           refPrice,
 *           nonces[user],
 *           deadline
 *       ))
 *   ))
 *   require ecrecover(digest, v, r, s) == signer
 *
 * Deployment
 * ──────────
 *   constructor(cnova, owner)
 *   Owner calls setSigner(watcherAddress) after deploy.
 *   TaxReceiver routes 30 % here via notifyReward().
 */
contract BottomProtectionVault is Ownable, ReentrancyGuard {

    // ─── Constants ────────────────────────────────────────────────────────────
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint256 private constant PRECISION   = 1e18;

    // ─── State ────────────────────────────────────────────────────────────────
    IERC20  public cnova;
    address public signer;          // Off-chain watcher public key
    bool    public emergencyZero;   // Owner enables → 100 % payout allowed

    uint256 public totalReceived;   // Cumulative BNB received from TaxReceiver
    uint256 public totalPaidOut;    // Cumulative BNB paid to users

    /// @dev Weighted average buy price per user (BNB/CNOVA, 1e18 precision)
    mapping(address => uint256) public weightedBuyPrice;
    /// @dev Number of CNOVA tokens eligible for protection (1e18 precision)
    mapping(address => uint256) public protectedBalance;
    /// @dev Replay-protection nonce per user, incremented on each redeem
    mapping(address => uint256) public nonces;

    // ─── Events ───────────────────────────────────────────────────────────────
    event RewardReceived(uint256 amount);
    event PurchaseRecorded(address indexed user, uint256 qty, uint256 price, uint256 newWeightedPrice);
    event Redeemed(address indexed user, uint256 qty, uint256 refPrice, uint256 lossRateBps, uint256 payoutBps, uint256 payoutBnb);
    event SignerUpdated(address indexed prev, address indexed next);
    event EmergencyZeroSet(bool enabled);
    event EmergencyWithdrawn(address indexed to, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error SignatureExpired();
    error InvalidSignature();
    error LossBelowThreshold();
    error InsufficientProtectedBalance();
    error InsufficientVaultBalance();
    error TransferFailed();
    error NoBuyPriceRecorded();

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(address _cnova, address _owner) Ownable(_owner) {
        if (_cnova == address(0)) revert ZeroAddress();
        cnova = IERC20(_cnova);
    }

    // ─── BNB receive (from TaxReceiver) ──────────────────────────────────────
    receive() external payable {
        totalReceived += msg.value;
        emit RewardReceived(msg.value);
    }

    fallback() external payable {
        totalReceived += msg.value;
        emit RewardReceived(msg.value);
    }

    /// @notice Called by TaxReceiver via notifyReward() — same as plain receive.
    function notifyReward() external payable {
        totalReceived += msg.value;
        emit RewardReceived(msg.value);
    }

    // ─── User: record purchase ────────────────────────────────────────────────

    /**
     * @notice Record a CNOVA purchase to establish or update weighted buy price.
     * @param qty         Amount of CNOVA purchased (wei, 1e18 = 1 CNOVA).
     * @param pricePerToken BNB paid per CNOVA (wei per 1e18 CNOVA, i.e. 1e18 precision).
     *
     * Weighted average:
     *   newPrice = (oldPrice × oldQty + pricePerToken × qty) / (oldQty + qty)
     *
     * Can only increase protectedBalance — selling does NOT reduce it here;
     * the vault penalises the redeemable qty in `redeem()`.
     */
    function recordPurchase(uint256 qty, uint256 pricePerToken) external {
        if (qty == 0) revert ZeroAmount();
        if (pricePerToken == 0) revert ZeroAmount();

        address user    = msg.sender;
        uint256 oldQty   = protectedBalance[user];
        uint256 oldPrice = weightedBuyPrice[user];

        uint256 newPrice;
        if (oldQty == 0) {
            newPrice = pricePerToken;
        } else {
            // Weighted average — safe from overflow given realistic token amounts
            newPrice = (oldPrice * oldQty + pricePerToken * qty) / (oldQty + qty);
        }

        protectedBalance[user] += qty;
        weightedBuyPrice[user]  = newPrice;

        emit PurchaseRecorded(user, qty, pricePerToken, newPrice);
    }

    // ─── User: redeem protection ──────────────────────────────────────────────

    /**
     * @notice Sell `redeemQty` CNOVA to the vault for BNB compensation.
     *
     * @param redeemQty  CNOVA amount to redeem (must be ≤ protectedBalance).
     * @param refPrice   Current CNOVA price in BNB (1e18 precision), attested by signer.
     * @param deadline   Signature expiry (unix timestamp).
     * @param v          ECDSA v.
     * @param r          ECDSA r.
     * @param s          ECDSA s.
     *
     * The redeemed CNOVA tokens are transferred from the user to BURN_ADDRESS.
     * The user receives BNB from the vault.
     */
    function redeem(
        uint256 redeemQty,
        uint256 refPrice,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external nonReentrant {
        if (redeemQty == 0) revert ZeroAmount();
        if (block.timestamp > deadline) revert SignatureExpired();

        address user = msg.sender;
        if (weightedBuyPrice[user] == 0) revert NoBuyPriceRecorded();
        if (protectedBalance[user] < redeemQty) revert InsufficientProtectedBalance();

        // ── Verify watcher signature ─────────────────────────────────────────
        bytes32 innerHash = keccak256(abi.encodePacked(
            "BottomProtection",
            block.chainid,
            address(this),
            refPrice,
            nonces[user],
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", innerHash));
        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0) || recovered != signer) revert InvalidSignature();

        // Consume nonce
        nonces[user]++;

        // ── Compute loss rate (basis points, 1 bp = 0.01 %) ─────────────────
        uint256 buyPrice = weightedBuyPrice[user];
        uint256 lossRateBps;

        if (refPrice == 0 || emergencyZero) {
            lossRateBps = 10000; // 100 %
        } else if (refPrice >= buyPrice) {
            // No loss — revert
            revert LossBelowThreshold();
        } else {
            // lossRateBps = (buyPrice - refPrice) * 10000 / buyPrice
            lossRateBps = ((buyPrice - refPrice) * 10000) / buyPrice;
        }

        // ── Tier lookup → payout basis points ────────────────────────────────
        uint256 payoutBps = _payoutBps(lossRateBps);
        if (payoutBps == 0) revert LossBelowThreshold();

        // ── Compute BNB payout ────────────────────────────────────────────────
        // payoutBnb = redeemQty * buyPrice * payoutBps / 1e18 / 10000
        // redeemQty in 1e18 CNOVA, buyPrice in wei/CNOVA (1e18 precision)
        // → redeemQty * buyPrice = wei² units → divide by 1e18 to get wei
        uint256 payoutBnb = (redeemQty * buyPrice / PRECISION) * payoutBps / 10000;

        if (payoutBnb == 0) revert ZeroAmount();
        if (address(this).balance < payoutBnb) revert InsufficientVaultBalance();

        // ── State updates ────────────────────────────────────────────────────
        protectedBalance[user] -= redeemQty;
        totalPaidOut           += payoutBnb;

        // ── Token burn ───────────────────────────────────────────────────────
        // Transfer CNOVA from user → BURN_ADDRESS (user must approve first)
        bool tokenOk = cnova.transferFrom(user, BURN_ADDRESS, redeemQty);
        if (!tokenOk) revert TransferFailed();

        // ── BNB payout ───────────────────────────────────────────────────────
        (bool bnbOk, ) = user.call{value: payoutBnb}("");
        if (!bnbOk) revert TransferFailed();

        emit Redeemed(user, redeemQty, refPrice, lossRateBps, payoutBps, payoutBnb);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /**
     * @notice Estimate payout for a given user, qty, and refPrice.
     *         Does NOT check signature — for UI preview only.
     */
    function estimatedPayout(
        address user,
        uint256 qty,
        uint256 refPrice
    ) external view returns (uint256 payoutBnb, uint256 lossRateBps, uint256 payoutBps) {
        uint256 buyPrice = weightedBuyPrice[user];
        if (buyPrice == 0 || qty == 0) return (0, 0, 0);

        if (refPrice == 0 || emergencyZero) {
            lossRateBps = 10000;
        } else if (refPrice >= buyPrice) {
            return (0, 0, 0);
        } else {
            lossRateBps = ((buyPrice - refPrice) * 10000) / buyPrice;
        }

        payoutBps  = _payoutBps(lossRateBps);
        payoutBnb  = (qty * buyPrice / PRECISION) * payoutBps / 10000;
    }

    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ─── Internal tier lookup ─────────────────────────────────────────────────

    function _payoutBps(uint256 lossRateBps) internal pure returns (uint256) {
        if (lossRateBps >= 10000)  return 10000; // 100 % — emergency/zero
        if (lossRateBps >= 9000)   return 8000;  // 90–100 % loss → 80 % returned
        if (lossRateBps >= 8000)   return 7000;  // 80–90 %  → 70 %
        if (lossRateBps >= 7000)   return 6000;  // 70–80 %  → 60 %
        if (lossRateBps >= 6000)   return 5000;  // 60–70 %  → 50 %
        if (lossRateBps >= 5000)   return 3000;  // 50–60 %  → 30 %
        return 0;                                 // < 50 %   → not triggered
    }

    // ─── Owner management ─────────────────────────────────────────────────────

    function setSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress();
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    function setEmergencyZero(bool _enabled) external onlyOwner {
        emergencyZero = _enabled;
        emit EmergencyZeroSet(_enabled);
    }

    // ─── Emergency ────────────────────────────────────────────────────────────

    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        if (bal == 0) revert InsufficientVaultBalance();
        (bool ok, ) = owner().call{value: bal}("");
        if (!ok) revert TransferFailed();
        emit EmergencyWithdrawn(owner(), bal);
    }
}
