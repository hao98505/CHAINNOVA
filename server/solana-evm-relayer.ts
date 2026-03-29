import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  type ConfirmedSignatureInfo,
} from "@solana/web3.js";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  type Address,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc, arbitrum, mainnet } from "viem/chains";
import * as fs from "fs";

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const RELAYER_KEY = (process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`;
const VALIDATOR_KEY = (process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`;
const BRIDGE_PROGRAM_ID = process.env.SOLANA_BRIDGE_PROGRAM_ID || "5EApB5fWMEBzFX4HFePxokLTR3yddHpM1z7VyMuC3GpZ";

const SOLANA_CHAIN_ID = 501501;
const DECIMALS_CONVERSION = BigInt(1_000_000_000);

const STATE_FILE = "./bridge-solana-evm-state.json";

if (!RELAYER_KEY) { console.error("[fatal] missing RELAYER_PRIVATE_KEY"); process.exit(1); }
if (!VALIDATOR_KEY) { console.error("[fatal] missing VALIDATOR_PRIVATE_KEY"); process.exit(1); }

interface EvmChainDef {
  name: string;
  chainId: number;
  viemChain: Chain;
  rpc: string;
  bridge: Address;
  token: Address;
}

const EVM_CHAINS: EvmChainDef[] = [];

if (process.env.BSC_BRIDGE) {
  EVM_CHAINS.push({
    name: "BSC",
    chainId: 56,
    viemChain: bsc,
    rpc: process.env.BSC_LOGS_RPC_URL || "https://bsc-rpc.publicnode.com",
    bridge: process.env.BSC_BRIDGE as Address,
    token: (process.env.SOURCE_TOKEN_BSC || "0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff") as Address,
  });
}
if (process.env.ARBITRUM_BRIDGE && process.env.WRAPPED_FORGAI_ARBITRUM) {
  EVM_CHAINS.push({
    name: "Arbitrum",
    chainId: 42161,
    viemChain: arbitrum,
    rpc: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    bridge: process.env.ARBITRUM_BRIDGE as Address,
    token: process.env.WRAPPED_FORGAI_ARBITRUM as Address,
  });
}
if (process.env.ETHEREUM_BRIDGE && process.env.WRAPPED_FORGAI_ETHEREUM) {
  EVM_CHAINS.push({
    name: "Ethereum",
    chainId: 1,
    viemChain: mainnet,
    rpc: process.env.ETHEREUM_RPC_URL || "https://ethereum-rpc.publicnode.com",
    bridge: process.env.ETHEREUM_BRIDGE as Address,
    token: process.env.WRAPPED_FORGAI_ETHEREUM as Address,
  });
}

const BRIDGE_TRANSFER_EVENT = parseAbiItem(
  "event BridgeTransferInitiated(bytes32 indexed transferId, address indexed sender, address localToken, uint256 amount, uint256 targetChainId, bytes32 recipientBytes32)"
);

const COMPLETE_TRANSFER_ABI = [
  {
    type: "function" as const,
    name: "completeTransfer" as const,
    inputs: [
      { name: "message", type: "bytes" },
      { name: "validatorSignature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable" as const,
  },
] as const;

interface RelayerState {
  processedSolTxIds: string[];
  processedEvmTransferIds: string[];
  lastSolSignature: string | null;
  lastEvmBlocks: Record<string, number>;
}

function loadState(): RelayerState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {}
  return {
    processedSolTxIds: [],
    processedEvmTransferIds: [],
    lastSolSignature: null,
    lastEvmBlocks: {},
  };
}

function saveState(state: RelayerState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

interface BridgeOutEvent {
  txSignature: string;
  transferId: string;
  amount: bigint;
  targetChainId: number;
  recipientHex: string;
  nonce: number;
}

function parseBridgeOutLog(logLine: string): Omit<BridgeOutEvent, "txSignature"> | null {
  const match = logLine.match(
    /BridgeOut: transfer_id=([0-9a-f]+), amount=(\d+), target_chain=(\d+), recipient=([0-9a-f]+), nonce=(\d+)/
  );
  if (!match) return null;
  return {
    transferId: match[1],
    amount: BigInt(match[2]),
    targetChainId: parseInt(match[3]),
    recipientHex: match[4],
    nonce: parseInt(match[5]),
  };
}

async function relaySolanaToEvm(
  event: BridgeOutEvent,
  state: RelayerState,
): Promise<void> {
  if (state.processedSolTxIds.includes(event.txSignature)) return;

  const targetChain = EVM_CHAINS.find(c => c.chainId === event.targetChainId);
  if (!targetChain) {
    console.log(`[skip] transfer ${event.transferId.slice(0, 16)}... target chain ${event.targetChainId} not configured`);
    return;
  }

  const recipientAddr = "0x" + event.recipientHex.slice(24);

  console.log(`\n[relay] Solana -> ${targetChain.name}`);
  console.log(`  transfer_id: 0x${event.transferId}`);
  console.log(`  amount (9d): ${event.amount}`);
  console.log(`  recipient: ${recipientAddr}`);

  try {
    const { encodeAbiParameters, keccak256 } = await import("viem");
    const relayerAccount = privateKeyToAccount(RELAYER_KEY);
    const validatorAccount = privateKeyToAccount(VALIDATOR_KEY);

    const evmAmount = event.amount * DECIMALS_CONVERSION;

    const message = encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
      ],
      [
        ("0x" + event.transferId) as `0x${string}`,
        targetChain.token,
        evmAmount,
        recipientAddr as Address,
      ]
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

    console.log(`  [submit] completeTransfer -> ${targetChain.name}`);

    const hash = await walletClient.writeContract({
      address: targetChain.bridge,
      abi: COMPLETE_TRANSFER_ABI,
      functionName: "completeTransfer",
      args: [message, validatorSig],
    });

    console.log(`  [ok] ${targetChain.name} tx: ${hash}`);

    state.processedSolTxIds.push(event.txSignature);
    saveState(state);
  } catch (err: any) {
    console.error(`  [error] relay failed: ${err.message}`);
  }
}

async function watchSolanaBridgeOut(
  connection: Connection,
  programId: PublicKey,
  state: RelayerState,
): Promise<void> {
  console.log(`[solana] watching program ${programId.toBase58()} for BridgeOut events`);

  const POLL_INTERVAL = 10_000;

  async function poll() {
    try {
      const opts: any = { limit: 50, commitment: "confirmed" };
      if (state.lastSolSignature) {
        opts.until = state.lastSolSignature;
      }

      const sigs: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(
        programId,
        opts,
        "confirmed"
      );

      if (sigs.length === 0) return;

      for (const sigInfo of sigs.reverse()) {
        if (state.processedSolTxIds.includes(sigInfo.signature)) continue;

        const tx = await connection.getTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
        if (!tx || !tx.meta || tx.meta.err) continue;

        const logs = tx.meta.logMessages || [];
        for (const log of logs) {
          const parsed = parseBridgeOutLog(log);
          if (!parsed) continue;

          console.log(`\n[detected] BridgeOut in tx ${sigInfo.signature.slice(0, 20)}...`);

          await relaySolanaToEvm(
            { txSignature: sigInfo.signature, ...parsed },
            state,
          );
          break;
        }
      }

      state.lastSolSignature = sigs[0].signature;
      saveState(state);
    } catch (err: any) {
      console.error(`[solana] poll error: ${String(err.message || err).slice(0, 120)}`);
    }
  }

  await poll();
  setInterval(poll, POLL_INTERVAL);
}

async function relayEvmToSolana(
  sourceChain: EvmChainDef,
  transferId: string,
  sender: string,
  amount: bigint,
  recipientBytes32: string,
  state: RelayerState,
): Promise<void> {
  if (state.processedEvmTransferIds.includes(transferId)) return;

  const solanaAmount = amount / DECIMALS_CONVERSION;
  const recipientPubkey = new PublicKey(
    Buffer.from(recipientBytes32.replace("0x", ""), "hex")
  );

  console.log(`\n[relay] ${sourceChain.name} -> Solana`);
  console.log(`  transfer_id: ${transferId}`);
  console.log(`  amount (18d): ${amount} -> (9d): ${solanaAmount}`);
  console.log(`  recipient: ${recipientPubkey.toBase58()}`);

  console.log(`  [pending] EVM->Solana complete_transfer not yet wired (needs Anchor client + keypair)`);
  console.log(`  Solana program ${BRIDGE_PROGRAM_ID} will receive complete_transfer`);
  console.log(`  Required: SOLANA_RELAYER_KEYPAIR env to sign & submit tx`);

  state.processedEvmTransferIds.push(transferId);
  saveState(state);
}

async function watchEvmForSolana(
  chain: EvmChainDef,
  state: RelayerState,
): Promise<void> {
  const client = createPublicClient({
    chain: chain.viemChain,
    transport: http(chain.rpc),
  });

  const latestBlock = await client.getBlockNumber();
  if (!state.lastEvmBlocks[chain.name]) {
    state.lastEvmBlocks[chain.name] = Number(latestBlock);
    saveState(state);
  }

  console.log(`[${chain.name}] watching for Solana-bound transfers (targetChainId=${SOLANA_CHAIN_ID}) from block ${state.lastEvmBlocks[chain.name]}`);

  const POLL_INTERVAL = 10_000;

  function schedulePoll() {
    setTimeout(() => {
      (async () => {
        const latest = await client.getBlockNumber();
        const from = BigInt(state.lastEvmBlocks[chain.name] + 1);
        if (from > latest) return;

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

          const targetChainId = Number(args.targetChainId);
          if (targetChainId !== SOLANA_CHAIN_ID) continue;

          await relayEvmToSolana(
            chain,
            args.transferId,
            args.sender,
            args.amount,
            args.recipientBytes32,
            state,
          );
        }

        state.lastEvmBlocks[chain.name] = Number(toBlock);
        saveState(state);
      })().catch((err) => {
        console.error(`[${chain.name}] poll error: ${String(err.message || err).slice(0, 120)}`);
      }).finally(() => {
        schedulePoll();
      });
    }, POLL_INTERVAL);
  }

  schedulePoll();
}

async function main() {
  const state = loadState();
  const relayerAddr = privateKeyToAccount(RELAYER_KEY).address;
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const programId = new PublicKey(BRIDGE_PROGRAM_ID);

  console.log(`\n=== Solana <-> EVM Bridge Relayer ===`);
  console.log(`Relayer: ${relayerAddr}`);
  console.log(`Solana program: ${BRIDGE_PROGRAM_ID}`);
  console.log(`Solana RPC: ${SOLANA_RPC}`);
  console.log(`Solana chain ID for EVM->SOL: ${SOLANA_CHAIN_ID}`);
  console.log(`EVM chains: ${EVM_CHAINS.map(c => `${c.name}(${c.chainId})`).join(", ") || "none"}`);
  console.log(`Processed: ${state.processedSolTxIds.length} SOL->EVM, ${state.processedEvmTransferIds.length} EVM->SOL`);
  console.log();

  await watchSolanaBridgeOut(connection, programId, state);

  for (const chain of EVM_CHAINS) {
    await watchEvmForSolana(chain, state);
  }

  console.log(`\n[ready] Solana<->EVM Relayer running\n`);
  setInterval(() => {}, 60_000);
}

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err.message);
});
process.on("unhandledRejection", (reason: any) => {
  console.error("[unhandledRejection]", reason?.message || reason);
});

main().catch((error) => {
  console.error("[fatal]", error.message || error);
  process.exit(1);
});
