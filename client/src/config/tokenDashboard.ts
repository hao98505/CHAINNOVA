export const TOKEN_CONFIG = {
  name: "ForgAI",
  symbol: "FORGAI",
  decimals: 18,
  contractAddress: "0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff",
  chain: "BSC",
  chainId: 56,
  explorerUrl: "https://bscscan.com/token/0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff",
  buyTaxPercent: 3,
  sellTaxPercent: 6,
  holdingThreshold: 200_000,
  githubUrl: "https://github.com/hao98505/CHAINNOVA",
};

export const VAULT_CONFIG = [
  {
    id: "holder-dividend",
    labelKey: "holderDividend" as const,
    address: "0x0000000000000000000000000000000000000001",
    allocationPercent: 30,
    color: "#A78BFA",
    icon: "Users" as const,
  },
  {
    id: "lp-reward",
    labelKey: "lpReward" as const,
    address: "0x0000000000000000000000000000000000000002",
    allocationPercent: 30,
    color: "#34D399",
    icon: "Droplets" as const,
  },
  {
    id: "referral-commission",
    labelKey: "referralCommission" as const,
    address: "0x0000000000000000000000000000000000000003",
    allocationPercent: 30,
    color: "#60A5FA",
    icon: "Link" as const,
  },
  {
    id: "marketing-budget",
    labelKey: "marketingBudget" as const,
    address: "0x0000000000000000000000000000000000000004",
    allocationPercent: 10,
    color: "#FBBF24",
    icon: "Megaphone" as const,
  },
];

export const TRANSPARENCY_CONFIG = {
  tokenContract: TOKEN_CONFIG.contractAddress,
  vaultAddresses: VAULT_CONFIG.map((v) => ({ label: v.labelKey, address: v.address })),
  marketingMultisig: "0x0000000000000000000000000000000000000005",
  reimbursementVault: "0x0000000000000000000000000000000000000006",
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
