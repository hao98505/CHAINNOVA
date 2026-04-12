import { createPublicClient, http, type PublicClient } from "viem";
import { bsc } from "viem/chains";
import { TOKEN_CONFIG, VAULT_CONTRACT_CONFIG } from "@/config/tokenDashboard";
import type { OnChainTokenMeta } from "./types";

// ─── ERC-20 ABI ───────────────────────────────────────────────────────────────

export const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─── HolderDividend ABI (read-only subset) ────────────────────────────────────

export const HOLDER_DIVIDEND_ABI = [
  {
    type: "function",
    name: "userInfo",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "registered",       type: "bool"    },
      { name: "registeredBalance",type: "uint256" },
      { name: "weightedStartTs",  type: "uint256" },
      { name: "holdingSeconds",   type: "uint256" },
      { name: "registeredAt",     type: "uint256" },
      { name: "nextSettlementIdx",type: "uint256" },
      { name: "userTotalClaimed", type: "uint256" },
      { name: "pendingBnb",       type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "currentWeight",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalCurrentWeight",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "userWeightShare",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "numerator",   type: "uint256" },
      { name: "denominator", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalReceived",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalClaimedGlobal",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
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
    name: "minimumBalance",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ─── LPRewardVault ABI (read-only subset) ─────────────────────────────────────

export const LP_REWARD_VAULT_ABI = [
  {
    type: "function",
    name: "active",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalReceived",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalDistributed",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ─── Client singleton ─────────────────────────────────────────────────────────

let _client: PublicClient | null = null;

export function getBscPublicClient(): PublicClient {
  if (!_client) {
    _client = createPublicClient({
      chain: bsc,
      transport: http(TOKEN_CONFIG.rpcUrl, {
        batch: true,
        retryCount: 2,
        retryDelay: 1000,
        timeout: 10_000,
      }),
    });
  }
  return _client;
}

// ─── Token reads ──────────────────────────────────────────────────────────────

export async function readTokenBalance(walletAddress: string): Promise<bigint> {
  const client = getBscPublicClient();
  return client.readContract({
    address: TOKEN_CONFIG.contractAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [walletAddress as `0x${string}`],
  });
}

export async function readTokenTotalSupply(): Promise<bigint> {
  const client = getBscPublicClient();
  return client.readContract({
    address: TOKEN_CONFIG.contractAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "totalSupply",
  });
}

export async function readOnChainTokenMeta(): Promise<OnChainTokenMeta> {
  const client = getBscPublicClient();
  const addr   = TOKEN_CONFIG.contractAddress as `0x${string}`;
  const [name, symbol, decimals] = await Promise.all([
    client.readContract({ address: addr, abi: ERC20_ABI, functionName: "name" }),
    client.readContract({ address: addr, abi: ERC20_ABI, functionName: "symbol" }),
    client.readContract({ address: addr, abi: ERC20_ABI, functionName: "decimals" }),
  ]);
  return { name: name as string, symbol: symbol as string, decimals: Number(decimals) };
}

// ─── Native BNB balance read ──────────────────────────────────────────────────

/**
 * Read native BNB balance (wei) for any address.
 * Used for vault contracts that hold BNB, not CNOVA.
 */
export async function readBnbBalance(address: string): Promise<bigint> {
  const client = getBscPublicClient();
  return client.getBalance({ address: address as `0x${string}` });
}

// ─── HolderDividend reads ─────────────────────────────────────────────────────

export interface HolderDividendUserInfo {
  registered: boolean;
  registeredBalance: bigint;
  weightedStartTs: bigint;
  holdingSeconds: bigint;
  registeredAt: bigint;
  nextSettlementIdx: bigint;
  userTotalClaimed: bigint;
  pendingBnb: bigint;
  /** weight share percentage 0–100 (2 decimal precision) */
  weightSharePct: number;
  /** current weight = balance × holdingSeconds */
  currentWeightWei: bigint;
}

/**
 * Fetches all 7 user-facing fields from HolderDividend in 2 calls.
 * Returns null if contract address is not set (pre-deployment).
 */
export async function readHolderDividendUserInfo(
  userAddress: string,
): Promise<HolderDividendUserInfo | null> {
  const contractAddr = VAULT_CONTRACT_CONFIG.dividendContract;
  if (!contractAddr) return null;

  const client = getBscPublicClient();
  const addr   = contractAddr as `0x${string}`;

  try {
    const [info, weightShare, cw] = await Promise.all([
      client.readContract({
        address: addr,
        abi: HOLDER_DIVIDEND_ABI,
        functionName: "userInfo",
        args: [userAddress as `0x${string}`],
      }),
      client.readContract({
        address: addr,
        abi: HOLDER_DIVIDEND_ABI,
        functionName: "userWeightShare",
        args: [userAddress as `0x${string}`],
      }),
      client.readContract({
        address: addr,
        abi: HOLDER_DIVIDEND_ABI,
        functionName: "currentWeight",
        args: [userAddress as `0x${string}`],
      }),
    ]);

    const [registered, registeredBalance, weightedStartTs, holdingSeconds,
           registeredAt, nextSettlementIdx, userTotalClaimed, pendingBnb] = info as [
      boolean, bigint, bigint, bigint, bigint, bigint, bigint, bigint
    ];
    const [numerator, denominator] = weightShare as [bigint, bigint];
    const weightSharePct = denominator > BigInt(0)
      ? Number((numerator * BigInt(10000)) / denominator) / 100
      : 0;

    return {
      registered,
      registeredBalance,
      weightedStartTs,
      holdingSeconds,
      registeredAt,
      nextSettlementIdx,
      userTotalClaimed,
      pendingBnb,
      weightSharePct,
      currentWeightWei: cw as bigint,
    };
  } catch (err) {
    console.warn("[HolderDividend] readUserInfo failed:", err);
    return null;
  }
}

// ─── LPRewardVault reads ──────────────────────────────────────────────────────

export interface LpVaultStatus {
  active: boolean;
  bnbBalance: bigint;
  totalReceived: bigint;
  totalDistributed: bigint;
}

export async function readLpRewardVaultStatus(): Promise<LpVaultStatus | null> {
  const contractAddr = VAULT_CONTRACT_CONFIG.lpRewardVault;
  if (!contractAddr) return null;
  const client = getBscPublicClient();
  const addr   = contractAddr as `0x${string}`;
  try {
    const [active, totalReceived, totalDistributed, bnbBalance] = await Promise.all([
      client.readContract({ address: addr, abi: LP_REWARD_VAULT_ABI, functionName: "active" }),
      client.readContract({ address: addr, abi: LP_REWARD_VAULT_ABI, functionName: "totalReceived" }),
      client.readContract({ address: addr, abi: LP_REWARD_VAULT_ABI, functionName: "totalDistributed" }),
      client.getBalance({ address: addr }),
    ]);
    return {
      active: active as boolean,
      bnbBalance,
      totalReceived: totalReceived as bigint,
      totalDistributed: totalDistributed as bigint,
    };
  } catch {
    return null;
  }
}
