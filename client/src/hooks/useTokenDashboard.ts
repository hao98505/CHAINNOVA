import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_CONFIG, VAULT_CONFIG } from "@/config/tokenDashboard";
import { fetchMarketData, fetchVaultBalances, fetchWalletTokenBalance } from "@/lib/tokenDashboard/adapters";
import { relativeTime } from "@/lib/tokenDashboard/formatters";
import type { TokenOverview, VaultData, MyDashboardData, ReferralData } from "@/lib/tokenDashboard/types";

export type { TokenOverview, VaultData, MyDashboardData, ReferralData };

export function useTokenOverview() {
  return useQuery<TokenOverview>({
    queryKey: ["token-overview"],
    queryFn: async (): Promise<TokenOverview> => {
      const market = await fetchMarketData();
      return {
        name: TOKEN_CONFIG.name,
        symbol: TOKEN_CONFIG.symbol,
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
  const walletAddress = publicKey?.toBase58();

  return useQuery<MyDashboardData>({
    queryKey: ["token-my-dashboard", walletAddress],
    queryFn: async (): Promise<MyDashboardData> => {
      return {
        balance: null,
        eligible: null,
        holdingWeight: null,
        timeMultiplier: null,
        pendingBnbRewards: null,
        pendingLpRewards: null,
        pendingReferralCommission: null,
      };
    },
    enabled: connected && !!walletAddress,
    staleTime: 10_000,
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
