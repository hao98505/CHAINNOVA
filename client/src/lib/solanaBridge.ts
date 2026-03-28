import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  type TransactionSignature,
} from "@solana/web3.js";

export const SOLANA_MINT = new PublicKey(
  import.meta.env.VITE_SOLANA_MINT || "6ZcR1KCqVZDLzSoUbiPW8P6XUvrazxMtUZTa9csppump"
);

const SOLANA_RPC = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export function getSolanaConnection(): Connection {
  return new Connection(SOLANA_RPC, "confirmed");
}

export interface SolanaWalletAdapter {
  publicKey: PublicKey | null;
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
  sendTransaction?: (tx: Transaction, connection: Connection) => Promise<TransactionSignature>;
}

export async function getSolanaTokenBalance(
  owner: PublicKey,
  mint: PublicKey = SOLANA_MINT
): Promise<{ balance: string; decimals: number; ataAddress: string | null }> {
  const connection = getSolanaConnection();
  const { TOKEN_PROGRAM_ID } = await import("@solana/spl-token");

  const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
    mint,
    programId: TOKEN_PROGRAM_ID,
  });

  if (accounts.value.length === 0) {
    return { balance: "0", decimals: 6, ataAddress: null };
  }

  const info = accounts.value[0].account.data.parsed.info;
  return {
    balance: info.tokenAmount.uiAmountString || "0",
    decimals: info.tokenAmount.decimals,
    ataAddress: accounts.value[0].pubkey.toBase58(),
  };
}

export async function getOrCreateATAAddress(
  owner: PublicKey,
  mint: PublicKey = SOLANA_MINT
): Promise<string> {
  const { getAssociatedTokenAddress } = await import("@solana/spl-token");
  const ata = await getAssociatedTokenAddress(mint, owner);
  return ata.toBase58();
}

export function buildBridgeMemo(targetChain: string, recipientAddress: string): string {
  return JSON.stringify({
    op: "bridge",
    target: targetChain,
    recipient: recipientAddress,
  });
}

export interface SolanaBridgeResult {
  signature: TransactionSignature;
  explorerUrl: string;
}

export async function initiateSolanaDeposit(_params: {
  wallet: SolanaWalletAdapter;
  amount: string;
  decimals: number;
  targetChain: string;
  recipientEvmAddress: string;
}): Promise<SolanaBridgeResult> {
  throw new Error("Solana bridge is disabled pending wFORGAI rewrite. Please use EVM↔EVM bridge.");
}

export function quoteSolanaToEvm(
  _amount: string,
  _targetChain: string
): { receiveAmount: string; protocolFee: string; route: string; eta: string } {
  return {
    receiveAmount: "0",
    protocolFee: "N/A",
    route: "Solana bridge disabled — pending wFORGAI rewrite",
    eta: "N/A",
  };
}
