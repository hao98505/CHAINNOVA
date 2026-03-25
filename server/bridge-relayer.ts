import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type Log,
} from "viem";
import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import * as fs from "fs";

const SOURCE_RPC_URL = process.env.SOURCE_RPC_URL;
const SOURCE_BRIDGE = process.env.SOURCE_BRIDGE as Address;
const SOURCE_TOKEN = process.env.SOURCE_TOKEN as Address;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const STATE_FILE = process.env.STATE_FILE_PATH || "./bridge-evm-state.json";

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const SOLANA_VAULT_KEYPAIR_PATH = process.env.SOLANA_VAULT_KEYPAIR_PATH;
const SOLANA_MINT = process.env.SOLANA_MINT || "6ZcR1KCqVZDLzSoUbiPW8P6XUvrazxMtUZTa9csppump";
const SOLANA_CHAIN_ID = 999999999;

const POLL_INTERVAL = 15000;

if (!SOURCE_RPC_URL) { console.error("[致命] 缺少 SOURCE_RPC_URL"); process.exit(1); }
if (!SOURCE_BRIDGE) { console.error("[致命] 缺少 SOURCE_BRIDGE"); process.exit(1); }
if (!SOURCE_TOKEN) { console.error("[致命] 缺少 SOURCE_TOKEN"); process.exit(1); }
if (!SOLANA_RPC) { console.error("[致命] 缺少 SOLANA_RPC_URL"); process.exit(1); }
if (!SOLANA_VAULT_KEYPAIR_PATH) { console.error("[致命] 缺少 SOLANA_VAULT_KEYPAIR_PATH，无法向 Solana 释放代币"); process.exit(1); }
if (!SOLANA_MINT) { console.error("[致命] 缺少 SOLANA_MINT"); process.exit(1); }

let vaultKeypair: Keypair;
try {
  const raw = JSON.parse(fs.readFileSync(SOLANA_VAULT_KEYPAIR_PATH, "utf-8"));
  vaultKeypair = Keypair.fromSecretKey(Uint8Array.from(raw));
} catch (err: any) {
  console.error(`[致命] 无法加载 Vault Keypair (${SOLANA_VAULT_KEYPAIR_PATH}): ${err.message}`);
  process.exit(1);
}

interface PendingFailedEntry {
  transferId: string;
  error: string;
  timestamp: number;
  retries: number;
}

interface RelayerState {
  processedEvmTransferIds: string[];
  lastScannedBlock: number;
  pendingFailed: PendingFailedEntry[];
}

function loadState(): RelayerState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      return {
        processedEvmTransferIds: data.processedEvmTransferIds || [],
        lastScannedBlock: data.lastScannedBlock || 0,
        pendingFailed: (data.pendingFailed || []).map((e: any) => ({
          transferId: e.transferId,
          error: e.error || "",
          timestamp: e.timestamp || 0,
          retries: e.retries || 0,
        })),
      };
    }
  } catch {}
  return { processedEvmTransferIds: [], lastScannedBlock: 0, pendingFailed: [] };
}

function saveState(state: RelayerState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function markProcessed(state: RelayerState, transferId: string): void {
  if (!state.processedEvmTransferIds.includes(transferId)) {
    state.processedEvmTransferIds.push(transferId);
  }
  state.pendingFailed = state.pendingFailed.filter(e => e.transferId !== transferId);
  saveState(state);
}

function markFailed(state: RelayerState, transferId: string, error: string): void {
  const existing = state.pendingFailed.find(e => e.transferId === transferId);
  if (existing) {
    existing.error = error;
    existing.timestamp = Date.now();
    existing.retries += 1;
  } else {
    state.pendingFailed.push({ transferId, error, timestamp: Date.now(), retries: 0 });
  }
  saveState(state);
}

function bytes32ToSolanaAddress(bytes32: string): string | null {
  try {
    const hex = bytes32.startsWith("0x") ? bytes32.slice(2) : bytes32;
    if (hex.length !== 64) return null;
    const bytes = Buffer.from(hex, "hex");
    if (bytes.length !== 32) return null;
    const pubkey = new PublicKey(bytes);
    if (!PublicKey.isOnCurve(pubkey.toBytes())) {
      return pubkey.toBase58();
    }
    return pubkey.toBase58();
  } catch {
    return null;
  }
}

const sourceClient = createPublicClient({ transport: http(SOURCE_RPC_URL) });
const solanaConnection = new Connection(SOLANA_RPC, "confirmed");
const mintPubkey = new PublicKey(SOLANA_MINT);

const BRIDGE_TRANSFER_INITIATED_EVENT = parseAbiItem(
  "event BridgeTransferInitiated(bytes32 indexed transferId, address indexed sender, address localToken, uint256 amount, uint256 targetChainId, bytes32 recipientBytes32)"
);

async function releaseSolanaTokens(
  transferId: string,
  recipientSolanaAddress: string,
  amount: bigint,
  state: RelayerState
): Promise<void> {
  const {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  } = await import("@solana/spl-token");

  const recipientPubkey = new PublicKey(recipientSolanaAddress);
  const vaultATA = await getAssociatedTokenAddress(mintPubkey, vaultKeypair.publicKey);
  const recipientATA = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);

  const vaultATAInfo = await solanaConnection.getAccountInfo(vaultATA);
  if (!vaultATAInfo) {
    const errMsg = `Vault ATA ${vaultATA.toBase58()} 不存在`;
    console.error(`  [错误] ${errMsg}`);
    markFailed(state, transferId, errMsg);
    return;
  }

  const vaultBalance = await solanaConnection.getTokenAccountBalance(vaultATA);
  const vaultAmount = BigInt(vaultBalance.value.amount);
  if (vaultAmount < amount) {
    const errMsg = `Vault 余额不足: 需要 ${amount}，当前 ${vaultAmount}`;
    console.error(`  [错误] ${errMsg}`);
    markFailed(state, transferId, errMsg);
    return;
  }

  const tx = new Transaction();

  const recipientATAInfo = await solanaConnection.getAccountInfo(recipientATA);
  if (!recipientATAInfo) {
    console.log(`  [ATA] 创建接收方 ATA: ${recipientATA.toBase58()}`);
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
  } else {
    console.log(`  [ATA] 接收方 ATA 已存在: ${recipientATA.toBase58()}`);
  }

  tx.add(
    createTransferInstruction(
      vaultATA,
      recipientATA,
      vaultKeypair.publicKey,
      amount,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  const { blockhash } = await solanaConnection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = vaultKeypair.publicKey;
  tx.sign(vaultKeypair);

  const sig = await solanaConnection.sendRawTransaction(tx.serialize());
  await solanaConnection.confirmTransaction(sig, "confirmed");

  console.log(`  [成功] Solana tx: ${sig}`);
  console.log(`  [成功] https://solscan.io/tx/${sig}`);
  markProcessed(state, transferId);
}

async function processTransferEvent(
  transferId: string,
  sender: string,
  localToken: string,
  amount: bigint,
  targetChainId: bigint,
  recipientBytes32: string,
  state: RelayerState
): Promise<void> {
  if (state.processedEvmTransferIds.includes(transferId)) return;

  if (localToken.toLowerCase() !== SOURCE_TOKEN.toLowerCase()) {
    console.log(`[跳过] Transfer ${transferId.slice(0, 18)}... token ${localToken} 不匹配 SOURCE_TOKEN ${SOURCE_TOKEN}`);
    return;
  }

  const chainId = Number(targetChainId);

  if (chainId !== SOLANA_CHAIN_ID) {
    console.log(`[跳过] Transfer ${transferId.slice(0, 18)}... 目标链ID=${chainId}，非 Solana(${SOLANA_CHAIN_ID})，本 relayer 不处理`);
    return;
  }

  console.log(`\n[处理] EVM → Solana`);
  console.log(`  TransferID: ${transferId}`);
  console.log(`  发送方: ${sender}`);
  console.log(`  数量: ${amount}`);
  console.log(`  目标链ID: ${chainId} (Solana)`);

  const solanaAddress = bytes32ToSolanaAddress(recipientBytes32);
  if (!solanaAddress) {
    const errMsg = `无效 Solana 地址 (bytes32=${recipientBytes32.slice(0, 20)}...)`;
    console.error(`  [错误] ${errMsg}`);
    markFailed(state, transferId, errMsg);
    return;
  }

  console.log(`  Solana 接收地址: ${solanaAddress}`);

  try {
    await releaseSolanaTokens(transferId, solanaAddress, amount, state);
  } catch (err: any) {
    console.error(`  [错误] Solana 转账异常: ${err.message}`);
    markFailed(state, transferId, err.message);
  }
}

function extractEventArgs(log: Log): {
  transferId: string;
  sender: string;
  localToken: string;
  amount: bigint;
  targetChainId: bigint;
  recipientBytes32: string;
} | null {
  const args = (log as any).args;
  if (!args) return null;
  return {
    transferId: args.transferId,
    sender: args.sender,
    localToken: args.localToken,
    amount: args.amount,
    targetChainId: args.targetChainId,
    recipientBytes32: args.recipientBytes32,
  };
}

async function catchUpScan(state: RelayerState): Promise<void> {
  const latestBlock = await sourceClient.getBlockNumber();
  const fromBlock = state.lastScannedBlock > 0 ? BigInt(state.lastScannedBlock + 1) : latestBlock;

  if (fromBlock > latestBlock) {
    console.log(`[回补] 无需回补，已在最新块 ${latestBlock}`);
    state.lastScannedBlock = Number(latestBlock);
    saveState(state);
    return;
  }

  console.log(`[回补] 扫描区间: ${fromBlock} → ${latestBlock} (共 ${latestBlock - fromBlock + BigInt(1)} 块)`);

  const BATCH_SIZE = BigInt(100);
  let cursor = fromBlock;

  while (cursor <= latestBlock) {
    const batchEnd = cursor + BATCH_SIZE - BigInt(1) > latestBlock
      ? latestBlock
      : cursor + BATCH_SIZE - BigInt(1);

    try {
      const logs = await sourceClient.getLogs({
        address: SOURCE_BRIDGE,
        event: BRIDGE_TRANSFER_INITIATED_EVENT,
        fromBlock: cursor,
        toBlock: batchEnd,
      });

      if (logs.length > 0) {
        console.log(`[回补] 区间 ${cursor}-${batchEnd} 发现 ${logs.length} 笔事件`);
      }

      for (const log of logs) {
        const args = extractEventArgs(log);
        if (!args) continue;
        await processTransferEvent(
          args.transferId,
          args.sender,
          args.localToken,
          args.amount,
          args.targetChainId,
          args.recipientBytes32,
          state
        );
      }
    } catch (err: any) {
      console.error(`[回补错误] 区间 ${cursor}-${batchEnd}: ${err.message}`);
    }

    state.lastScannedBlock = Number(batchEnd);
    saveState(state);
    cursor = batchEnd + BigInt(1);
  }

  console.log(`[回补] 完成，lastScannedBlock 更新到 ${state.lastScannedBlock}`);
}

async function startLiveWatch(state: RelayerState): Promise<void> {
  console.log(`[实时] 开始监听 BridgeTransferInitiated 事件...\n`);

  sourceClient.watchEvent({
    address: SOURCE_BRIDGE,
    event: BRIDGE_TRANSFER_INITIATED_EVENT,
    onLogs: async (logs) => {
      for (const log of logs) {
        const args = extractEventArgs(log);
        if (!args) continue;
        await processTransferEvent(
          args.transferId,
          args.sender,
          args.localToken,
          args.amount,
          args.targetChainId,
          args.recipientBytes32,
          state
        );
        const blockNum = Number(log.blockNumber || 0);
        if (blockNum > state.lastScannedBlock) {
          state.lastScannedBlock = blockNum;
          saveState(state);
        }
      }
    },
    onError: (error) => {
      console.error("[监听错误]", error.message);
    },
  });
}

async function main() {
  const state = loadState();

  console.log(`\n=== Bridge Relayer · EVM → Solana ===`);
  console.log(`源链 RPC: ${SOURCE_RPC_URL!.slice(0, 40)}...`);
  console.log(`源 Bridge: ${SOURCE_BRIDGE}`);
  console.log(`源 Token: ${SOURCE_TOKEN}`);
  console.log(`Solana RPC: ${SOLANA_RPC.slice(0, 40)}...`);
  console.log(`Solana Mint: ${SOLANA_MINT}`);
  console.log(`Vault Owner: ${vaultKeypair.publicKey.toBase58()}`);
  console.log(`Solana 链ID (EVM 占位): ${SOLANA_CHAIN_ID}`);
  console.log(`RELAYER_PRIVATE_KEY: ${RELAYER_PRIVATE_KEY ? "已配置" : "未配置(仅日志)"}`);
  console.log(`状态文件: ${STATE_FILE}`);
  console.log(`已处理: ${state.processedEvmTransferIds.length} 笔`);
  console.log(`失败待重试: ${state.pendingFailed.length} 笔`);
  console.log(`上次扫描块: ${state.lastScannedBlock}`);
  console.log(``);

  await catchUpScan(state);

  await startLiveWatch(state);

  console.log(`[就绪] Relayer 运行中，轮询间隔由 viem watchEvent 控制\n`);
}

main().catch((error) => {
  console.error("[致命] Relayer 启动失败:", error.message || error);
  process.exit(1);
});
