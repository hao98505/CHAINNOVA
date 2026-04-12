export const TOKEN_CONFIG = {
  name: "",
  symbol: "",
  decimals: 18,
  contractAddress: "0x0a9c2e3cda80a828334bfa2577a75a85229f7777",
  chain: "BSC",
  chainId: 56,
  rpcUrl: "https://bsc-rpc.publicnode.com",
  explorerUrl: "https://bscscan.com/token/0x0a9c2e3cda80a828334bfa2577a75a85229f7777",
  explorerAddressUrl: "https://bscscan.com/address",
  dexScreenerUrl: "https://dexscreener.com/bsc/0x0a9c2e3cda80a828334bfa2577a75a85229f7777",
  /** Primary buy & chart link — GMGN aggregator */
  buyUrl:   "https://gmgn.ai/bsc/token/0x0a9c2e3cda80a828334bfa2577a75a85229f7777",
  chartUrl: "https://gmgn.ai/bsc/token/0x0a9c2e3cda80a828334bfa2577a75a85229f7777",
  portalAddress: "0xe2ce6ab80874fa9fa2aae65d277dd6b8e65c9de0",
  tradingPlatform: "Flap Portal (Bonding Curve)",
  buyTaxPercent: 3,
  sellTaxPercent: 6,
  holdingThreshold: 200_000,
  githubUrl: "https://github.com/hao98505/CHAINNOVA",
};

/**
 * Phase 1 contract addresses — fill after running scripts/deployDividend.cjs
 *
 *   dividendContract  → HolderDividend.sol   (holder registration + BNB claim)
 *   masterVault       → TaxReceiver.sol       (BNB sink from token tax)
 *   lpRewardVault     → LPRewardVault.sol     (deployed Phase 1; activated Phase 2)
 *
 * Phase 2 (post-graduation):
 *   referralVault     → ReferralVault.sol
 *   marketingVault    → MarketingVault.sol
 *
 * Deploy command:
 *   npx hardhat run scripts/deployDividend.cjs --network bsc
 */
export const VAULT_CONTRACT_CONFIG = {
  dividendContract: "",   // HolderDividend.sol — backfill after deploy
  masterVault:      "",   // TaxReceiver.sol    — backfill after deploy
  lpRewardVault:    "",   // LPRewardVault.sol  — backfill after deploy (active=false until graduation)
  referralVault:    "",   // Phase 2
  marketingVault:   "",   // Phase 2
};

/**
 * Vault display config.
 * assetType:
 *   'bnb'   → read native ETH balance (eth_getBalance)
 *   'cnova' → read ERC-20 balanceOf (legacy vaults that hold tokens)
 * phase:
 *   1  → deployed in Phase 1 deploy script
 *   2  → Phase 2 (post-graduation)
 */
export const VAULT_CONFIG = [
  {
    id: "holder-dividend",
    labelKey: "holderDividend" as const,
    address: VAULT_CONTRACT_CONFIG.dividendContract,
    allocationPercent: 60,
    color: "#A78BFA",
    icon: "Users" as const,
    assetType: "bnb" as const,
    phase: 1,
  },
  {
    id: "lp-reward",
    labelKey: "lpReward" as const,
    address: VAULT_CONTRACT_CONFIG.lpRewardVault,
    allocationPercent: 30,
    color: "#34D399",
    icon: "Droplets" as const,
    assetType: "bnb" as const,
    phase: 1,       // deployed Phase 1, activated Phase 2
  },
  {
    id: "referral-commission",
    labelKey: "referralCommission" as const,
    address: VAULT_CONTRACT_CONFIG.referralVault,
    allocationPercent: 7,
    color: "#60A5FA",
    icon: "Link" as const,
    assetType: "bnb" as const,
    phase: 2,
  },
  {
    id: "marketing-budget",
    labelKey: "marketingBudget" as const,
    address: VAULT_CONTRACT_CONFIG.marketingVault,
    allocationPercent: 3,
    color: "#FBBF24",
    icon: "Megaphone" as const,
    assetType: "bnb" as const,
    phase: 2,
  },
];

export const TRANSPARENCY_CONFIG = {
  tokenContract: TOKEN_CONFIG.contractAddress,
  vaultAddresses: VAULT_CONFIG.map((v) => ({ label: v.labelKey, address: v.address })),
  vaultContracts: {
    dividendContract: VAULT_CONTRACT_CONFIG.dividendContract,
    masterVault:      VAULT_CONTRACT_CONFIG.masterVault,
    lpRewardVault:    VAULT_CONTRACT_CONFIG.lpRewardVault,
    referralVault:    VAULT_CONTRACT_CONFIG.referralVault,
    marketingVault:   VAULT_CONTRACT_CONFIG.marketingVault,
  },
  marketingMultisig:  "",
  reimbursementVault: "",
  githubSource:   TOKEN_CONFIG.githubUrl,
  auditStatus:    "pending" as "pending" | "completed" | "in-progress",
  mintable:       false,
  taxMutable:     false,
  adminWithdrawal: false,
};

export const MECHANISM_FLOW_STEPS = [
  { id: "buy-sell",   labelKey: "buySell"           as const },
  { id: "tax",        labelKey: "taxCollection"      as const },
  { id: "vaults",     labelKey: "vaultDistribution"  as const },
  { id: "rewards",    labelKey: "rewardPayout"       as const },
];

export type VaultId       = typeof VAULT_CONFIG[number]["id"];
export type VaultLabelKey = typeof VAULT_CONFIG[number]["labelKey"];
export type VaultAsset    = typeof VAULT_CONFIG[number]["assetType"];
