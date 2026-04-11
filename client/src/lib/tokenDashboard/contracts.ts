import { createPublicClient, http, type PublicClient } from "viem";
import { bsc } from "viem/chains";
import { TOKEN_CONFIG } from "@/config/tokenDashboard";
import type { OnChainTokenMeta } from "./types";

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

export async function readTokenBalance(
  walletAddress: string,
): Promise<bigint> {
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
  const addr = TOKEN_CONFIG.contractAddress as `0x${string}`;

  const [name, symbol, decimals] = await Promise.all([
    client.readContract({ address: addr, abi: ERC20_ABI, functionName: "name" }),
    client.readContract({ address: addr, abi: ERC20_ABI, functionName: "symbol" }),
    client.readContract({ address: addr, abi: ERC20_ABI, functionName: "decimals" }),
  ]);

  return {
    name: name as string,
    symbol: symbol as string,
    decimals: Number(decimals),
  };
}
