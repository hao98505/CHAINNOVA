import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatUnits,
  parseUnits,
  pad,
  getAddress,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
  type Hash,
} from "viem";

export interface EvmChainConfig {
  id: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  explorerUrl: string;
  bridgeAddress: Address;
  wrappedToken?: Address;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export const EVM_CHAINS: Record<string, EvmChainConfig> = {
  bsc: {
    id: 56,
    name: "BNB Smart Chain",
    shortName: "BSC",
    rpcUrl: "https://bsc-dataseed1.binance.org",
    explorerUrl: "https://bscscan.com",
    bridgeAddress: (import.meta.env.VITE_BRIDGE_BSC || "0x0000000000000000000000000000000000000000") as Address,
    wrappedToken: (import.meta.env.VITE_BSC_TOKEN || "0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff") as Address,
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  },
  arbitrum: {
    id: 42161,
    name: "Arbitrum One",
    shortName: "ARB",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorerUrl: "https://arbiscan.io",
    bridgeAddress: (import.meta.env.VITE_BRIDGE_ARBITRUM || "0x0000000000000000000000000000000000000000") as Address,
    wrappedToken: (import.meta.env.VITE_WRAPPED_FORGAI_ARBITRUM || undefined) as Address | undefined,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  },
  ethereum: {
    id: 1,
    name: "Ethereum",
    shortName: "ETH",
    rpcUrl: "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
    bridgeAddress: (import.meta.env.VITE_BRIDGE_ETHEREUM || "0x0000000000000000000000000000000000000000") as Address,
    wrappedToken: (import.meta.env.VITE_WRAPPED_FORGAI_ETHEREUM || undefined) as Address | undefined,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  },
};

const ERC20_ABI = [
  { type: "function", name: "name", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
] as const;

const BRIDGE_ABI = [
  {
    type: "function",
    name: "bridgeOut",
    inputs: [
      { name: "localToken", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "targetChainId", type: "uint256" },
      { name: "recipientBytes32", type: "bytes32" },
    ],
    outputs: [{ name: "transferId", type: "bytes32" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "flatFeeWei",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "BridgeTransferInitiated",
    inputs: [
      { name: "transferId", type: "bytes32", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "localToken", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "targetChainId", type: "uint256", indexed: false },
      { name: "recipientBytes32", type: "bytes32", indexed: false },
    ],
  },
] as const;

export interface TokenMeta {
  name: string;
  symbol: string;
  decimals: number;
  address: Address;
}

export interface BridgeQuote {
  receiveAmount: string;
  protocolFee: string;
  route: string;
  eta: string;
}

export interface BridgeResult {
  txHash: Hash;
  transferId?: string;
  explorerUrl: string;
}

export function getViemChain(config: EvmChainConfig): Chain {
  return {
    id: config.id,
    name: config.name,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: { default: { http: [config.rpcUrl] } },
    blockExplorers: { default: { name: config.shortName, url: config.explorerUrl } },
  } as Chain;
}

export function getPublicClient(chainKey: string): PublicClient {
  const config = EVM_CHAINS[chainKey];
  if (!config) throw new Error(`Unknown chain: ${chainKey}`);
  return createPublicClient({ chain: getViemChain(config), transport: http(config.rpcUrl) });
}

function getWalletClient(chainKey: string): WalletClient {
  const config = EVM_CHAINS[chainKey];
  if (!config) throw new Error(`Unknown chain: ${chainKey}`);
  if (!window.ethereum) throw new Error("No EVM wallet found");
  return createWalletClient({ chain: getViemChain(config), transport: custom(window.ethereum) });
}

export async function connectBridgeWallet(): Promise<Address> {
  if (!window.ethereum) throw new Error("Please install MetaMask or an EVM wallet");
  const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts || accounts.length === 0) throw new Error("No accounts found");
  return getAddress(accounts[0]) as Address;
}

export async function switchBridgeChain(chainKey: string): Promise<void> {
  const config = EVM_CHAINS[chainKey];
  if (!config) throw new Error(`Unknown chain: ${chainKey}`);
  if (!window.ethereum) throw new Error("No EVM wallet found");
  const chainIdHex = `0x${config.id.toString(16)}`;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
  } catch (err: any) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: chainIdHex, chainName: config.name, nativeCurrency: config.nativeCurrency, rpcUrls: [config.rpcUrl], blockExplorerUrls: [config.explorerUrl] }],
      });
    } else {
      throw err;
    }
  }
}

export async function getTokenMeta(chainKey: string, tokenAddress: Address): Promise<TokenMeta> {
  const client = getPublicClient(chainKey);
  const [name, symbol, decimals] = await Promise.all([
    client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "name" }),
    client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "symbol" }),
    client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "decimals" }),
  ]);
  return { name: name as string, symbol: symbol as string, decimals: decimals as number, address: tokenAddress };
}

export async function getTokenBalance(chainKey: string, tokenAddress: Address, account: Address): Promise<string> {
  const client = getPublicClient(chainKey);
  const [balance, decimals] = await Promise.all([
    client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "balanceOf", args: [account] }),
    client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "decimals" }),
  ]);
  return formatUnits(balance as bigint, decimals as number);
}

export async function getAllowance(chainKey: string, tokenAddress: Address, owner: Address, spender: Address): Promise<string> {
  const client = getPublicClient(chainKey);
  const [allowance, decimals] = await Promise.all([
    client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "allowance", args: [owner, spender] }),
    client.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: "decimals" }),
  ]);
  return formatUnits(allowance as bigint, decimals as number);
}

export async function approveBridge(chainKey: string, tokenAddress: Address, spender: Address, amount: string, decimals: number): Promise<Hash> {
  const config = EVM_CHAINS[chainKey];
  const walletClient = getWalletClient(chainKey);
  const [account] = await walletClient.getAddresses();
  const amountWei = parseUnits(amount, decimals);
  const hash = await walletClient.writeContract({
    address: tokenAddress, abi: ERC20_ABI, functionName: "approve",
    args: [spender, amountWei], account, chain: getViemChain(config),
  });
  return hash;
}

export function evmAddressToBytes32(address: Address): `0x${string}` {
  return pad(address, { size: 32 }) as `0x${string}`;
}

export function solanaAddressToBytes32(solanaAddress: string): `0x${string}` {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  if (!solanaAddress || solanaAddress.length < 32 || solanaAddress.length > 44) {
    throw new Error("Invalid Solana address: must be 32-44 characters");
  }
  for (const ch of solanaAddress) {
    if (!alphabet.includes(ch)) throw new Error("Invalid Solana address: invalid base58 character");
  }
  let n = BigInt(0);
  for (const ch of solanaAddress) {
    n = n * BigInt(58) + BigInt(alphabet.indexOf(ch));
  }
  const hexRaw = n.toString(16);
  if (hexRaw.length > 64) {
    throw new Error("Invalid Solana address: decoded value exceeds 32 bytes");
  }
  return ("0x" + hexRaw.padStart(64, "0")) as `0x${string}`;
}

export async function getBridgeFee(chainKey: string): Promise<bigint> {
  const config = EVM_CHAINS[chainKey];
  if (!config || config.bridgeAddress === "0x0000000000000000000000000000000000000000") return BigInt(0);
  try {
    const client = getPublicClient(chainKey);
    const fee = await client.readContract({ address: config.bridgeAddress, abi: BRIDGE_ABI, functionName: "flatFeeWei" });
    return fee as bigint;
  } catch {
    return BigInt(0);
  }
}

export async function bridgeToSolana(params: {
  fromChainKey: string;
  amount: string;
  decimals: number;
  recipientSolanaAddress: string;
}): Promise<BridgeResult> {
  const fromConfig = EVM_CHAINS[params.fromChainKey];
  if (!fromConfig) throw new Error("Invalid source chain");
  if (!fromConfig.wrappedToken) throw new Error("Wrapped token not configured for this chain");
  if (fromConfig.bridgeAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Bridge contract not configured");
  }

  await switchBridgeChain(params.fromChainKey);

  const walletClient = getWalletClient(params.fromChainKey);
  const [account] = await walletClient.getAddresses();
  const amountWei = parseUnits(params.amount, params.decimals);
  const recipientBytes32 = solanaAddressToBytes32(params.recipientSolanaAddress);
  const fee = await getBridgeFee(params.fromChainKey);

  const SOLANA_CHAIN_ID = BigInt(999999999);

  const hash = await walletClient.writeContract({
    address: fromConfig.bridgeAddress,
    abi: BRIDGE_ABI,
    functionName: "bridgeOut",
    args: [fromConfig.wrappedToken, amountWei, SOLANA_CHAIN_ID, recipientBytes32],
    value: fee,
    account,
    chain: getViemChain(fromConfig),
  });

  return {
    txHash: hash,
    explorerUrl: `${fromConfig.explorerUrl}/tx/${hash}`,
  };
}

export function getWrappedTokenForChain(chainKey: string): Address | undefined {
  return EVM_CHAINS[chainKey]?.wrappedToken;
}

export function getSourceTokenForChain(chainKey: string): Address | undefined {
  const config = EVM_CHAINS[chainKey];
  if (!config) return undefined;
  if (chainKey === "bsc") {
    return (import.meta.env.VITE_BSC_TOKEN || "0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff") as Address;
  }
  return config.wrappedToken;
}
