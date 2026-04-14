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
 *   TaxReceiver v3  : 0x7c591F78b928Ca4C8FD49A2bC62027af13ad02cA ✅ DEPLOYED (Phase A)
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
 * TaxReceiver v3 — pre-deployable, downstream-wired after token launch.
 * Phase A: run scripts/deployTaxReceiver.cjs → paste address into Flap "Tax Wallet".
 * Set TAX_RECEIVER_ADDRESS env var after Phase A deploy.
 */
export const TAX_RECEIVER_ADDRESS = (
  process.env.TAX_RECEIVER_ADDRESS || ""
) as `0x${string}`;

/**
 * HolderDividend — receives 40 % of every TaxReceiver flush.
 * Phase B: deployed by scripts/deployDownstream.cjs once token address is known.
 * token address is immutable — must match the live ERC-20.
 */
export const HOLDER_DIVIDEND_ADDRESS = (
  process.env.HOLDER_DIVIDEND_ADDRESS || ""
) as `0x${string}`;

/**
 * BottomProtectionVault — receives 30 % of every TaxReceiver flush.
 * Phase B: deployed by scripts/deployDownstream.cjs alongside HolderDividend.
 * Call setSigner(WATCHER_ADDRESS) after Phase B to enable price-attested redemptions.
 */
export const BOTTOM_PROTECTION_ADDRESS = (
  process.env.BOTTOM_PROTECTION_ADDRESS || ""
) as `0x${string}`;

// ─── RPC ──────────────────────────────────────────────────────────────────────

export const BSC_RPC = process.env.BSC_RPC_URL || "https://bsc-rpc.publicnode.com";

export const BSC_CHAIN_ID = 56;
