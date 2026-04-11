export interface MarketData {
  currentPrice: number | null;
  marketCap: number | null;
  liquidity: number | null;
  holders: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
  pairAddress: string | null;
  dexId: string | null;
}

export interface VaultBalance {
  id: string;
  address: string;
  rawBalance: bigint | null;
  formattedBalance: number | null;
  lastFetchedAt: number;
}

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

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  volume: { h24: number };
  liquidity: { usd: number };
  fdv: number;
  marketCap: number;
  priceChange: { h24: number };
}

export interface DexScreenerResponse {
  pairs: DexScreenerPair[] | null;
}
