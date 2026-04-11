import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_CONFIG, VAULT_CONFIG } from "@/config/tokenDashboard";

export interface TokenOverview {
  name: string;
  symbol: string;
  contractAddress: string;
  currentPrice: number | null;
  marketCap: number | null;
  liquidity: number | null;
  holders: number | null;
  volume24h: number | null;
  buyTaxPercent: number;
  sellTaxPercent: number;
}

export interface VaultData {
  id: string;
  currentBalance: number | null;
  totalInflow: number | null;
  totalOutflow: number | null;
  allocationPercent: number;
  lastUpdateTime: string | null;
}

export interface MyDashboardData {
  balance: number | null;
  eligible: boolean | null;
  holdingWeight: number | null;
  timeMultiplier: number | null;
  pendingBnbRewards: number | null;
  pendingLpRewards: number | null;
  pendingReferralCommission: number | null;
}

export interface ReferralData {
  inviteCode: string | null;
  directReferrals: number | null;
  qualifiedVolume: number | null;
  pendingReview: number | null;
  claimableCommission: number | null;
  history: Array<{ date: string; amount: number; status: string }>;
}

export function useTokenOverview() {
  return useQuery<TokenOverview>({
    queryKey: ["/api/token/overview"],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 300));
      return {
        name: TOKEN_CONFIG.name,
        symbol: TOKEN_CONFIG.symbol,
        contractAddress: TOKEN_CONFIG.contractAddress,
        currentPrice: null,
        marketCap: null,
        liquidity: null,
        holders: null,
        volume24h: null,
        buyTaxPercent: TOKEN_CONFIG.buyTaxPercent,
        sellTaxPercent: TOKEN_CONFIG.sellTaxPercent,
      };
    },
    staleTime: 30000,
  });
}

export function useVaults() {
  return useQuery<VaultData[]>({
    queryKey: ["/api/token/vaults"],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 300));
      return VAULT_CONFIG.map((v) => ({
        id: v.id,
        currentBalance: null,
        totalInflow: null,
        totalOutflow: null,
        allocationPercent: v.allocationPercent,
        lastUpdateTime: null,
      }));
    },
    staleTime: 30000,
  });
}

export function useMyTokenDashboard() {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58();

  return useQuery<MyDashboardData>({
    queryKey: ["/api/token/my-dashboard", walletAddress],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 300));
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
    staleTime: 10000,
  });
}

export function useReferralData() {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58();

  return useQuery<ReferralData>({
    queryKey: ["/api/token/referral", walletAddress],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 300));
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
    staleTime: 30000,
  });
}
