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

export const SOLANA_VAULT = import.meta.env.VITE_SOLANA_VAULT
  ? new PublicKey(import.meta.env.VITE_SOLANA_VAULT)
  : null;

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

export async function initiateSolanaDeposit(params: {
  wallet: SolanaWalletAdapter;
  amount: string;
  decimals: number;
  targetChain: string;
  recipientEvmAddress: string;
}): Promise<SolanaBridgeResult> {
  if (!params.wallet.publicKey) throw new Error("Wallet not connected");
  if (!SOLANA_VAULT) throw new Error("Solana vault not configured (VITE_SOLANA_VAULT)");

  const connection = getSolanaConnection();
  const {
    getAssociatedTokenAddress,
    createTransferInstruction,
    TOKEN_PROGRAM_ID,
  } = await import("@solana/spl-token");

  const senderATA = await getAssociatedTokenAddress(SOLANA_MINT, params.wallet.publicKey);
  const vaultATA = await getAssociatedTokenAddress(SOLANA_MINT, SOLANA_VAULT);

  const amountRaw = BigInt(Math.floor(parseFloat(params.amount) * Math.pow(10, params.decimals)));

  const memo = buildBridgeMemo(params.targetChain, params.recipientEvmAddress);

  const transferIx = createTransferInstruction(
    senderATA,
    vaultATA,
    params.wallet.publicKey,
    amountRaw,
    [],
    TOKEN_PROGRAM_ID
  );

  const memoIx = new TransactionInstruction({
    keys: [],
    programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
    data: Buffer.from(memo, "utf-8"),
  });

  const tx = new Transaction().add(transferIx, memoIx);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = params.wallet.publicKey;

  let signature: TransactionSignature;
  if (params.wallet.sendTransaction) {
    signature = await params.wallet.sendTransaction(tx, connection);
  } else if (params.wallet.signTransaction) {
    const signed = await params.wallet.signTransaction(tx);
    signature = await connection.sendRawTransaction(signed.serialize());
  } else {
    throw new Error("Wallet does not support signing transactions");
  }

  await connection.confirmTransaction(signature, "confirmed");

  return {
    signature,
    explorerUrl: `https://solscan.io/tx/${signature}`,
  };
}

export function quoteSolanaToEvm(
  amount: string,
  targetChain: string
): { receiveAmount: string; protocolFee: string; route: string; eta: string } {
  const parsed = parseFloat(amount) || 0;
  const feePercent = 0.3;
  const fee = parsed * (feePercent / 100);
  const receive = Math.max(parsed - fee, 0);

  const chainNames: Record<string, string> = {
    bsc: "BSC",
    arbitrum: "Arbitrum",
    ethereum: "Ethereum",
  };

  return {
    receiveAmount: receive.toFixed(4),
    protocolFee: `${fee.toFixed(4)} ForgAI + gas`,
    route: `Solana → Vault → Relayer → ${chainNames[targetChain] || targetChain}`,
    eta: targetChain === "bsc" ? "~2-5 min" : "~5-10 min",
  };
}
