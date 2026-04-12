import { useQuery } from "@tanstack/react-query";
import { TOKEN_CONFIG, VAULT_CONFIG, VAULT_CONTRACT_CONFIG } from "@/config/tokenDashboard";
import {
  fetchMarketData,
  fetchVaultBalances,
} from "@/lib/tokenDashboard/adapters";
import {
  readOnChainTokenMeta,
  readHolderDividendUserInfo,
} from "@/lib/tokenDashboard/contracts";
import { relativeTime } from "@/lib/tokenDashboard/formatters";
import type {
  TokenOverview, VaultData, MyDashboardData, ReferralData,
  OnChainTokenMeta, HolderDividendData,
} from "@/lib/tokenDashboard/types";
import { useEvmWallet } from "@/contexts/EvmWalletContext";

export type {
  TokenOverview, VaultData, MyDashboardData, ReferralData,
  OnChainTokenMeta, HolderDividendData,
};

// ─── Token meta ───────────────────────────────────────────────────────────────

export function useOnChainTokenMeta() {
  return useQuery<OnChainTokenMeta>({
    queryKey: ["token-onchain-meta"],
    queryFn:  readOnChainTokenMeta,
    staleTime: 5 * 60_000,
    retry: 2,
    retryDelay: 3000,
  });
}

// ─── Market overview (GMGN → DexScreener → Portal) ───────────────────────────

export function useTokenOverview() {
  const { data: meta } = useOnChainTokenMeta();

  return useQuery<TokenOverview>({
    queryKey: ["token-overview", meta?.name],
    queryFn: async (): Promise<TokenOverview> => {
      const market = await fetchMarketData();
      return {
        name:            meta?.name   || TOKEN_CONFIG.name   || TOKEN_CONFIG.contractAddress,
        symbol:          meta?.symbol || TOKEN_CONFIG.symbol || "TOKEN",
        contractAddress: TOKEN_CONFIG.contractAddress,
        currentPrice:    market.currentPrice,
        marketCap:       market.marketCap,
        liquidity:       market.liquidity,
        holders:         market.holders,
        volume24h:       market.volume24h,
        buyTaxPercent:   TOKEN_CONFIG.buyTaxPercent,
        sellTaxPercent:  TOKEN_CONFIG.sellTaxPercent,
        priceSource:     market.source,
      };
    },
    staleTime:       30_000,
    refetchInterval: 60_000,
    retry: 2,
    retryDelay: 3000,
  });
}

// ─── Vault BNB balances ───────────────────────────────────────────────────────

export function useVaults() {
  return useQuery<VaultData[]>({
    queryKey: ["token-vaults"],
    queryFn: async (): Promise<VaultData[]> => {
      const balances = await fetchVaultBalances();
      return VAULT_CONFIG.map((vc) => {
        const bal = balances.find((b) => b.id === vc.id);
        return {
          id:                vc.id,
          currentBalance:    bal?.formattedBalance ?? null,  // BNB
          totalInflow:       null,
          totalOutflow:      null,
          allocationPercent: vc.allocationPercent,
          lastUpdateTime:    bal?.lastFetchedAt ? relativeTime(bal.lastFetchedAt) : null,
        };
      });
    },
    staleTime:       30_000,
    refetchInterval: 60_000,
    retry: 2,
    retryDelay: 3000,
  });
}

// ─── HolderDividend live data for connected wallet ───────────────────────────

/**
 * Reads all 7 user-facing fields from the HolderDividend contract.
 * Returns nulls when contract not yet deployed (address empty).
 * Refetches every 30 seconds.
 */
export function useHolderDividend() {
  const evm = useEvmWallet();
  const contractDeployed = !!VAULT_CONTRACT_CONFIG.dividendContract;

  return useQuery<HolderDividendData>({
    queryKey: ["holder-dividend", evm.address, contractDeployed],
    queryFn: async (): Promise<HolderDividendData> => {
      if (!evm.address || !contractDeployed) {
        return {
          contractDeployed,
          registered:        false,
          registeredBalance: 0,
          holdingSeconds:    0,
          currentWeightWei:  BigInt(0),
          weightSharePct:    0,
          pendingBnb:        0,
          totalClaimed:      0,
        };
      }

      const info = await readHolderDividendUserInfo(evm.address);
      if (!info) {
        return {
          contractDeployed: true,
          registered:        false,
          registeredBalance: 0,
          holdingSeconds:    0,
          currentWeightWei:  BigInt(0),
          weightSharePct:    0,
          pendingBnb:        0,
          totalClaimed:      0,
        };
      }

      return {
        contractDeployed:  true,
        registered:        info.registered,
        registeredBalance: Number(info.registeredBalance) / 1e18,
        holdingSeconds:    Number(info.holdingSeconds),
        currentWeightWei:  info.currentWeightWei,
        weightSharePct:    info.weightSharePct,
        pendingBnb:        Number(info.pendingBnb) / 1e18,
        totalClaimed:      Number(info.userTotalClaimed) / 1e18,
      };
    },
    enabled:         !!evm.address || !contractDeployed,
    staleTime:       15_000,
    refetchInterval: 30_000,
    retry: 1,
    retryDelay: 3000,
  });
}

// ─── My dashboard composite ───────────────────────────────────────────────────

export function useMyTokenDashboard() {
  const evm = useEvmWallet();

  return useQuery<MyDashboardData>({
    queryKey: ["token-my-dashboard", evm.address, evm.chainId],
    queryFn: async (): Promise<MyDashboardData> => {
      return {
        solanaAddress:             null,
        evmAddress:                evm.address,
        evmChainId:                evm.chainId,
        evmChainName:              evm.chainName,
        isOnBsc:                   evm.isOnBsc,
        balance:                   evm.balance,
        eligible:                  evm.eligible,
        holdingWeight:             null,
        timeMultiplier:            null,
        pendingBnbRewards:         null,
        pendingLpRewards:          null,
        pendingReferralCommission: null,
        claimableHolderReward:     null,
        earnedLP:                  null,
        pendingReferral:           null,
      };
    },
    enabled:         !!evm.address,
    staleTime:       15_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}

// ─── Referral (Phase 2 stub) ──────────────────────────────────────────────────

export function useReferralData() {
  const evm = useEvmWallet();

  return useQuery<ReferralData>({
    queryKey: ["token-referral", evm.address],
    queryFn: async (): Promise<ReferralData> => ({
      inviteCode:          null,
      directReferrals:     null,
      qualifiedVolume:     null,
      pendingReview:       null,
      claimableCommission: null,
      history:             [],
    }),
    enabled:   !!evm.address,
    staleTime: 30_000,
  });
}
