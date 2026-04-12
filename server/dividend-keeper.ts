/**
 * DividendKeeper — BSC CNOVA sell-detection watcher
 *
 * Monitors CNOVA Transfer events on BSC. When an outgoing transfer from a
 * registered holder is detected, calls HolderDividend.updateBalance(from).
 * updateBalance is permissionless — anyone can call it for any address.
 *
 * Flow:
 *   Transfer(from, to, amount) detected
 *     → if `from` is in the registered cache
 *     → call HolderDividend.updateBalance(from)
 *     → contract checks token.balanceOf(from) vs registeredBalance
 *     → if sold: user is invalidated on-chain, forfeit added to pool
 *     → if bought more: weighted start time updated
 *
 * Also handles top-ups (transfers IN to a registered user) by calling
 * updateBalance(to) when `to` is registered.
 *
 * Start with: npx tsx server/dividend-keeper.ts
 * Required env vars:
 *   KEEPER_PRIVATE_KEY or PRIVATE_KEY  — private key for the keeper EOA
 *   HOLDER_DIVIDEND_ADDRESS            — deployed HolderDividend contract
 *   BSC_RPC_URL (optional)             — defaults to publicnode
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  getAddress,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";
import * as fs from "fs";

// ─── Config ───────────────────────────────────────────────────────────────────

const KEEPER_KEY = (
  process.env.KEEPER_PRIVATE_KEY || process.env.PRIVATE_KEY
) as `0x${string}`;

const DIVIDEND_ADDRESS = process.env.HOLDER_DIVIDEND_ADDRESS as Address;
const CNOVA_TOKEN      = "0x0a9c2e3cda80a828334bfa2577a75a85229f7777" as Address;
const BSC_RPC          = process.env.BSC_RPC_URL || "https://bsc-rpc.publicnode.com";

const STATE_FILE = "./dividend-keeper-state.json";
const POLL_MS    = 12_000;   // ~1 BSC block
const RETRY_DELAY_MS = 5_000;

// ─── ABI fragments ───────────────────────────────────────────────────────────

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

const HOLDER_DIVIDEND_ABI = [
  {
    type: "function",
    name: "updateBalance",
    inputs: [{ name: "user", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "registeredList",
    inputs: [{ name: "idx", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "settlementCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "users",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "registeredBalance", type: "uint256" },
      { name: "weightedStartTs",   type: "uint256" },
      { name: "nextSettlementIdx", type: "uint256" },
      { name: "totalClaimed",      type: "uint256" },
      { name: "registeredAt",      type: "uint256" },
      { name: "registered",        type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;

// ─── State ────────────────────────────────────────────────────────────────────

interface KeeperState {
  lastBlock: bigint;
  registeredCache: string[]; // checksummed addresses
}

function loadState(): KeeperState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return {
      lastBlock: BigInt(raw.lastBlock ?? 0),
      registeredCache: raw.registeredCache ?? [],
    };
  } catch {
    return { lastBlock: 0n, registeredCache: [] };
  }
}

function saveState(state: KeeperState) {
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({ lastBlock: state.lastBlock.toString(), registeredCache: state.registeredCache }),
    "utf8"
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!KEEPER_KEY)       { console.error("[致命] 缺少 KEEPER_PRIVATE_KEY / PRIVATE_KEY"); process.exit(1); }
  if (!DIVIDEND_ADDRESS) { console.error("[致命] 缺少 HOLDER_DIVIDEND_ADDRESS");           process.exit(1); }

  const account = privateKeyToAccount(KEEPER_KEY);

  const publicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });
  const walletClient = createWalletClient({ account, chain: bsc, transport: http(BSC_RPC) });

  console.log("\n=== Dividend Keeper ===");
  console.log(`Keeper     : ${account.address}`);
  console.log(`Dividend   : ${DIVIDEND_ADDRESS}`);
  console.log(`CNOVA      : ${CNOVA_TOKEN}`);
  console.log(`BSC RPC    : ${BSC_RPC}`);

  const state = loadState();

  // Seed start block from chain if first run
  if (state.lastBlock === 0n) {
    state.lastBlock = await publicClient.getBlockNumber() - 1n;
    console.log(`[初始化] 从区块 ${state.lastBlock} 开始监听`);
  } else {
    console.log(`[恢复] 从区块 ${state.lastBlock} 继续`);
  }

  // ── Sync registered user cache from contract ──────────────────────────────
  await syncRegisteredCache(publicClient, state);
  console.log(`[缓存] 已注册用户: ${state.registeredCache.length} 个`);

  // ── Poll loop ──────────────────────────────────────────────────────────────
  while (true) {
    try {
      await poll(publicClient, walletClient, state);
    } catch (err) {
      console.warn(`[轮询错误]`, err instanceof Error ? err.message : err);
      await sleep(RETRY_DELAY_MS);
    }

    await sleep(POLL_MS);
  }
}

// ─── Sync registered cache ────────────────────────────────────────────────────

// Deployment block of HolderDividend — skip all blocks before this to avoid RPC range limits.
// If unknown, set to 0n and the keeper will fall back to state.lastBlock.
const DIVIDEND_DEPLOY_BLOCK = BigInt(process.env.DIVIDEND_DEPLOY_BLOCK ?? 0);

async function syncRegisteredCache(publicClient: ReturnType<typeof createPublicClient>, state: KeeperState) {
  // Read Registered events from HolderDividend to get all ever-registered addresses.
  // Start from the deployment block (or the current polling cursor) to stay within RPC log limits.
  const fromBlock = DIVIDEND_DEPLOY_BLOCK > BigInt(0) ? DIVIDEND_DEPLOY_BLOCK : state.lastBlock;
  try {
    const logs = await publicClient.getLogs({
      address: DIVIDEND_ADDRESS,
      event: parseAbiItem("event Registered(address indexed user, uint256 balance)"),
      fromBlock,
    });
    const addrs = new Set<string>(state.registeredCache.map(a => a.toLowerCase()));
    for (const log of logs) {
      if (log.args.user) addrs.add(log.args.user.toLowerCase());
    }
    // Also include any Invalidated users in addrs to check them (they'll be ignored on-chain)
    state.registeredCache = Array.from(addrs).map(a => getAddress(a));
  } catch (err) {
    console.warn("[缓存同步失败]", err instanceof Error ? err.message : err);
  }
}

// ─── Poll ─────────────────────────────────────────────────────────────────────

async function poll(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  state: KeeperState
) {
  const latestBlock = await publicClient.getBlockNumber();
  if (latestBlock <= state.lastBlock) return;

  const fromBlock = state.lastBlock + 1n;
  const toBlock   = latestBlock;

  // Fetch CNOVA Transfer events in this range
  const transfers = await publicClient.getLogs({
    address: CNOVA_TOKEN,
    event: TRANSFER_EVENT,
    fromBlock,
    toBlock,
  });

  if (transfers.length === 0) {
    state.lastBlock = toBlock;
    saveState(state);
    return;
  }

  console.log(`[区块 ${fromBlock}–${toBlock}] 发现 ${transfers.length} 笔 Transfer`);

  const registeredSet = new Set(state.registeredCache.map(a => a.toLowerCase()));
  const toUpdate = new Set<Address>();

  for (const log of transfers) {
    const from = log.args.from?.toLowerCase();
    const to   = log.args.to?.toLowerCase();

    // Outgoing from registered user → possible sell
    if (from && registeredSet.has(from)) {
      toUpdate.add(getAddress(from) as Address);
    }

    // Incoming to registered user → possible top-up buy
    if (to && registeredSet.has(to)) {
      toUpdate.add(getAddress(to) as Address);
    }

    // New potential registered user: also add `from` address to check
    // (they might have registered since our last cache sync)
    if (from) {
      const fromAddr = getAddress(from) as Address;
      if (!registeredSet.has(from)) {
        // Check if they're now in the dividend contract (cheap view call)
        try {
          const u = await publicClient.readContract({
            address: DIVIDEND_ADDRESS,
            abi: HOLDER_DIVIDEND_ABI,
            functionName: "users",
            args: [fromAddr],
          });
          if (u[5] /* registered */) {
            state.registeredCache.push(fromAddr);
            registeredSet.add(from);
            toUpdate.add(fromAddr);
          }
        } catch {}
      }
    }
  }

  // Fire updateBalance for each affected address
  for (const addr of toUpdate) {
    await callUpdateBalance(walletClient, addr);
    await sleep(500); // avoid rate limiting
  }

  state.lastBlock = toBlock;
  saveState(state);

  // Periodic cache re-sync every ~100 blocks
  if (toBlock - state.lastBlock > 100n) {
    await syncRegisteredCache(publicClient, state);
  }
}

// ─── Contract call ────────────────────────────────────────────────────────────

async function callUpdateBalance(
  walletClient: ReturnType<typeof createWalletClient>,
  user: Address
) {
  try {
    const hash = await walletClient.writeContract({
      address: DIVIDEND_ADDRESS,
      abi: HOLDER_DIVIDEND_ABI,
      functionName: "updateBalance",
      args: [user],
      chain: bsc,
    });
    console.log(`[updateBalance] ${user} → tx ${hash}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // "execution reverted" is expected when user has no change — not a real error
    if (!msg.includes("reverted")) {
      console.warn(`[updateBalance 失败] ${user}: ${msg.slice(0, 80)}`);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error("[致命错误]", err);
  process.exit(1);
});
