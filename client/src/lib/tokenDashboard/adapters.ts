import { TOKEN_CONFIG, VAULT_CONFIG } from "@/config/tokenDashboard";
import { readTokenBalance } from "./contracts";
import { formatTokenAmount } from "./formatters";
import type { MarketData, VaultBalance, DexScreenerResponse } from "./types";

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens";

export async function fetchMarketData(): Promise<MarketData> {
  try {
    const res = await fetch(
      `${DEXSCREENER_API}/${TOKEN_CONFIG.contractAddress}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) throw new Error(`DexScreener ${res.status}`);

    const data: DexScreenerResponse = await res.json();
    if (!data.pairs || data.pairs.length === 0) {
      return nullMarketData();
    }

    const bscPairs = data.pairs.filter((p) => p.chainId === "bsc");
    const pair = bscPairs.length > 0 ? bscPairs[0] : data.pairs[0];

    return {
      currentPrice: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
      marketCap: pair.marketCap ?? pair.fdv ?? null,
      liquidity: pair.liquidity?.usd ?? null,
      holders: null,
      volume24h: pair.volume?.h24 ?? null,
      priceChange24h: pair.priceChange?.h24 ?? null,
      pairAddress: pair.pairAddress,
      dexId: pair.dexId,
    };
  } catch {
    return nullMarketData();
  }
}

function nullMarketData(): MarketData {
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

export async function fetchVaultBalances(): Promise<VaultBalance[]> {
  const now = Date.now();

  const results = await Promise.allSettled(
    VAULT_CONFIG.map(async (vault) => {
      const raw = await readTokenBalance(vault.address);
      return {
        id: vault.id,
        address: vault.address,
        rawBalance: raw,
        formattedBalance: formatTokenAmount(raw, TOKEN_CONFIG.decimals),
        lastFetchedAt: now,
      } satisfies VaultBalance;
    }),
  );

  return VAULT_CONFIG.map((vault, i) => {
    const result = results[i];
    if (result.status === "fulfilled") return result.value;
    return {
      id: vault.id,
      address: vault.address,
      rawBalance: null,
      formattedBalance: null,
      lastFetchedAt: now,
    };
  });
}

export async function fetchWalletTokenBalance(
  walletAddress: string,
): Promise<{ raw: bigint; formatted: number } | null> {
  try {
    const raw = await readTokenBalance(walletAddress);
    return {
      raw,
      formatted: formatTokenAmount(raw, TOKEN_CONFIG.decimals),
    };
  } catch {
    return null;
  }
}
