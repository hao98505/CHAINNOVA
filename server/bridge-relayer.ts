import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  keccak256,
  encodeAbiParameters,
  getAddress,
  type Address,
  type Hash,
  type Log,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import * as fs from "fs";

const SOURCE_RPC_URL = process.env.SOURCE_RPC_URL;
const TARGET_RPC_URL = process.env.TARGET_RPC_URL;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;
const VALIDATOR_PRIVATE_KEY = process.env.VALIDATOR_PRIVATE_KEY as `0x${string}`;
const SOURCE_BRIDGE = process.env.SOURCE_BRIDGE as Address;
const TARGET_BRIDGE = process.env.TARGET_BRIDGE as Address;
const SOURCE_CHAIN_ID = parseInt(process.env.SOURCE_CHAIN_ID || "56");
const TARGET_CHAIN_ID = parseInt(process.env.TARGET_CHAIN_ID || "0");
const SOURCE_TOKEN = process.env.SOURCE_TOKEN as Address;
const TARGET_WRAPPED_TOKEN = process.env.TARGET_WRAPPED_TOKEN as Address;
const STATE_FILE = process.env.STATE_FILE_PATH || "./bridge-evm-state.json";

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const SOLANA_VAULT_KEYPAIR_PATH = process.env.SOLANA_VAULT_KEYPAIR_PATH;
const SOLANA_MINT = process.env.SOLANA_MINT || "6ZcR1KCqVZDLzSoUbiPW8P6XUvrazxMtUZTa9csppump";
const SOLANA_CHAIN_ID = 999999999;

interface RelayerState {
  processedEvmTransferIds: string[];
  lastScannedBlock: number;
  pendingFailed: Array<{ transferId: string; error: string; timestamp: number }>;
}

function loadState(): RelayerState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {}
  return { processedEvmTransferIds: [], lastScannedBlock: 0, pendingFailed: [] };
}

function saveState(state: RelayerState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

if (!SOURCE_RPC_URL || !RELAYER_PRIVATE_KEY || !VALIDATOR_PRIVATE_KEY) {
  console.error("缺少必要环境变量: SOURCE_RPC_URL, RELAYER_PRIVATE_KEY, VALIDATOR_PRIVATE_KEY");
  process.exit(1);
}
if (!SOURCE_BRIDGE || !SOURCE_TOKEN) {
  console.error("缺少 bridge/token 地址: SOURCE_BRIDGE, SOURCE_TOKEN");
  process.exit(1);
}

const validatorAccount = privateKeyToAccount(VALIDATOR_PRIVATE_KEY);
const relayerAccount = privateKeyToAccount(RELAYER_PRIVATE_KEY);

const sourceClient = createPublicClient({ transport: http(SOURCE_RPC_URL) });

const BRIDGE_TRANSFER_INITIATED_EVENT = parseAbiItem(
  "event BridgeTransferInitiated(bytes32 indexed transferId, address indexed sender, address localToken, uint256 amount, uint256 targetChainId, bytes32 recipientBytes32)"
);

const BRIDGE_ABI = [
  {
    type: "function",
    name: "completeTransfer",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "validatorSignature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "processedTransfers",
    inputs: [{ name: "transferId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
] as const;

function bytes32ToHex(bytes32: `0x${string}`): string {
  return bytes32;
}

function bytes32ToSolanaAddress(bytes32: `0x${string}`): string | null {
  try {
    const hex = bytes32.slice(2);
    const bytes = Buffer.from(hex, "hex");
    const bs58 = require("bs58");
    return bs58.encode(bytes);
  } catch {
    return null;
  }
}

async function handleEvmToEvmTransfer(log: Log, state: RelayerState) {
  const args = (log as any).args;
  if (!args) return;

  const { transferId, sender, localToken, amount, targetChainId, recipientBytes32 } = args;

  if (!TARGET_BRIDGE || !TARGET_RPC_URL || !TARGET_WRAPPED_TOKEN) {
    console.log(`[跳过] EVM->EVM 模式未完全配置`);
    return;
  }

  if (Number(targetChainId) !== TARGET_CHAIN_ID) {
    console.log(`[跳过] Transfer ${transferId} 目标链 ${targetChainId}，不是 ${TARGET_CHAIN_ID}`);
    return;
  }

  const targetClient = createPublicClient({ transport: http(TARGET_RPC_URL) });
  const isProcessed = await targetClient.readContract({
    address: TARGET_BRIDGE,
    abi: BRIDGE_ABI,
    functionName: "processedTransfers",
    args: [transferId],
  });

  if (isProcessed) {
    console.log(`  已处理，跳过`);
    return;
  }

  const recipient = getAddress("0x" + (recipientBytes32 as string).slice(26));
  console.log(`  接收地址: ${recipient}`);

  const message = encodeAbiParameters(
    [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }, { type: "address" }],
    [transferId, TARGET_WRAPPED_TOKEN, amount, recipient]
  );

  const messageHash = keccak256(message);
  const signature = await validatorAccount.signMessage({ message: { raw: messageHash as `0x${string}` } });

  const targetWalletClient = createWalletClient({
    account: relayerAccount,
    transport: http(TARGET_RPC_URL),
  });

  const hash = await targetWalletClient.writeContract({
    address: TARGET_BRIDGE,
    abi: BRIDGE_ABI,
    functionName: "completeTransfer",
    args: [message, signature],
    chain: null,
  });

  console.log(`  EVM tx 已提交: ${hash}`);
  state.processedEvmTransferIds.push(transferId);
  saveState(state);
}

async function handleEvmToSolanaTransfer(log: Log, state: RelayerState) {
  const args = (log as any).args;
  if (!args) return;

  const { transferId, sender, localToken, amount, targetChainId, recipientBytes32 } = args;

  if (Number(targetChainId) !== SOLANA_CHAIN_ID) return;

  const solanaAddress = bytes32ToSolanaAddress(recipientBytes32);
  if (!solanaAddress) {
    console.error(`  无效 Solana 地址: ${recipientBytes32}`);
    state.pendingFailed.push({ transferId, error: "无效 Solana 地址", timestamp: Date.now() });
    saveState(state);
    return;
  }

  if (!SOLANA_VAULT_KEYPAIR_PATH) {
    console.error("  SOLANA_VAULT_KEYPAIR_PATH 未设置，无法向 Solana 转账");
    state.pendingFailed.push({ transferId, error: "SOLANA_VAULT_KEYPAIR_PATH 未设置", timestamp: Date.now() });
    saveState(state);
    return;
  }

  try {
    const keypairData = JSON.parse(fs.readFileSync(SOLANA_VAULT_KEYPAIR_PATH, "utf-8"));
    const vaultKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const mintPubkey = new PublicKey(SOLANA_MINT);
    const recipientPubkey = new PublicKey(solanaAddress);

    const {
      getAssociatedTokenAddress,
      createAssociatedTokenAccountInstruction,
      createTransferInstruction,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    } = await import("@solana/spl-token");

    const vaultATA = await getAssociatedTokenAddress(mintPubkey, vaultKeypair.publicKey);
    const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

    const tx = new Transaction();

    const recipientATAInfo = await connection.getAccountInfo(recipientATA);
    if (!recipientATAInfo) {
      console.log(`  创建接收方 ATA: ${recipientATA.toBase58()}`);
      tx.add(
        createAssociatedTokenAccountInstruction(
          vaultKeypair.publicKey,
          recipientATA,
          recipientPubkey,
          mintPubkey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    tx.add(
      createTransferInstruction(
        vaultATA,
        recipientATA,
        vaultKeypair.publicKey,
        BigInt(amount.toString()),
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = vaultKeypair.publicKey;
    tx.sign(vaultKeypair);

    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    console.log(`  [成功] Solana tx: ${sig}`);
    state.processedEvmTransferIds.push(transferId);
    saveState(state);
  } catch (error: any) {
    console.error(`  [错误] Solana 转账失败:`, error.message);
    state.pendingFailed.push({ transferId, error: error.message, timestamp: Date.now() });
    saveState(state);
  }
}

async function processTransferEvent(log: Log, state: RelayerState) {
  try {
    const args = (log as any).args;
    if (!args) return;

    const { transferId, sender, localToken, amount, targetChainId } = args;

    if (state.processedEvmTransferIds.includes(transferId)) return;

    if (localToken.toLowerCase() !== SOURCE_TOKEN.toLowerCase()) {
      console.log(`[跳过] Transfer ${transferId} token ${localToken} 不匹配 ${SOURCE_TOKEN}`);
      return;
    }

    console.log(`\n[处理] Transfer ${transferId}`);
    console.log(`  发送方: ${sender}`);
    console.log(`  数量: ${amount}`);
    console.log(`  目标链ID: ${targetChainId}`);

    if (Number(targetChainId) === SOLANA_CHAIN_ID) {
      await handleEvmToSolanaTransfer(log, state);
    } else {
      await handleEvmToEvmTransfer(log, state);
    }
  } catch (error: any) {
    console.error(`[错误] 处理转账事件失败:`, error.message);
  }
}

async function main() {
  const state = loadState();

  console.log(`\n=== Bridge Relayer (双向) ===`);
  console.log(`源链ID: ${SOURCE_CHAIN_ID}`);
  console.log(`源 Bridge: ${SOURCE_BRIDGE}`);
  console.log(`源 Token: ${SOURCE_TOKEN}`);
  console.log(`目标链ID: ${TARGET_CHAIN_ID || "Solana(999999999)"}`);
  console.log(`Relayer: ${relayerAccount.address}`);
  console.log(`Validator: ${validatorAccount.address}`);
  console.log(`已处理: ${state.processedEvmTransferIds.length} 笔`);
  console.log(`失败待重试: ${state.pendingFailed.length} 笔`);
  console.log(`\n监听 BridgeTransferInitiated 事件...\n`);

  sourceClient.watchEvent({
    address: SOURCE_BRIDGE,
    event: BRIDGE_TRANSFER_INITIATED_EVENT,
    onLogs: (logs) => {
      for (const log of logs) {
        processTransferEvent(log, state);
      }
    },
    onError: (error) => {
      console.error("[监听错误]", error.message);
    },
  });
}

main().catch((error) => {
  console.error("Relayer 启动失败:", error);
  process.exit(1);
});
