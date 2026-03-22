import type { SolanaWalletAdapter } from "./solanaBridge";
import type { BridgeQuote } from "./evmBridge";

export type ChainKey = "solana" | "bsc" | "arbitrum" | "ethereum";
export type BridgeDirection = "solana-to-evm" | "evm-to-solana";

export interface ChainInfo {
  key: ChainKey;
  name: string;
  shortName: string;
  type: "solana" | "evm";
  explorerUrl: string;
}

export const ALL_CHAINS: Record<ChainKey, ChainInfo> = {
  solana: {
    key: "solana",
    name: "Solana",
    shortName: "SOL",
    type: "solana",
    explorerUrl: "https://solscan.io",
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

export function getBridgeDirection(from: ChainKey, to: ChainKey): BridgeDirection | null {
  if (from === to) return null;
  if (from === "solana") return "solana-to-evm";
  if (to === "solana") return "evm-to-solana";
  return null;
}

export function getValidTargets(source: ChainKey): ChainKey[] {
  if (source === "solana") return ["bsc", "arbitrum", "ethereum"];
  return ["solana"];
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
  if (from === "solana" && to === "bsc") eta = "~2-5 min";
  if (from === "solana" && to === "arbitrum") eta = "~3-7 min";
  if (from === "solana" && to === "ethereum") eta = "~5-15 min";
  if (from === "bsc" && to === "solana") eta = "~2-5 min";
  if (from === "arbitrum" && to === "solana") eta = "~3-7 min";
  if (from === "ethereum" && to === "solana") eta = "~5-15 min";

  return {
    receiveAmount: receive.toFixed(4),
    protocolFee: `${fee.toFixed(4)} ForgAI + gas`,
    route: `${fromName} → Custodial Bridge → ${toName}`,
    eta,
  };
}

export interface UnifiedBridgeResult {
  txHash: string;
  explorerUrl: string;
  direction: BridgeDirection;
}

export async function executeSolanaBridge(params: {
  wallet: SolanaWalletAdapter;
  amount: string;
  decimals: number;
  targetChain: ChainKey;
  recipientEvmAddress: string;
}): Promise<UnifiedBridgeResult> {
  const { initiateSolanaDeposit } = await import("./solanaBridge");
  const result = await initiateSolanaDeposit({
    wallet: params.wallet,
    amount: params.amount,
    decimals: params.decimals,
    targetChain: params.targetChain,
    recipientEvmAddress: params.recipientEvmAddress,
  });
  return {
    txHash: result.signature,
    explorerUrl: result.explorerUrl,
    direction: "solana-to-evm",
  };
}

export async function executeEvmToSolanaBridge(params: {
  fromChainKey: ChainKey;
  amount: string;
  decimals: number;
  recipientSolanaAddress: string;
}): Promise<UnifiedBridgeResult> {
  const { EVM_CHAINS, bridgeToSolana } = await import("./evmBridge");
  const result = await bridgeToSolana({
    fromChainKey: params.fromChainKey,
    amount: params.amount,
    decimals: params.decimals,
    recipientSolanaAddress: params.recipientSolanaAddress,
  });
  return {
    txHash: result.txHash,
    explorerUrl: result.explorerUrl,
    direction: "evm-to-solana",
  };
}
