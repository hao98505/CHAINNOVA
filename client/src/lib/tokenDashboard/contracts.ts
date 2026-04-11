import { createPublicClient, http, type PublicClient } from "viem";
import { bsc } from "viem/chains";
import { TOKEN_CONFIG } from "@/config/tokenDashboard";

export const ERC20_BALANCE_ABI = [
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
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [walletAddress as `0x${string}`],
  });
}

export async function readTokenTotalSupply(): Promise<bigint> {
  const client = getBscPublicClient();
  return client.readContract({
    address: TOKEN_CONFIG.contractAddress as `0x${string}`,
    abi: ERC20_BALANCE_ABI,
    functionName: "totalSupply",
  });
}
