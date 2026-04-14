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
 * Contract addresses — backfill after running scripts/deployDividend.cjs
 *
 * Tax model (v2 — three-route, 40/30/30):
 *   dividendContract      → HolderDividend.sol   (40 % of tax BNB)
 *   bottomProtectionVault → BottomProtectionVault.sol (30 % of tax BNB)
 *   masterVault           → TaxReceiver.sol v2   (BNB sink that routes 40/30/30)
 *
 * Studio wallet (30 %) receives BNB directly via TaxReceiver — NOT shown in UI.
 *
 * Deploy command:
 *   npx hardhat run scripts/deployDividend.cjs --network bsc
 */
export const VAULT_CONTRACT_CONFIG = {
  dividendContract:      "0xF7D702DFCe841b164661F62D851b7DE85aD9dDf0",  // HolderDividend.sol
  masterVault:           "0x8f2E4fF9CF43D8f1cF7c117870C06722919dF7F9",  // TaxReceiver.sol v2
  bottomProtectionVault: "",  // BottomProtectionVault.sol — fill after deploy
};

/**
 * Vault display config (v2 — two user-facing vaults only).
 *
 * assetType:
 *   'bnb'   → read native ETH balance (eth_getBalance)
 *
 * allocationPercent reflects the user-visible tax routing.
 * Studio 30 % is intentionally omitted from this config.
 */
export const VAULT_CONFIG = [
  {
    id: "holder-dividend",
    labelKey: "holderDividend" as const,
    address: VAULT_CONTRACT_CONFIG.dividendContract,
    allocationPercent: 40,
    color: "#A78BFA",
    icon: "Users" as const,
    assetType: "bnb" as const,
    phase: 1,
  },
  {
    id: "bottom-protection",
    labelKey: "bottomProtection" as const,
    address: VAULT_CONTRACT_CONFIG.bottomProtectionVault,
    allocationPercent: 30,
    color: "#34D399",
    icon: "Shield" as const,
    assetType: "bnb" as const,
    phase: 1,
  },
];

export const TRANSPARENCY_CONFIG = {
  tokenContract: TOKEN_CONFIG.contractAddress,
  vaultAddresses: VAULT_CONFIG.map((v) => ({ label: v.labelKey, address: v.address })),
  vaultContracts: {
    dividendContract:      VAULT_CONTRACT_CONFIG.dividendContract,
    masterVault:           VAULT_CONTRACT_CONFIG.masterVault,
    bottomProtectionVault: VAULT_CONTRACT_CONFIG.bottomProtectionVault,
  },
  githubSource:    TOKEN_CONFIG.githubUrl,
  auditStatus:     "pending" as "pending" | "completed" | "in-progress",
  mintable:        false,
  taxMutable:      false,
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
