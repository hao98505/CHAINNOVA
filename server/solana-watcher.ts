import {
  Connection,
  PublicKey,
  type ParsedTransactionWithMeta,
  type ConfirmedSignatureInfo,
} from "@solana/web3.js";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const SOLANA_VAULT_ATA = process.env.SOLANA_VAULT_ATA;
const SOLANA_MINT = process.env.SOLANA_MINT || "6ZcR1KCqVZDLzSoUbiPW8P6XUvrazxMtUZTa9csppump";
const RELAYER_PRIVATE_KEY = (process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`;
const STATE_FILE = process.env.STATE_FILE_PATH || "./bridge-state.json";

const CHAIN_CONFIG: Record<string, { rpc: string; bridge: Address; targetToken: Address }> = {};

const BSC_TOKEN = process.env.SOURCE_TOKEN_BSC || process.env.WRAPPED_FORGAI_BSC;
if (process.env.BSC_RPC_URL && process.env.BSC_BRIDGE && BSC_TOKEN) {
  CHAIN_CONFIG["bsc"] = {
    rpc: process.env.BSC_RPC_URL,
    bridge: process.env.BSC_BRIDGE as Address,
    targetToken: BSC_TOKEN as Address,
  };
}
if (process.env.ARBITRUM_RPC_URL && process.env.ARBITRUM_BRIDGE && process.env.WRAPPED_FORGAI_ARBITRUM) {
  CHAIN_CONFIG["arbitrum"] = {
    rpc: process.env.ARBITRUM_RPC_URL,
    bridge: process.env.ARBITRUM_BRIDGE as Address,
    targetToken: process.env.WRAPPED_FORGAI_ARBITRUM as Address,
  };
}
if (process.env.ETHEREUM_RPC_URL && process.env.ETHEREUM_BRIDGE && process.env.WRAPPED_FORGAI_ETHEREUM) {
  CHAIN_CONFIG["ethereum"] = {
    rpc: process.env.ETHEREUM_RPC_URL,
    bridge: process.env.ETHEREUM_BRIDGE as Address,
    targetToken: process.env.WRAPPED_FORGAI_ETHEREUM as Address,
  };
}

const BRIDGE_MINT_ABI = [
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
] as const;

interface BridgeState {
  processedSolanaSignatures: string[];
  lastScannedSlot: number;
  pendingFailed: Array<{ signature: string; error: string; timestamp: number }>;
}

function loadState(): BridgeState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {}
  return { processedSolanaSignatures: [], lastScannedSlot: 0, pendingFailed: [] };
}

function saveState(state: BridgeState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function parseBridgeMemo(memoData: string): { target: string; recipient: string } | null {
  try {
    const parsed = JSON.parse(memoData);
    if (parsed.op === "bridge" && parsed.target && parsed.recipient) {
      return { target: parsed.target, recipient: parsed.recipient };
    }
  } catch {}
  return null;
}

function isValidEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

async function processDeposit(
  signature: string,
  targetChain: string,
  recipientEvm: string,
  amount: bigint,
  state: BridgeState
) {
  const chainConf = CHAIN_CONFIG[targetChain];
  if (!chainConf) {
    console.error(`[错误] 目标链 ${targetChain} 未配置`);
    state.pendingFailed.push({ signature, error: `目标链 ${targetChain} 未配置`, timestamp: Date.now() });
    saveState(state);
    return;
  }

  if (!RELAYER_PRIVATE_KEY) {
    console.error("[错误] RELAYER_PRIVATE_KEY 未设置");
    return;
  }

  try {
    const account = privateKeyToAccount(RELAYER_PRIVATE_KEY);
    const walletClient = createWalletClient({
      account,
      transport: http(chainConf.rpc),
    });

    const validatorKey = (process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`;
    if (!validatorKey) {
      console.error("[错误] VALIDATOR_PRIVATE_KEY 未设置");
      return;
    }

    const validatorAccount = privateKeyToAccount(validatorKey);
    const { encodeAbiParameters, keccak256 } = await import("viem");

    const transferId = keccak256(
      encodeAbiParameters(
        [{ type: "string" }, { type: "uint256" }],
        [signature, amount]
      )
    );

    const message = encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
      ],
      [transferId, chainConf.targetToken, amount, recipientEvm as Address]
    );

    const messageHash = keccak256(message);
    const validatorSig = await validatorAccount.signMessage({
      message: { raw: messageHash as `0x${string}` },
    });

    console.log(`[铸币] 提交到 ${targetChain} bridge...`);

    const hash = await walletClient.writeContract({
      address: chainConf.bridge,
      abi: BRIDGE_MINT_ABI,
      functionName: "completeTransfer",
      args: [message, validatorSig],
      chain: null,
    });

    console.log(`[成功] ${targetChain} tx: ${hash}`);

    state.processedSolanaSignatures.push(signature);
    saveState(state);
  } catch (error: any) {
    console.error(`[错误] 处理存款失败:`, error.message);
    state.pendingFailed.push({ signature, error: error.message, timestamp: Date.now() });
    saveState(state);
  }
}

async function scanDeposits() {
  if (!SOLANA_VAULT_ATA) {
    console.error("[错误] SOLANA_VAULT_ATA 未设置");
    process.exit(1);
  }

  const connection = new Connection(SOLANA_RPC, "confirmed");
  const vaultATA = new PublicKey(SOLANA_VAULT_ATA);
  const state = loadState();
  const processedSet = new Set(state.processedSolanaSignatures);

  console.log(`\n=== Solana Watcher ===`);
  console.log(`Vault ATA: ${SOLANA_VAULT_ATA}`);
  console.log(`Mint: ${SOLANA_MINT}`);
  console.log(`已处理: ${processedSet.size} 笔`);
  console.log(`上次扫描 slot: ${state.lastScannedSlot}`);
  console.log(`配置的目标链: ${Object.keys(CHAIN_CONFIG).join(", ") || "无"}`);
  console.log(`\n开始监听...\n`);

  const POLL_INTERVAL = 10000;

  async function poll() {
    try {
      const sigs: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(
        vaultATA,
        { limit: 20 },
        "confirmed"
      );

      for (const sigInfo of sigs.reverse()) {
        if (processedSet.has(sigInfo.signature)) continue;

        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx || !tx.meta || tx.meta.err) continue;

        let memoData: string | null = null;
        let transferAmount: bigint = BigInt(0);

        for (const ix of tx.transaction.message.instructions) {
          if ("program" in ix && ix.program === "spl-memo" && "parsed" in ix) {
            memoData = ix.parsed as string;
          }
        }

        const vaultATAStr = SOLANA_VAULT_ATA!;
        if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
          const accountKeys = tx.transaction.message.accountKeys.map(k =>
            typeof k === "string" ? k : k.pubkey.toBase58()
          );
          for (const post of tx.meta.postTokenBalances) {
            const accountAddr = accountKeys[post.accountIndex];
            if (accountAddr === vaultATAStr && post.mint === SOLANA_MINT) {
              const pre = tx.meta.preTokenBalances.find(
                (p) => p.accountIndex === post.accountIndex
              );
              const preAmt = BigInt(pre?.uiTokenAmount?.amount || "0");
              const postAmt = BigInt(post.uiTokenAmount.amount || "0");
              if (postAmt > preAmt) {
                transferAmount = postAmt - preAmt;
              }
            }
          }
        }

        if (!memoData || transferAmount === BigInt(0)) continue;

        const bridgeInfo = parseBridgeMemo(memoData);
        if (!bridgeInfo) continue;

        if (!isValidEvmAddress(bridgeInfo.recipient)) {
          console.warn(`[跳过] ${sigInfo.signature}: 无效 EVM 地址 ${bridgeInfo.recipient}`);
          continue;
        }

        console.log(`\n[检测到存款] ${sigInfo.signature}`);
        console.log(`  数量: ${transferAmount}`);
        console.log(`  目标链: ${bridgeInfo.target}`);
        console.log(`  接收地址: ${bridgeInfo.recipient}`);

        await processDeposit(
          sigInfo.signature,
          bridgeInfo.target,
          bridgeInfo.recipient,
          transferAmount,
          state
        );
        processedSet.add(sigInfo.signature);
      }

      const slot = await connection.getSlot();
      state.lastScannedSlot = slot;
      saveState(state);
    } catch (error: any) {
      console.error("[扫描错误]", error.message);
    }
  }

  await poll();
  setInterval(poll, POLL_INTERVAL);
}

scanDeposits().catch((error) => {
  console.error("Solana watcher 启动失败:", error);
  process.exit(1);
});
