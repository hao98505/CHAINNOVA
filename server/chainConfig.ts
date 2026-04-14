/**
 * chainConfig.ts — Single source of truth for all on-chain addresses (server side).
 *
 * Rules:
 *   - EVERY server file must import from here, NOT hardcode addresses inline.
 *   - All values default to the CURRENT test-token deployment.
 *   - Switching to a new token: set env vars below in .env, restart all workflows.
 *
 * Two-phase deploy flow (Flap Portal compatible):
 *   Phase A — Before token launch:
 *     npx hardhat run scripts/deployTaxReceiver.cjs --network bsc
 *     → Paste printed address into Flap "Tax Wallet" field.
 *
 *   Phase B — After token is live (one-click):
 *     TAX_RECEIVER_ADDRESS=0x... CNOVA_TOKEN=0xNEW... \
 *     npx hardhat run scripts/deployDownstream.cjs --network bsc
 *     → Deploys HD + BPV, wires TaxReceiver, flushes any accumulated BNB.
 *
 * Required .env keys for "production token" switch:
 *   CNOVA_TOKEN                  — ERC-20 token contract address
 *   PORTAL_ADDRESS               — Flap Portal bonding curve address
 *   HOLDER_DIVIDEND_ADDRESS      — HolderDividend contract (from Phase B)
 *   BOTTOM_PROTECTION_ADDRESS    — BottomProtectionVault contract (from Phase B)
 *   TAX_RECEIVER_ADDRESS         — TaxReceiver v3 contract (from Phase A)
 *   SIGNER_PRIVATE_KEY           — Watcher hot wallet for price attestation signing
 *   KEEPER_PRIVATE_KEY           — DividendKeeper transaction hot wallet
 *
 * Optional:
 *   BSC_RPC_URL                  — BSC RPC endpoint (default: public node)
 *   DIVIDEND_DEPLOY_BLOCK        — Deployment block of HolderDividend (for log indexing)
 *   WATCHER_ADDRESS              — Public key of price signer (for BPV.setSigner in Phase B)
 *
 * CURRENT STATE:
 *   TaxReceiver v3  : PENDING Phase A deploy (run deployTaxReceiver.cjs)
 *   HolderDividend  : PENDING Phase B (needs new token address)
 *   BottomProtection: PENDING Phase B (needs new token address)
 *   studioWallet    : 0x73c68029c2b66c8495c4d2943d39586e2a10c24e (immutable in TaxReceiver)
 */

// ─── Token ────────────────────────────────────────────────────────────────────

/**
 * CNOVA ERC-20 on BSC.
 * Current: test token on Flap Portal bonding curve.
 * Override with CNOVA_TOKEN env var when switching.
 */
export const CNOVA_TOKEN = (
  process.env.CNOVA_TOKEN || "0x0a9c2e3cda80a828334bfa2577a75a85229f7777"
) as `0x${string}`;

// ─── Protocol ─────────────────────────────────────────────────────────────────

/**
 * Flap Portal bonding curve contract (BSC mainnet).
 * This address is protocol-level and does NOT change with the token.
 * Override with PORTAL_ADDRESS if Flap deploys a new version.
 */
export const PORTAL_ADDRESS = (
  process.env.PORTAL_ADDRESS || "0xe2ce6ab80874fa9fa2aae65d277dd6b8e65c9de0"
) as `0x${string}`;

// ─── Deployed dividend contracts ──────────────────────────────────────────────

/**
 * HolderDividend — DEPLOYED (test token).
 * ⚠ taxReceiver not yet set (address(0) on-chain). Owner must call setTaxReceiver.
 * Must be redeployed for production token (token address is immutable).
 */
export const HOLDER_DIVIDEND_ADDRESS = (
  process.env.HOLDER_DIVIDEND_ADDRESS || "0xF7D702DFCe841b164661F62D851b7DE85aD9dDf0"
) as `0x${string}`;

/**
 * TaxReceiver v2 (three-route: 40/30/30).
 * ⚠ NOT YET DEPLOYED — only exists in local repo.
 * Run: npx hardhat run scripts/deployDividend.cjs --network bsc
 * Then set this env var and restart all server workflows.
 */
export const TAX_RECEIVER_ADDRESS = (
  process.env.TAX_RECEIVER_ADDRESS || ""
) as `0x${string}`;

/**
 * BottomProtectionVault — buy-in principal return vault.
 * ⚠ NOT YET DEPLOYED — contract at contracts/BottomProtectionVault.sol exists locally.
 * Deployed together with TaxReceiver v2 via deployDividend.cjs.
 * After deploy: call setSigner(WATCHER_ADDRESS) as owner.
 */
export const BOTTOM_PROTECTION_ADDRESS = (
  process.env.BOTTOM_PROTECTION_ADDRESS || ""
) as `0x${string}`;

// ─── RPC ──────────────────────────────────────────────────────────────────────

export const BSC_RPC = process.env.BSC_RPC_URL || "https://bsc-rpc.publicnode.com";

export const BSC_CHAIN_ID = 56;
