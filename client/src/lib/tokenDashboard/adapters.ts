import { TOKEN_CONFIG, VAULT_CONFIG } from "@/config/tokenDashboard";
import { readBnbBalance } from "./contracts";
import { fetchPortalMarketData } from "./portalAdapter";
import type { MarketData, VaultBalance, EvmWalletInfo, DexScreenerResponse } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens";

/**
 * GMGN public quotation endpoint.
 * Returns: { code, msg, data: { price, market_cap, ... } }
 */
const GMGN_API = `https://gmgn.ai/defi/quotation/v1/tokens/bsc/${TOKEN_CONFIG.contractAddress}`;

const EVM_CHAIN_NAMES: Record<number, string> = {
  1:     "Ethereum",
  56:    "BNB Smart Chain",
  137:   "Polygon",
  42161: "Arbitrum One",
  10:    "Optimism",
  43114: "Avalanche",
  250:   "Fantom",
  8453:  "Base",
};

// ─── Price chain: GMGN → DexScreener → Portal ────────────────────────────────

/**
 * Try GMGN API first.
 * GMGN aggregates real trade data (including bonding curve).
 * If CORS or 4xx, returns null.
 */
async function tryGmgn(): Promise<MarketData | null> {
  try {
    const res = await fetch(GMGN_API, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    // GMGN response shape: { code: 0, data: { price: "...", market_cap: ..., ... } }
    const d = json?.data;
    if (!d) return null;

    const price = d.price      != null ? parseFloat(d.price)      : null;
    const mcap  = d.market_cap != null ? parseFloat(d.market_cap) : null;
    const liq   = d.liquidity  != null ? parseFloat(d.liquidity)  : null;

    if (!price || price <= 0) return null;

    return {
      currentPrice:   price,
      marketCap:      mcap,
      liquidity:      liq,
      holders:        d.holder_count ?? null,
      volume24h:      d.volume_24h   ?? null,
      priceChange24h: d.price_change_percent_24h ?? null,
      pairAddress:    null,
      dexId:          "gmgn",
      source:         "gmgn",
    };
  } catch {
    return null;
  }
}

/**
 * Try DexScreener (useful post-graduation when a DEX pair exists).
 */
async function tryDexScreener(): Promise<MarketData | null> {
  try {
    const res = await fetch(
      `${DEXSCREENER_API}/${TOKEN_CONFIG.contractAddress}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;

    const data: DexScreenerResponse = await res.json();
    if (!data.pairs || data.pairs.length === 0) return null;

    const bscPairs = data.pairs.filter((p) => p.chainId === "bsc");
    const pair     = bscPairs.length > 0 ? bscPairs[0] : data.pairs[0];

    const price = pair.priceUsd ? parseFloat(pair.priceUsd) : null;
    if (!price || price <= 0) return null;

    return {
      currentPrice:   price,
      marketCap:      pair.marketCap ?? pair.fdv ?? null,
      liquidity:      pair.liquidity?.usd ?? null,
      holders:        null,
      volume24h:      pair.volume?.h24 ?? null,
      priceChange24h: pair.priceChange?.h24 ?? null,
      pairAddress:    pair.pairAddress,
      dexId:          pair.dexId,
      source:         "dexscreener",
    };
  } catch {
    return null;
  }
}

/**
 * Fetch market data with priority: GMGN → DexScreener → Portal on-chain.
 * Never surfaces Portal bonding curve formula as the primary displayed price.
 */
export async function fetchMarketData(): Promise<MarketData> {
  // 1. GMGN
  const gmgn = await tryGmgn();
  if (gmgn) return gmgn;

  // 2. DexScreener
  const dex = await tryDexScreener();
  if (dex) return dex;

  // 3. Portal on-chain (lastPrice field, falling back to reserve/supply formula)
  return fetchPortalMarketData();
}

// ─── Vault BNB balances ───────────────────────────────────────────────────────

/**
 * Reads the NATIVE BNB balance (eth_getBalance) for each vault.
 * HolderDividend and LPRewardVault hold BNB, not CNOVA.
 * Vaults with empty addresses are skipped (returns null balance).
 */
export async function fetchVaultBalances(): Promise<VaultBalance[]> {
  const now = Date.now();

  const results = await Promise.allSettled(
    VAULT_CONFIG.map(async (vault) => {
      if (!vault.address) {
        return {
          id: vault.id,
          address: vault.address,
          rawBalance: null,
          formattedBalance: null,
          lastFetchedAt: now,
        } satisfies VaultBalance;
      }

      // All Phase 1 vaults hold BNB natively
      const rawBnb = await readBnbBalance(vault.address);
      return {
        id:               vault.id,
        address:          vault.address,
        rawBalance:       rawBnb,
        formattedBalance: Number(rawBnb) / 1e18,
        lastFetchedAt:    now,
      } satisfies VaultBalance;
    }),
  );

  return VAULT_CONFIG.map((vault, i) => {
    const result = results[i];
    if (result.status === "fulfilled") return result.value;
    return {
      id:               vault.id,
      address:          vault.address,
      rawBalance:       null,
      formattedBalance: null,
      lastFetchedAt:    now,
    };
  });
}

// ─── Wallet token balance ──────────────────────────────────────────────────────

import { readTokenBalance } from "./contracts";
import { formatTokenAmount } from "./formatters";

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

// ─── EVM wallet detection ─────────────────────────────────────────────────────

export async function detectEvmWallet(): Promise<EvmWalletInfo> {
  const none: EvmWalletInfo = { address: null, chainId: null, chainName: null, isOnBsc: false };

  if (typeof window === "undefined" || !window.ethereum) return none;

  try {
    const accounts = (await window.ethereum.request({
      method: "eth_accounts",
    })) as string[];

    if (!accounts || accounts.length === 0) return none;

    const address    = accounts[0];
    const rawChainId = (await window.ethereum.request({
      method: "eth_chainId",
    })) as string;

    const chainId   = parseInt(rawChainId, 16);
    const chainName = EVM_CHAIN_NAMES[chainId] || `Chain ${chainId}`;
    const isOnBsc   = chainId === TOKEN_CONFIG.chainId;

    return { address, chainId, chainName, isOnBsc };
  } catch {
    return none;
  }
}
