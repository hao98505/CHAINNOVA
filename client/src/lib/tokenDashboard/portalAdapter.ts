/**
 * Portal on-chain price adapter — FALLBACK ONLY.
 *
 * Priority chain (implemented in adapters.ts):
 *   1. GMGN API       — market aggregator price
 *   2. DexScreener    — DEX pair price (post-graduation)
 *   3. Portal lastPrice field (this file)   — last actual trade price from bonding curve
 *   4. Portal reserve/supply formula        — spot price estimate (last resort)
 *
 * This adapter is NOT used as the primary price source.
 */

import { getBscPublicClient } from "./contracts";
import { TOKEN_CONFIG } from "@/config/tokenDashboard";
import type { MarketData } from "./types";

const PORTAL_ADDRESS = "0xe2ce6ab80874fa9fa2aae65d277dd6b8e65c9de0" as const;
const TOTAL_SUPPLY   = 1_000_000_000;

const PORTAL_ABI = [
  {
    inputs: [{ name: "token", type: "address" }],
    name: "getTokenV8Safe",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "exists",          type: "bool"    },  // 0
          { name: "reserve",         type: "uint256" },  // 1  BNB reserve in pool
          { name: "supply",          type: "uint256" },  // 2  tokens in circulation from curve
          { name: "createdAt",       type: "uint256" },  // 3
          { name: "status",          type: "uint256" },  // 4  0=active bonding curve
          { name: "initialReserve",  type: "uint256" },  // 5
          { name: "maxSupply",       type: "uint256" },  // 6
          { name: "k",               type: "uint256" },  // 7  constant product k
          { name: "sellableSupply",  type: "uint256" },  // 8
          { name: "field9",          type: "uint256" },  // 9
          { name: "field10",         type: "uint256" },  // 10
          { name: "field11",         type: "uint256" },  // 11
          { name: "buyFeeBps",       type: "uint256" },  // 12
          { name: "sellFeeBps",      type: "uint256" },  // 13
          { name: "field14",         type: "uint256" },  // 14
          { name: "lastPrice",       type: "uint256" },  // 15  last trade price in wei/token
          { name: "field16",         type: "uint256" },  // 16
          { name: "field17",         type: "uint256" },  // 17
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const COINGECKO_BNB_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd";

let _cachedBnbPrice: { price: number; ts: number } | null = null;

export async function fetchBnbUsdPrice(): Promise<number> {
  if (_cachedBnbPrice && Date.now() - _cachedBnbPrice.ts < 120_000) {
    return _cachedBnbPrice.price;
  }
  try {
    const res = await fetch(COINGECKO_BNB_PRICE_URL, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    const price = data?.binancecoin?.usd;
    if (typeof price === "number" && price > 0) {
      _cachedBnbPrice = { price, ts: Date.now() };
      return price;
    }
  } catch {}
  return _cachedBnbPrice?.price ?? 600;
}

export interface PortalTokenInfo {
  exists:             boolean;
  reserveBnb:         number;
  supplyOnCurve:      number;
  buyFeeBps:          number;
  sellFeeBps:         number;
  status:             number;
  /** Last actual trade price from Portal (preferred over formula) */
  lastPriceBnb:       number;
  /** Spot estimate: reserveBnb / supplyOnCurve (use as last resort) */
  formulaPriceBnb:    number;
  pricePerTokenUsd:   number;
  marketCapUsd:       number;
  liquidityUsd:       number;
  bnbPriceUsd:        number;
}

export async function fetchPortalTokenInfo(): Promise<PortalTokenInfo | null> {
  try {
    const client = getBscPublicClient();

    const [result, bnbPrice] = await Promise.all([
      client.readContract({
        address: PORTAL_ADDRESS,
        abi: PORTAL_ABI,
        functionName: "getTokenV8Safe",
        args: [TOKEN_CONFIG.contractAddress as `0x${string}`],
      }),
      fetchBnbUsdPrice(),
    ]);

    const raw = result as Record<string, unknown>;
    if (!raw || !raw.exists) return null;

    const reserveBnb      = Number(BigInt(raw.reserve as string)) / 1e18;
    const supplyOnCurve   = Number(BigInt(raw.supply  as string)) / 1e18;
    const lastPriceWei    = BigInt(raw.lastPrice as string);
    const buyFeeBps       = Number(BigInt(raw.buyFeeBps  as string));
    const sellFeeBps      = Number(BigInt(raw.sellFeeBps as string));
    const status          = Number(BigInt(raw.status as string));

    // lastPrice is in wei per token (1e18 = 1 BNB per token)
    const lastPriceBnb    = lastPriceWei > BigInt(0) ? Number(lastPriceWei) / 1e18 : 0;
    const formulaPriceBnb = supplyOnCurve > 0 ? reserveBnb / supplyOnCurve : 0;

    // Prefer lastPrice; fall back to formula
    const effectivePriceBnb = lastPriceBnb > 0 ? lastPriceBnb : formulaPriceBnb;
    const pricePerTokenUsd  = effectivePriceBnb * bnbPrice;
    const marketCapUsd      = pricePerTokenUsd * TOTAL_SUPPLY;
    const liquidityUsd      = reserveBnb * bnbPrice;

    return {
      exists: true,
      reserveBnb,
      supplyOnCurve,
      buyFeeBps,
      sellFeeBps,
      status,
      lastPriceBnb,
      formulaPriceBnb,
      pricePerTokenUsd,
      marketCapUsd,
      liquidityUsd,
      bnbPriceUsd: bnbPrice,
    };
  } catch (err) {
    console.warn("[PortalAdapter] getTokenV8Safe failed:", err);
    return null;
  }
}

/**
 * Returns MarketData using Portal as the data source.
 * This is called only when GMGN and DexScreener both fail.
 */
export async function fetchPortalMarketData(): Promise<MarketData> {
  const info = await fetchPortalTokenInfo();
  if (!info) {
    return nullMarketData();
  }
  return {
    currentPrice:   info.pricePerTokenUsd,
    marketCap:      info.marketCapUsd,
    liquidity:      info.liquidityUsd,
    holders:        null,
    volume24h:      null,
    priceChange24h: null,
    pairAddress:    PORTAL_ADDRESS,
    dexId:          "flap-portal",
    source:         "portal",
  };
}

function nullMarketData(): MarketData {
  return {
    currentPrice:   null,
    marketCap:      null,
    liquidity:      null,
    holders:        null,
    volume24h:      null,
    priceChange24h: null,
    pairAddress:    null,
    dexId:          null,
    source:         null,
  };
}
