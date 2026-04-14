export interface MarketData {
  currentPrice:   number | null;
  marketCap:      number | null;
  liquidity:      number | null;
  holders:        number | null;
  volume24h:      number | null;
  priceChange24h: number | null;
  pairAddress:    string | null;
  dexId:          string | null;
  /** Which data source produced this data */
  source:         "gmgn" | "dexscreener" | "portal" | null;
}

export interface VaultBalance {
  id:               string;
  address:          string;
  rawBalance:       bigint | null;  // native BNB in wei
  formattedBalance: number | null;  // BNB (not CNOVA)
  lastFetchedAt:    number;
}

export interface TokenOverview {
  name:            string;
  symbol:          string;
  contractAddress: string;
  currentPrice:    number | null;
  marketCap:       number | null;
  liquidity:       number | null;
  holders:         number | null;
  volume24h:       number | null;
  buyTaxPercent:   number;
  sellTaxPercent:  number;
  priceSource:     "gmgn" | "dexscreener" | "portal" | null;
}

export interface VaultData {
  id:                string;
  currentBalance:    number | null;  // BNB, not CNOVA
  totalInflow:       number | null;
  totalOutflow:      number | null;
  allocationPercent: number;
  lastUpdateTime:    string | null;
}

export interface EvmWalletInfo {
  address:   string | null;
  chainId:   number | null;
  chainName: string | null;
  isOnBsc:   boolean;
}

export interface MyDashboardData {
  solanaAddress:             string | null;
  evmAddress:                string | null;
  evmChainId:                number | null;
  evmChainName:              string | null;
  isOnBsc:                   boolean;
  balance:                   number | null;
  eligible:                  boolean | null;
  holdingWeight:             number | null;
  timeMultiplier:            number | null;
  pendingBnbRewards:         number | null;
  pendingLpRewards:          number | null;
  pendingReferralCommission: number | null;
  claimableHolderReward:     number | null;
  earnedLP:                  number | null;
  pendingReferral:           number | null;
}

export interface HolderDividendData {
  /** null when contract not deployed */
  contractDeployed:   boolean;
  registered:         boolean;
  registeredBalance:  number;      // CNOVA
  holdingSeconds:     number;
  currentWeightWei:   bigint;
  weightSharePct:     number;      // 0–100
  pendingBnb:         number;      // BNB
  totalClaimed:       number;      // BNB
}

export interface ReferralData {
  inviteCode:           string | null;
  directReferrals:      number | null;
  qualifiedVolume:      number | null;
  pendingReview:        number | null;
  claimableCommission:  number | null;
  history:              Array<{ date: string; amount: number; status: string }>;
}

export interface OnChainTokenMeta {
  name:     string;
  symbol:   string;
  decimals: number;
}

export interface RewardContractAddresses {
  dividendContract:      string;
  masterVault:           string;
  bottomProtectionVault: string;
}

export interface DexScreenerPair {
  chainId:     string;
  dexId:       string;
  pairAddress: string;
  baseToken:   { address: string; name: string; symbol: string };
  quoteToken:  { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd:    string;
  volume:      { h24: number };
  liquidity:   { usd: number };
  fdv:         number;
  marketCap:   number;
  priceChange: { h24: number };
}

export interface DexScreenerResponse {
  pairs: DexScreenerPair[] | null;
}
