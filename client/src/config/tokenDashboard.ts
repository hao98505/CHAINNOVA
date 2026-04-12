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
  dexScreenerUrl: `https://dexscreener.com/bsc/0x0a9c2e3cda80a828334bfa2577a75a85229f7777`,
  geckoTerminalUrl: `https://www.geckoterminal.com/bsc/tokens/0x0a9c2e3cda80a828334bfa2577a75a85229f7777`,
  buyUrl: "https://gmgn.ai/bsc/token/0x0a9c2e3cda80a828334bfa2577a75a85229f7777",
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
 *   masterVault       → TaxReceiver.sol       (single BNB sink from token tax)
 *
 * Phase 2 (post-graduation, after DEX launch):
 *   lpRewardVault     → LPRewardVault.sol     (LP staker rewards)
 *   referralVault     → ReferralVault.sol     (referral commission)
 *   marketingVault    → MarketingVault.sol    (marketing budget)
 *
 * BSC mainnet deploy order:
 *   1. npx hardhat run scripts/deployDividend.cjs --network bsc
 *   2. Copy HolderDividend address → dividendContract below
 *   3. Copy TaxReceiver address    → masterVault below
 *   4. After token graduates from Portal: set tax receiver = masterVault address
 */
export const VAULT_CONTRACT_CONFIG = {
  dividendContract: "",   // HolderDividend.sol — backfill after deploy
  masterVault: "",        // TaxReceiver.sol    — backfill after deploy
  lpRewardVault: "",      // Phase 2
  referralVault: "",      // Phase 2
  marketingVault: "",     // Phase 2
};

export const VAULT_CONFIG = [
  {
    id: "holder-dividend",
    labelKey: "holderDividend" as const,
    address: VAULT_CONTRACT_CONFIG.dividendContract,
    allocationPercent: 30,
    color: "#A78BFA",
    icon: "Users" as const,
  },
  {
    id: "lp-reward",
    labelKey: "lpReward" as const,
    address: VAULT_CONTRACT_CONFIG.lpRewardVault,
    allocationPercent: 30,
    color: "#34D399",
    icon: "Droplets" as const,
  },
  {
    id: "referral-commission",
    labelKey: "referralCommission" as const,
    address: VAULT_CONTRACT_CONFIG.referralVault,
    allocationPercent: 30,
    color: "#60A5FA",
    icon: "Link" as const,
  },
  {
    id: "marketing-budget",
    labelKey: "marketingBudget" as const,
    address: VAULT_CONTRACT_CONFIG.marketingVault,
    allocationPercent: 10,
    color: "#FBBF24",
    icon: "Megaphone" as const,
  },
];

export const TRANSPARENCY_CONFIG = {
  tokenContract: TOKEN_CONFIG.contractAddress,
  vaultAddresses: VAULT_CONFIG.map((v) => ({ label: v.labelKey, address: v.address })),
  vaultContracts: {
    dividendContract: VAULT_CONTRACT_CONFIG.dividendContract,
    masterVault: VAULT_CONTRACT_CONFIG.masterVault,
    lpRewardVault: VAULT_CONTRACT_CONFIG.lpRewardVault,
    referralVault: VAULT_CONTRACT_CONFIG.referralVault,
    marketingVault: VAULT_CONTRACT_CONFIG.marketingVault,
  },
  marketingMultisig: "",
  reimbursementVault: "",
  githubSource: TOKEN_CONFIG.githubUrl,
  auditStatus: "pending" as "pending" | "completed" | "in-progress",
  mintable: false,
  taxMutable: false,
  adminWithdrawal: false,
};

export const MECHANISM_FLOW_STEPS = [
  { id: "buy-sell", labelKey: "buySell" as const },
  { id: "tax", labelKey: "taxCollection" as const },
  { id: "vaults", labelKey: "vaultDistribution" as const },
  { id: "rewards", labelKey: "rewardPayout" as const },
];

export type VaultId = typeof VAULT_CONFIG[number]["id"];
export type VaultLabelKey = typeof VAULT_CONFIG[number]["labelKey"];
