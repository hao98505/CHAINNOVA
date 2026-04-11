import { TOKEN_CONFIG, VAULT_CONFIG } from "@/config/tokenDashboard";
import { readTokenBalance } from "./contracts";
import { formatTokenAmount } from "./formatters";
import { fetchPortalMarketData } from "./portalAdapter";
import type { MarketData, VaultBalance, EvmWalletInfo, DexScreenerResponse } from "./types";

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens";

const EVM_CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  56: "BNB Smart Chain",
  137: "Polygon",
  42161: "Arbitrum One",
  10: "Optimism",
  43114: "Avalanche",
  250: "Fantom",
  8453: "Base",
};

export async function fetchMarketData(): Promise<MarketData> {
  const portalData = await fetchPortalMarketData();
  if (portalData.currentPrice != null) {
    return portalData;
  }

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

export async function detectEvmWallet(): Promise<EvmWalletInfo> {
  const none: EvmWalletInfo = { address: null, chainId: null, chainName: null, isOnBsc: false };

  if (typeof window === "undefined" || !window.ethereum) return none;

  try {
    const accounts = (await window.ethereum.request({
      method: "eth_accounts",
    })) as string[];

    if (!accounts || accounts.length === 0) return none;

    const address = accounts[0];
    const rawChainId = (await window.ethereum.request({
      method: "eth_chainId",
    })) as string;

    const chainId = parseInt(rawChainId, 16);
    const chainName = EVM_CHAIN_NAMES[chainId] || `Chain ${chainId}`;
    const isOnBsc = chainId === TOKEN_CONFIG.chainId;

    return { address, chainId, chainName, isOnBsc };
  } catch {
    return none;
  }
}
