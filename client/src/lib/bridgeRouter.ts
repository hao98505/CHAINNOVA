import type { SolanaWalletAdapter } from "./solanaBridge";
import type { BridgeQuote } from "./evmBridge";

export type ChainKey = "solana" | "bsc" | "arbitrum" | "ethereum";
export type BridgeDirection = "solana-to-evm" | "evm-to-solana" | "evm-to-evm";

export interface ChainInfo {
  key: ChainKey;
  name: string;
  shortName: string;
  type: "solana" | "evm";
  explorerUrl: string;
  disabled?: boolean;
  disabledReason?: string;
}

export const ALL_CHAINS: Record<ChainKey, ChainInfo> = {
  solana: {
    key: "solana",
    name: "Solana",
    shortName: "SOL",
    type: "solana",
    explorerUrl: "https://solscan.io",
    disabled: true,
    disabledReason: "Solana bridge upgrading to wrapped SPL model",
  },
  bsc: {
    key: "bsc",
    name: "BNB Smart Chain",
    shortName: "BSC",
    type: "evm",
    explorerUrl: "https://bscscan.com",
  },
  arbitrum: {
    key: "arbitrum",
    name: "Arbitrum One",
    shortName: "ARB",
    type: "evm",
    explorerUrl: "https://arbiscan.io",
  },
  ethereum: {
    key: "ethereum",
    name: "Ethereum",
    shortName: "ETH",
    type: "evm",
    explorerUrl: "https://etherscan.io",
  },
};

export const EVM_CHAIN_KEYS: ChainKey[] = ["bsc", "arbitrum", "ethereum"];

export function isChainDisabled(chain: ChainKey): boolean {
  return ALL_CHAINS[chain]?.disabled === true;
}

export function getBridgeDirection(from: ChainKey, to: ChainKey): BridgeDirection | null {
  if (from === to) return null;
  if (isChainDisabled(from) || isChainDisabled(to)) return null;
  if (from === "solana") return "solana-to-evm";
  if (to === "solana") return "evm-to-solana";
  return "evm-to-evm";
}

export function getValidTargets(source: ChainKey): ChainKey[] {
  if (isChainDisabled(source)) return [];
  if (source === "solana") return [];
  return EVM_CHAIN_KEYS.filter((c) => c !== source);
}

export function getSelectableSourceChains(): ChainKey[] {
  return EVM_CHAIN_KEYS;
}

export function quoteBridge(
  amount: string,
  from: ChainKey,
  to: ChainKey
): BridgeQuote {
  const parsed = parseFloat(amount) || 0;
  const feePercent = 0.3;
  const fee = parsed * (feePercent / 100);
  const receive = Math.max(parsed - fee, 0);

  const fromName = ALL_CHAINS[from]?.shortName || from;
  const toName = ALL_CHAINS[to]?.shortName || to;

  let eta = "~5-10 min";
  if (from === "bsc" && to === "arbitrum") eta = "~2-5 min";
  if (from === "bsc" && to === "ethereum") eta = "~5-15 min";
  if (from === "arbitrum" && to === "bsc") eta = "~2-5 min";
  if (from === "arbitrum" && to === "ethereum") eta = "~3-7 min";
  if (from === "ethereum" && to === "bsc") eta = "~5-15 min";
  if (from === "ethereum" && to === "arbitrum") eta = "~3-7 min";

  return {
    receiveAmount: receive.toFixed(4),
    protocolFee: `${fee.toFixed(4)} CNOVA + gas`,
    route: `${fromName} → Bridge → Relayer → ${toName}`,
    eta,
  };
}

export interface UnifiedBridgeResult {
  txHash: string;
  explorerUrl: string;
  direction: BridgeDirection;
}

export async function executeSolanaBridge(_params: {
  wallet: SolanaWalletAdapter;
  amount: string;
  decimals: number;
  targetChain: ChainKey;
  recipientEvmAddress: string;
}): Promise<UnifiedBridgeResult> {
  throw new Error("Solana bridge is upgrading to wrapped SPL model. Please use EVM↔EVM bridge.");
}

export async function executeEvmToSolanaBridge(_params: {
  fromChainKey: ChainKey;
  amount: string;
  decimals: number;
  recipientSolanaAddress: string;
}): Promise<UnifiedBridgeResult> {
  throw new Error("Solana bridge is upgrading to wrapped SPL model. Please use EVM↔EVM bridge.");
}

export async function executeEvmToEvmBridge(params: {
  fromChainKey: ChainKey;
  toChainKey: ChainKey;
  amount: string;
  decimals: number;
  recipientEvmAddress: string;
}): Promise<UnifiedBridgeResult> {
  const { bridgeEvmToEvm } = await import("./evmBridge");
  const result = await bridgeEvmToEvm({
    fromChainKey: params.fromChainKey,
    toChainKey: params.toChainKey,
    amount: params.amount,
    decimals: params.decimals,
    recipientAddress: params.recipientEvmAddress,
  });
  return {
    txHash: result.txHash,
    explorerUrl: result.explorerUrl,
    direction: "evm-to-evm",
  };
}
