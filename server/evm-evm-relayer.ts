import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  type Address,
  type Log,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc, arbitrum, mainnet } from "viem/chains";
import * as fs from "fs";
import { CNOVA_TOKEN as CNOVA_DEFAULT } from "./chainConfig";

const RELAYER_KEY = (process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`;
const VALIDATOR_KEY = (process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`;

if (!RELAYER_KEY) { console.error("[致命] 缺少 RELAYER_PRIVATE_KEY / PRIVATE_KEY"); process.exit(1); }
if (!VALIDATOR_KEY) { console.error("[致命] 缺少 VALIDATOR_PRIVATE_KEY / PRIVATE_KEY"); process.exit(1); }

const STATE_FILE = "./bridge-evm-evm-state.json";

interface ChainDef {
  name: string;
  chainId: number;
  viemChain: Chain;
  rpc: string;
  bridge: Address;
  token: Address;
}

const CHAINS: ChainDef[] = [];

if (process.env.BSC_BRIDGE) {
  CHAINS.push({
    name: "BSC",
    chainId: 56,
    viemChain: bsc,
    rpc: process.env.BSC_LOGS_RPC_URL || "https://bsc-rpc.publicnode.com",
    bridge: process.env.BSC_BRIDGE as Address,
    token: (process.env.SOURCE_TOKEN_BSC || process.env.WRAPPED_CNOVA_BSC || CNOVA_DEFAULT) as Address,
  });
}
if (process.env.ARBITRUM_BRIDGE && (process.env.WRAPPED_CNOVA_ARBITRUM || process.env.WRAPPED_FORGAI_ARBITRUM)) {
  CHAINS.push({
    name: "Arbitrum",
    chainId: 42161,
    viemChain: arbitrum,
    rpc: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    bridge: process.env.ARBITRUM_BRIDGE as Address,
    token: (process.env.WRAPPED_CNOVA_ARBITRUM || process.env.WRAPPED_FORGAI_ARBITRUM) as Address,
  });
}
if (process.env.ETHEREUM_BRIDGE && (process.env.WRAPPED_CNOVA_ETHEREUM || process.env.WRAPPED_FORGAI_ETHEREUM)) {
  CHAINS.push({
    name: "Ethereum",
    chainId: 1,
    viemChain: mainnet,
    rpc: process.env.ETHEREUM_RPC_URL || "https://ethereum-rpc.publicnode.com",
    bridge: process.env.ETHEREUM_BRIDGE as Address,
    token: (process.env.WRAPPED_CNOVA_ETHEREUM || process.env.WRAPPED_FORGAI_ETHEREUM) as Address,
  });
}

const BRIDGE_TRANSFER_EVENT = parseAbiItem(
  "event BridgeTransferInitiated(bytes32 indexed transferId, address indexed sender, address localToken, uint256 amount, uint256 targetChainId, bytes32 recipientBytes32)"
);

const COMPLETE_TRANSFER_ABI = [
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

interface RelayerState {
  processedTransferIds: string[];
  lastScannedBlocks: Record<string, number>;
}

function loadState(): RelayerState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {}
  return { processedTransferIds: [], lastScannedBlocks: {} };
}

function saveState(state: RelayerState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function bytes32ToAddress(bytes32: string): string {
  return "0x" + bytes32.slice(26);
}

async function relayTransfer(
  sourceChain: ChainDef,
  transferId: string,
  sender: string,
  amount: bigint,
  targetChainId: number,
  recipientBytes32: string,
  state: RelayerState,
): Promise<void> {
  if (state.processedTransferIds.includes(transferId)) return;

  const targetChain = CHAINS.find(c => c.chainId === targetChainId);
  if (!targetChain) {
    console.log(`[跳过] ${transferId.slice(0, 18)}... 目标链 ${targetChainId} 未配置`);
    return;
  }

  const recipientAddr = bytes32ToAddress(recipientBytes32);

  console.log(`\n[处理] ${sourceChain.name} → ${targetChain.name}`);
  console.log(`  TransferID: ${transferId}`);
  console.log(`  发送方: ${sender}`);
  console.log(`  数量: ${amount}`);
  console.log(`  接收方: ${recipientAddr}`);

  try {
    const { encodeAbiParameters, keccak256 } = await import("viem");
    const relayerAccount = privateKeyToAccount(RELAYER_KEY);
    const validatorAccount = privateKeyToAccount(VALIDATOR_KEY);

    const message = encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
      ],
      [transferId as `0x${string}`, targetChain.token, amount, recipientAddr as Address]
    );

    const messageHash = keccak256(message);
    const validatorSig = await validatorAccount.signMessage({
      message: { raw: messageHash as `0x${string}` },
    });

    const walletClient = createWalletClient({
      account: relayerAccount,
      chain: targetChain.viemChain,
      transport: http(targetChain.rpc),
    });

    console.log(`  [提交] completeTransfer → ${targetChain.name} bridge ${targetChain.bridge}`);

    const hash = await walletClient.writeContract({
      address: targetChain.bridge,
      abi: COMPLETE_TRANSFER_ABI,
      functionName: "completeTransfer",
      args: [message, validatorSig],
    });

    console.log(`  [成功] ${targetChain.name} tx: ${hash}`);

    state.processedTransferIds.push(transferId);
    saveState(state);
  } catch (err: any) {
    console.error(`  [错误] relay 失败: ${err.message}`);
  }
}

async function watchChain(chain: ChainDef, state: RelayerState): Promise<void> {
  const client = createPublicClient({
    chain: chain.viemChain,
    transport: http(chain.rpc),
  });

  const latestBlock = await client.getBlockNumber();
  if (!state.lastScannedBlocks[chain.name]) {
    state.lastScannedBlocks[chain.name] = Number(latestBlock);
    saveState(state);
  }

  console.log(`[${chain.name}] 从块 ${state.lastScannedBlocks[chain.name]} 开始轮询监听`);

  const POLL_INTERVAL = 10000;

  function schedulePoll() {
    setTimeout(() => {
      (async () => {
        const latest = await client.getBlockNumber();
        const from = BigInt(state.lastScannedBlocks[chain.name] + 1);
        if (from <= latest) {
          const toBlock = from + BigInt(1000) < latest ? from + BigInt(1000) : latest;
          const logs = await client.getLogs({
            address: chain.bridge,
            event: BRIDGE_TRANSFER_EVENT,
            fromBlock: from,
            toBlock: toBlock,
          });

          for (const log of logs) {
            const args = (log as any).args;
            if (!args) continue;
            await relayTransfer(
              chain,
              args.transferId,
              args.sender,
              args.amount,
              Number(args.targetChainId),
              args.recipientBytes32,
              state,
            );
          }

          state.lastScannedBlocks[chain.name] = Number(toBlock);
          saveState(state);
        }
      })().catch((err) => {
        console.error(`[${chain.name}] 轮询错误:`, String(err.message || err).slice(0, 120));
      }).finally(() => {
        schedulePoll();
      });
    }, POLL_INTERVAL);
  }

  schedulePoll();
}

async function main() {
  const state = loadState();
  const account = privateKeyToAccount(RELAYER_KEY);

  console.log(`\n=== EVM ↔ EVM Bridge Relayer ===`);
  console.log(`Relayer 地址: ${account.address}`);
  console.log(`配置的链: ${CHAINS.map(c => `${c.name}(${c.chainId})`).join(", ")}`);
  console.log(`已处理: ${state.processedTransferIds.length} 笔\n`);

  for (const chain of CHAINS) {
    console.log(`  ${chain.name}: bridge=${chain.bridge}, token=${chain.token}`);
  }
  console.log();

  for (const chain of CHAINS) {
    await watchChain(chain, state);
  }

  console.log(`\n[就绪] EVM↔EVM Relayer 运行中\n`);

  setInterval(() => {}, 60000);
}

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err.message);
});
process.on("unhandledRejection", (reason: any) => {
  console.error("[unhandledRejection]", reason?.message || reason);
});

main().catch((error) => {
  console.error("[致命]", error.message || error);
  process.exit(1);
});
