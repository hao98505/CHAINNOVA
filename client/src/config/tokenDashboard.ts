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
  buyUrl: "",
  chartUrl: "",
  buyTaxPercent: 3,
  sellTaxPercent: 6,
  holdingThreshold: 200_000,
  githubUrl: "https://github.com/hao98505/CHAINNOVA",
};

export const VAULT_CONTRACT_CONFIG = {
  dividendContract: "",
  masterVault: "",
  lpRewardVault: "",
  referralVault: "",
  marketingVault: "",
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
