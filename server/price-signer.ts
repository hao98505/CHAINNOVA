/**
 * price-signer.ts
 *
 * Off-chain watcher service for BottomProtectionVault.
 *
 * Responsibilities:
 *   1. Periodically fetch CNOVA current price in BNB from Portal on-chain
 *      (fallback: GMGN REST → DexScreener REST).
 *   2. On request, sign (refPrice, userNonce, deadline, chainId, contractAddr)
 *      using ECDSA with SIGNER_PRIVATE_KEY.
 *   3. Expose the signature via GET /api/price-signature?user=0x...
 *
 * The BottomProtectionVault contract verifies:
 *   ecrecover(keccak256("\x19Ethereum Signed Message:\n32",
 *     keccak256("BottomProtection" + chainId + contract + refPrice + nonce + deadline)
 *   ), v, r, s) == signer
 *
 * Required env vars:
 *   SIGNER_PRIVATE_KEY          — 0x-prefixed hex private key (NOT the deploy key)
 *   BOTTOM_PROTECTION_ADDRESS   — deployed contract address
 *   BSC_RPC_URL                 — optional override (default: public node)
 *
 * The signed price is valid for SIGNATURE_TTL_SECONDS (default 120 s).
 * After that window the signature expires on-chain (deadline check).
 */

import { ethers } from "ethers";

import { CNOVA_TOKEN, PORTAL_ADDRESS, BSC_RPC } from "./chainConfig";

// ─── Configuration ─────────────────────────────────────────────────────────
const CHAIN_ID                = 56n;
const SIGNATURE_TTL_SECONDS   = 120; // signature valid window
const PRICE_REFRESH_MS        = 30_000; // refresh on-chain price every 30 s

// ─── Portal ABI (minimal — getTokenV8Safe) ────────────────────────────────
const PORTAL_ABI = [
  {
    name: "getTokenV8Safe",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "token", type: "address" }],
    outputs: [
      { name: "virtualNativeReserve", type: "uint256" },
      { name: "virtualTokenReserve",  type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
  },
] as const;

// ─── BottomProtectionVault ABI (nonces) ───────────────────────────────────
const BPV_ABI = [
  {
    name: "nonces",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─── State ────────────────────────────────────────────────────────────────
let cachedPriceBnbWei: bigint = 0n;   // BNB per CNOVA, 1e18 precision
let lastPriceFetch    = 0;

const provider = new ethers.JsonRpcProvider(BSC_RPC);

/**
 * Fetch CNOVA price from Portal bonding curve.
 * Returns price as bigint in wei (1e18 = 1 BNB per CNOVA).
 */
async function fetchPortalPrice(): Promise<bigint> {
  try {
    const portal = new ethers.Contract(PORTAL_ADDRESS, PORTAL_ABI, provider);
    const result = await portal.getTokenV8Safe(CNOVA_TOKEN);
    const bnbReserve   = BigInt(result[0]);  // virtualNativeReserve
    const tokenReserve = BigInt(result[1]);  // virtualTokenReserve
    if (tokenReserve === 0n) return 0n;
    // price = bnbReserve / tokenReserve  (both in 1e18 units → result in 1e18)
    return (bnbReserve * 10n ** 18n) / tokenReserve;
  } catch (err) {
    console.warn("[price-signer] Portal fetch failed:", (err as Error).message);
    return 0n;
  }
}

/**
 * Fallback: fetch from GMGN REST endpoint.
 * Returns price in BNB as bigint wei, or 0n on failure.
 */
async function fetchGmgnPrice(): Promise<bigint> {
  try {
    const url = `https://gmgn.ai/defi/quotation/v1/tokens/bsc/${CNOVA_TOKEN}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const json = await res.json() as any;
    const priceUsd = parseFloat(json?.data?.price ?? "0");
    const bnbUsd   = parseFloat(json?.data?.native_price ?? "0");
    if (priceUsd <= 0 || bnbUsd <= 0) return 0n;
    const priceBnb = priceUsd / bnbUsd;
    return BigInt(Math.round(priceBnb * 1e18));
  } catch {
    return 0n;
  }
}

export async function getRefPriceBnbWei(): Promise<bigint> {
  const now = Date.now();
  if (now - lastPriceFetch < PRICE_REFRESH_MS && cachedPriceBnbWei > 0n) {
    return cachedPriceBnbWei;
  }
  let price = await fetchPortalPrice();
  if (price === 0n) price = await fetchGmgnPrice();
  if (price > 0n) {
    cachedPriceBnbWei = price;
    lastPriceFetch    = now;
  }
  return cachedPriceBnbWei;
}

/**
 * Build and return a signed price attestation for a given user.
 *
 * @param userAddress  Checksummed EVM address of the requesting user.
 * @returns            { refPrice, deadline, nonce, v, r, s }
 */
export async function buildPriceSignature(userAddress: string): Promise<{
  refPrice:  string;
  deadline:  number;
  nonce:     string;
  v: number;
  r: string;
  s: string;
}> {
  const privKey             = process.env.SIGNER_PRIVATE_KEY;
  const contractAddress     = process.env.BOTTOM_PROTECTION_ADDRESS;

  if (!privKey)         throw new Error("SIGNER_PRIVATE_KEY not set");
  if (!contractAddress) throw new Error("BOTTOM_PROTECTION_ADDRESS not set");

  const wallet  = new ethers.Wallet(privKey);
  const refPrice = await getRefPriceBnbWei();
  const deadline = Math.floor(Date.now() / 1000) + SIGNATURE_TTL_SECONDS;

  // Read user nonce from contract
  const bpv   = new ethers.Contract(contractAddress, BPV_ABI, provider);
  const nonce: bigint = await bpv.nonces(userAddress);

  // Build inner hash (matches contract)
  const innerHash = ethers.keccak256(
    ethers.solidityPacked(
      ["string", "uint256", "address", "uint256", "uint256", "uint256"],
      ["BottomProtection", CHAIN_ID, contractAddress, refPrice, nonce, deadline]
    )
  );

  // EIP-191 personal sign
  const digest = ethers.keccak256(
    ethers.concat([
      ethers.toUtf8Bytes("\x19Ethereum Signed Message:\n32"),
      ethers.getBytes(innerHash),
    ])
  );

  const sig = wallet.signingKey.sign(digest);

  return {
    refPrice:  refPrice.toString(),
    deadline,
    nonce:     nonce.toString(),
    v:         sig.v,
    r:         sig.r,
    s:         sig.s,
  };
}
