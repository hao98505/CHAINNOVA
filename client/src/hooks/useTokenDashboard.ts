import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_CONFIG, VAULT_CONFIG } from "@/config/tokenDashboard";
import {
  fetchMarketData,
  fetchVaultBalances,
  fetchWalletTokenBalance,
  detectEvmWallet,
} from "@/lib/tokenDashboard/adapters";
import { readOnChainTokenMeta } from "@/lib/tokenDashboard/contracts";
import { relativeTime } from "@/lib/tokenDashboard/formatters";
import type { TokenOverview, VaultData, MyDashboardData, ReferralData, OnChainTokenMeta } from "@/lib/tokenDashboard/types";

export type { TokenOverview, VaultData, MyDashboardData, ReferralData, OnChainTokenMeta };

export function useOnChainTokenMeta() {
  return useQuery<OnChainTokenMeta>({
    queryKey: ["token-onchain-meta"],
    queryFn: readOnChainTokenMeta,
    staleTime: 5 * 60_000,
    retry: 2,
    retryDelay: 3000,
  });
}

export function useTokenOverview() {
  const { data: meta } = useOnChainTokenMeta();

  return useQuery<TokenOverview>({
    queryKey: ["token-overview", meta?.name],
    queryFn: async (): Promise<TokenOverview> => {
      const market = await fetchMarketData();
      return {
        name: meta?.name || TOKEN_CONFIG.name || TOKEN_CONFIG.contractAddress,
        symbol: meta?.symbol || TOKEN_CONFIG.symbol || "TOKEN",
        contractAddress: TOKEN_CONFIG.contractAddress,
        currentPrice: market.currentPrice,
        marketCap: market.marketCap,
        liquidity: market.liquidity,
        holders: market.holders,
        volume24h: market.volume24h,
        buyTaxPercent: TOKEN_CONFIG.buyTaxPercent,
        sellTaxPercent: TOKEN_CONFIG.sellTaxPercent,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 2,
    retryDelay: 3000,
  });
}

export function useVaults() {
  return useQuery<VaultData[]>({
    queryKey: ["token-vaults"],
    queryFn: async (): Promise<VaultData[]> => {
      const balances = await fetchVaultBalances();
      return VAULT_CONFIG.map((vc) => {
        const bal = balances.find((b) => b.id === vc.id);
        return {
          id: vc.id,
          currentBalance: bal?.formattedBalance ?? null,
          totalInflow: null,
          totalOutflow: null,
          allocationPercent: vc.allocationPercent,
          lastUpdateTime: bal?.lastFetchedAt ? relativeTime(bal.lastFetchedAt) : null,
        };
      });
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 2,
    retryDelay: 3000,
  });
}

export function useMyTokenDashboard() {
  const { publicKey, connected } = useWallet();
  const solanaAddress = connected ? (publicKey?.toBase58() ?? null) : null;

  return useQuery<MyDashboardData>({
    queryKey: ["token-my-dashboard"],
    queryFn: async (): Promise<MyDashboardData> => {
      const evm = await detectEvmWallet();

      let balance: number | null = null;
      let eligible: boolean | null = null;

      if (evm.address && evm.isOnBsc) {
        const result = await fetchWalletTokenBalance(evm.address);
        if (result) {
          balance = result.formatted;
          eligible = result.formatted >= TOKEN_CONFIG.holdingThreshold;
        }
      }

      return {
        solanaAddress,
        evmAddress: evm.address,
        evmChainId: evm.chainId,
        evmChainName: evm.chainName,
        isOnBsc: evm.isOnBsc,
        balance,
        eligible,
        holdingWeight: null,
        timeMultiplier: null,
        pendingBnbRewards: null,
        pendingLpRewards: null,
        pendingReferralCommission: null,
        claimableHolderReward: null,
        earnedLP: null,
        pendingReferral: null,
      };
    },
    enabled: true,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}

export function useReferralData() {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58();

  return useQuery<ReferralData>({
    queryKey: ["token-referral", walletAddress],
    queryFn: async (): Promise<ReferralData> => {
      return {
        inviteCode: null,
        directReferrals: null,
        qualifiedVolume: null,
        pendingReview: null,
        claimableCommission: null,
        history: [],
      };
    },
    enabled: connected && !!walletAddress,
    staleTime: 30_000,
  });
}
