import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";

export type WormholeChainId = "solana" | "bsc" | "arbitrum" | "ethereum";

export interface WormholeChainConfig {
  id: WormholeChainId;
  wormholeChainId: number;
  name: string;
  symbol: string;
  tokenBridgeAddress: string;
  wormholeAddress: string;
  rpcUrl: string;
  explorerUrl: string;
  confirmations: number;
  gasToken: string;
  color: string;
  bg: string;
  icon: string;
}

export const WORMHOLE_CHAINS: Record<WormholeChainId, WormholeChainConfig> = {
  solana: {
    id: "solana",
    wormholeChainId: 1,
    name: "Solana",
    symbol: "SOL",
    tokenBridgeAddress: "DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe",
    wormholeAddress: "3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5",
    rpcUrl: "https://api.devnet.solana.com",
    explorerUrl: "https://explorer.solana.com/tx",
    confirmations: 32,
    gasToken: "SOL",
    color: "text-purple-400",
    bg: "bg-purple-500/20",
    icon: "◎",
  },
  ethereum: {
    id: "ethereum",
    wormholeChainId: 2,
    name: "Ethereum",
    symbol: "ETH",
    tokenBridgeAddress: "0x3ee18B2214AFF97000D974cf647E7C347E8fa585",
    wormholeAddress: "0x706abc4E45D419950511e474C7B9Ed348A4a716c",
    rpcUrl: "https://rpc.ankr.com/eth_goerli",
    explorerUrl: "https://goerli.etherscan.io/tx",
    confirmations: 15,
    gasToken: "ETH",
    color: "text-slate-300",
    bg: "bg-slate-500/20",
    icon: "◈",
  },
  bsc: {
    id: "bsc",
    wormholeChainId: 4,
    name: "BNB Chain",
    symbol: "BNB",
    tokenBridgeAddress: "0x9dcF9D205C9De35334D646BeE44b2D2859712A09",
    wormholeAddress: "0x68605AD7b15c732DB30f6Aa1baFa1e0dbA8FFdD1",
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    explorerUrl: "https://testnet.bscscan.com/tx",
    confirmations: 15,
    gasToken: "BNB",
    color: "text-yellow-400",
    bg: "bg-yellow-500/20",
    icon: "⬡",
  },
  arbitrum: {
    id: "arbitrum",
    wormholeChainId: 23,
    name: "Arbitrum",
    symbol: "ARB",
    tokenBridgeAddress: "0x23908A62110e21C04F3A4e011d24F901F911744A",
    wormholeAddress: "0xC7A204bDBFe983FCD8d8E61D02b475D4073fF97e",
    rpcUrl: "https://goerli-rollup.arbitrum.io/rpc",
    explorerUrl: "https://goerli.arbiscan.io/tx",
    confirmations: 5,
    gasToken: "ETH",
    color: "text-blue-400",
    bg: "bg-blue-500/20",
    icon: "◆",
  },
};

export const CNOVA_MINT_DEVNET = "CNovAGENT1111111111111111111111111111111111";

export interface BridgeTransferParams {
  amount: number;
  fromChain: WormholeChainId;
  toChain: WormholeChainId;
  senderAddress: string;
  recipientAddress: string;
  slippage?: number;
}

export interface BridgeTransferResult {
  signature: string;
  vaaId: string | null;
  explorerUrl: string;
  status: "submitted" | "confirmed" | "completed" | "simulated";
  estimatedTime: string;
  fee: number;
  receiveAmount: number;
  timestamp: number;
  fromChain: WormholeChainId;
  toChain: WormholeChainId;
  amount: number;
}

export interface BridgeQuote {
  fee: number;
  feePercent: number;
  estimatedTime: string;
  receiveAmount: number;
  relayerFee: number;
  route: string;
  minReceived: number;
  priceImpact: number;
  gasEstimate: string;
}

const BRIDGE_FEES: Record<string, { percent: number; time: string; relayerFee: number; gasEstimate: string }> = {
  "solana-bsc": { percent: 0.3, time: "~8 min", relayerFee: 0.1, gasEstimate: "~0.000005 SOL" },
  "solana-arbitrum": { percent: 0.25, time: "~12 min", relayerFee: 0.08, gasEstimate: "~0.000005 SOL" },
  "solana-ethereum": { percent: 0.5, time: "~20 min", relayerFee: 0.15, gasEstimate: "~0.000008 SOL" },
};

export function getBridgeQuote(
  amount: number,
  fromChain: WormholeChainId,
  toChain: WormholeChainId,
  slippage: number = 0.5
): BridgeQuote {
  const key = `${fromChain}-${toChain}`;
  const config = BRIDGE_FEES[key] || { percent: 0.5, time: "~15 min", relayerFee: 0.1, gasEstimate: "~0.000005 SOL" };
  const fee = amount * (config.percent / 100);
  const receiveAmount = Math.max(0, amount - fee - config.relayerFee);
  const minReceived = Math.max(0, receiveAmount * (1 - slippage / 100));
  const priceImpact = amount > 10000 ? 0.15 : amount > 5000 ? 0.08 : 0.02;
  return {
    fee: parseFloat(fee.toFixed(4)),
    feePercent: config.percent,
    estimatedTime: config.time,
    receiveAmount: parseFloat(receiveAmount.toFixed(4)),
    relayerFee: config.relayerFee,
    route: `Wormhole Token Bridge (${WORMHOLE_CHAINS[fromChain].name} → ${WORMHOLE_CHAINS[toChain].name})`,
    minReceived: parseFloat(minReceived.toFixed(4)),
    priceImpact,
    gasEstimate: config.gasEstimate,
  };
}

export function validateRecipientAddress(address: string, chain: WormholeChainId): { valid: boolean; error?: string } {
  if (!address || address.trim() === "") return { valid: true };

  if (chain === "solana") {
    try {
      new PublicKey(address);
      return { valid: true };
    } catch {
      return { valid: false, error: "Invalid Solana address" };
    }
  }

  const evmRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!evmRegex.test(address)) {
    return { valid: false, error: `Invalid ${WORMHOLE_CHAINS[chain].name} address (must be 0x...)` };
  }
  return { valid: true };
}

export interface BridgeHistoryEntry {
  id: string;
  signature: string;
  vaaId: string | null;
  amount: number;
  fromChain: WormholeChainId;
  toChain: WormholeChainId;
  status: "pending" | "confirmed" | "completed" | "simulated";
  timestamp: number;
  fee: number;
  receiveAmount: number;
  explorerUrl: string;
}

const HISTORY_KEY = "chainnova_bridge_history";

export function saveBridgeHistory(entry: BridgeHistoryEntry): void {
  try {
    const existing = getBridgeHistory();
    existing.unshift(entry);
    const trimmed = existing.slice(0, 20);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function getBridgeHistory(): BridgeHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function clearBridgeHistory(): void {
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

export class WormholeBridgeService {
  private connection: Connection;
  private network: "Testnet" | "Mainnet";

  constructor(connection: Connection, network: "Testnet" | "Mainnet" = "Testnet") {
    this.connection = connection;
    this.network = network;
  }

  async initTransfer(
    params: BridgeTransferParams,
    signTransaction: (tx: Transaction) => Promise<Transaction>
  ): Promise<BridgeTransferResult> {
    const { amount, fromChain, toChain, senderAddress, recipientAddress } = params;
    const fromConfig = WORMHOLE_CHAINS[fromChain];
    const toConfig = WORMHOLE_CHAINS[toChain];
    const quote = getBridgeQuote(amount, fromChain, toChain, params.slippage);

    console.log(`[Wormhole] Initiating bridge: ${amount} $CNOVA`);
    console.log(`[Wormhole] Route: ${fromConfig.name} → ${toConfig.name}`);
    console.log(`[Wormhole] Fee: ${quote.fee} $CNOVA (${quote.feePercent}%)`);
    console.log(`[Wormhole] Relayer fee: ${quote.relayerFee} $CNOVA`);
    console.log(`[Wormhole] Receive: ${quote.receiveAmount} $CNOVA`);
    console.log(`[Wormhole] Min received: ${quote.minReceived} $CNOVA (slippage: ${params.slippage ?? 0.5}%)`);
    console.log(`[Wormhole] Network: ${this.network}`);

    if (fromChain === "solana") {
      return this.bridgeFromSolana(params, signTransaction, quote);
    }

    throw new Error(`Bridge from ${fromConfig.name} not yet supported`);
  }

  private async bridgeFromSolana(
    params: BridgeTransferParams,
    signTransaction: (tx: Transaction) => Promise<Transaction>,
    quote: BridgeQuote
  ): Promise<BridgeTransferResult> {
    const { amount, fromChain, toChain, senderAddress, recipientAddress } = params;
    const toConfig = WORMHOLE_CHAINS[toChain];
    const senderPubkey = new PublicKey(senderAddress);

    try {
      const tokenBridgePubkey = new PublicKey(WORMHOLE_CHAINS.solana.tokenBridgeAddress);
      const wormholePubkey = new PublicKey(WORMHOLE_CHAINS.solana.wormholeAddress);
      const cnovaMint = new PublicKey(CNOVA_MINT_DEVNET);

      const amountBigInt = BigInt(Math.floor(amount * 1e9));
      const nonce = Math.floor(Math.random() * 100000);

      const recipientBytes = this.padAddress(recipientAddress, toChain);

      const transferIx = new TransactionInstruction({
        keys: [
          { pubkey: senderPubkey, isSigner: true, isWritable: true },
          { pubkey: cnovaMint, isSigner: false, isWritable: false },
          { pubkey: tokenBridgePubkey, isSigner: false, isWritable: false },
          { pubkey: wormholePubkey, isSigner: false, isWritable: false },
        ],
        programId: tokenBridgePubkey,
        data: this.encodeTransferData(amountBigInt, recipientBytes, toConfig.wormholeChainId, nonce),
      });

      const tx = new Transaction();
      tx.add(transferIx);

      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = senderPubkey;

      console.log("[Wormhole] Requesting wallet signature...");
      const signedTx = await signTransaction(tx);

      console.log("[Wormhole] Sending transaction...");
      const rawTx = signedTx.serialize();
      const signature = await this.connection.sendRawTransaction(rawTx, {
        skipPreflight: true,
        maxRetries: 3,
      });

      console.log(`[Wormhole] Transaction sent: ${signature}`);
      await this.connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      console.log("[Wormhole] Transaction confirmed on Solana");
      const vaaId = `${WORMHOLE_CHAINS.solana.wormholeChainId}/${signature}`;

      return {
        signature,
        vaaId,
        explorerUrl: `${WORMHOLE_CHAINS.solana.explorerUrl}/${signature}?cluster=devnet`,
        status: "confirmed",
        estimatedTime: quote.estimatedTime,
        fee: quote.fee,
        receiveAmount: quote.receiveAmount,
        timestamp: Date.now(),
        fromChain,
        toChain,
        amount,
      };
    } catch (error: any) {
      if (error?.message?.includes("User rejected") || error?.code === 4001) throw error;
      console.warn("[Wormhole] On-chain transfer failed, using simulation mode:", error.message);
      return this.simulateTransfer(params, quote);
    }
  }

  private simulateTransfer(
    params: BridgeTransferParams,
    quote: BridgeQuote
  ): BridgeTransferResult {
    const simSignature = `wormhole_bridge_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    console.log("[Wormhole] Simulation mode — $CNOVA token not yet deployed");

    return {
      signature: simSignature,
      vaaId: `1/${simSignature}/0`,
      explorerUrl: `${WORMHOLE_CHAINS.solana.explorerUrl}/${simSignature}?cluster=devnet`,
      status: "simulated",
      estimatedTime: quote.estimatedTime,
      fee: quote.fee,
      receiveAmount: quote.receiveAmount,
      timestamp: Date.now(),
      fromChain: params.fromChain,
      toChain: params.toChain,
      amount: params.amount,
    };
  }

  private padAddress(address: string, chain: WormholeChainId): Uint8Array {
    const padded = new Uint8Array(32);
    if (chain === "solana") {
      const pubkey = new PublicKey(address);
      padded.set(pubkey.toBytes());
    } else {
      const hex = address.startsWith("0x") ? address.slice(2) : address;
      const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
      padded.set(bytes, 32 - bytes.length);
    }
    return padded;
  }

  private encodeTransferData(
    amount: bigint,
    recipient: Uint8Array,
    targetChain: number,
    nonce: number
  ): Buffer {
    const data = Buffer.alloc(1 + 8 + 32 + 2 + 4);
    let offset = 0;
    data.writeUInt8(1, offset); offset += 1;
    data.writeBigUInt64LE(amount, offset); offset += 8;
    data.set(recipient, offset); offset += 32;
    data.writeUInt16LE(targetChain, offset); offset += 2;
    data.writeUInt32LE(nonce, offset);
    return data;
  }

  async getVAAStatus(vaaId: string): Promise<{
    status: "pending" | "confirmed" | "completed";
    targetTxHash?: string;
  }> {
    const wormholeApiBase = this.network === "Mainnet"
      ? "https://api.wormholescan.io/api/v1"
      : "https://api.testnet.wormholescan.io/api/v1";

    try {
      const response = await fetch(`${wormholeApiBase}/vaas/${vaaId}`);
      if (!response.ok) return { status: "pending" };
      const data = await response.json();
      if (data?.data?.targetTx) {
        return { status: "completed", targetTxHash: data.data.targetTx };
      }
      return { status: "confirmed" };
    } catch {
      return { status: "pending" };
    }
  }

  getExplorerUrl(chain: WormholeChainId, txHash: string): string {
    const config = WORMHOLE_CHAINS[chain];
    if (chain === "solana") return `${config.explorerUrl}/${txHash}?cluster=devnet`;
    return `${config.explorerUrl}/${txHash}`;
  }

  getWormholeScanUrl(vaaId: string): string {
    const base = this.network === "Mainnet" ? "https://wormholescan.io" : "https://testnet.wormholescan.io";
    return `${base}/#/tx/${vaaId}`;
  }
}
