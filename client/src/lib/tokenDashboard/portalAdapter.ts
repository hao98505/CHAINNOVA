import { getBscPublicClient } from "./contracts";
import { TOKEN_CONFIG } from "@/config/tokenDashboard";
import type { MarketData } from "./types";

const PORTAL_ADDRESS = "0xe2ce6ab80874fa9fa2aae65d277dd6b8e65c9de0" as const;
const TOTAL_SUPPLY = 1_000_000_000;

const PORTAL_ABI = [
  {
    inputs: [{ name: "token", type: "address" }],
    name: "getTokenV8Safe",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "exists", type: "bool" },
          { name: "reserve", type: "uint256" },
          { name: "supply", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "status", type: "uint256" },
          { name: "initialReserve", type: "uint256" },
          { name: "maxSupply", type: "uint256" },
          { name: "k", type: "uint256" },
          { name: "sellableSupply", type: "uint256" },
          { name: "field9", type: "uint256" },
          { name: "field10", type: "uint256" },
          { name: "field11", type: "uint256" },
          { name: "buyFeeBps", type: "uint256" },
          { name: "sellFeeBps", type: "uint256" },
          { name: "field14", type: "uint256" },
          { name: "lastPrice", type: "uint256" },
          { name: "field16", type: "uint256" },
          { name: "field17", type: "uint256" },
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

async function fetchBnbUsdPrice(): Promise<number> {
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
  exists: boolean;
  reserveBnb: number;
  supplyOnCurve: number;
  buyFeeBps: number;
  sellFeeBps: number;
  status: number;
  pricePerTokenBnb: number;
  pricePerTokenUsd: number;
  marketCapUsd: number;
  liquidityUsd: number;
  bnbPriceUsd: number;
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

    const raw = result as any;
    if (!raw || !raw.exists) return null;

    const reserveWei = BigInt(raw.reserve);
    const supplyWei = BigInt(raw.supply);
    const buyFeeBps = Number(BigInt(raw.buyFeeBps));
    const sellFeeBps = Number(BigInt(raw.sellFeeBps));
    const status = Number(BigInt(raw.status));

    const reserveBnb = Number(reserveWei) / 1e18;
    const supplyOnCurve = Number(supplyWei) / 1e18;

    const pricePerTokenBnb =
      supplyOnCurve > 0 ? reserveBnb / supplyOnCurve : 0;
    const pricePerTokenUsd = pricePerTokenBnb * bnbPrice;
    const marketCapUsd = pricePerTokenUsd * TOTAL_SUPPLY;
    const liquidityUsd = reserveBnb * bnbPrice;

    return {
      exists: true,
      reserveBnb,
      supplyOnCurve,
      buyFeeBps,
      sellFeeBps,
      status,
      pricePerTokenBnb,
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

export async function fetchPortalMarketData(): Promise<MarketData> {
  const info = await fetchPortalTokenInfo();
  if (!info) {
    return {
      currentPrice: null,
      marketCap: null,
      liquidity: null,
      holders: null,
      volume24h: null,
      priceChange24h: null,
      pairAddress: null,
      dexId: null,
    };
  }

  return {
    currentPrice: info.pricePerTokenUsd,
    marketCap: info.marketCapUsd,
    liquidity: info.liquidityUsd,
    holders: null,
    volume24h: null,
    priceChange24h: null,
    pairAddress: PORTAL_ADDRESS,
    dexId: "flap-portal",
  };
}
