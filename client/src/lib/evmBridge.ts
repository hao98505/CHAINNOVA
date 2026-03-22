import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatUnits,
  parseUnits,
  encodeFunctionData,
  decodeEventLog,
  pad,
  getAddress,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
  type Hash,
} from "viem";

export const FORGAI_TOKEN: Address = "0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff";

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
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  },
  opbnb: {
    id: 204,
    name: "opBNB",
    shortName: "opBNB",
    rpcUrl: "https://opbnb-mainnet-rpc.bnbchain.org",
    explorerUrl: "https://opbnbscan.com",
    bridgeAddress: (import.meta.env.VITE_BRIDGE_OPBNB || "0x0000000000000000000000000000000000000000") as Address,
    wrappedToken: (import.meta.env.VITE_WRAPPED_FORGAI_OPBNB || undefined) as Address | undefined,
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

function getViemChain(config: EvmChainConfig): Chain {
  return {
    id: config.id,
    name: config.name,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: {
      default: { http: [config.rpcUrl] },
    },
    blockExplorers: {
      default: { name: config.shortName, url: config.explorerUrl },
    },
  } as Chain;
}

export function getPublicClient(chainKey: string): PublicClient {
  const config = EVM_CHAINS[chainKey];
  if (!config) throw new Error(`Unknown chain: ${chainKey}`);
  return createPublicClient({
    chain: getViemChain(config),
    transport: http(config.rpcUrl),
  });
}

function getWalletClient(chainKey: string): WalletClient {
  const config = EVM_CHAINS[chainKey];
  if (!config) throw new Error(`Unknown chain: ${chainKey}`);
  if (!window.ethereum) throw new Error("No EVM wallet found");
  return createWalletClient({
    chain: getViemChain(config),
    transport: custom(window.ethereum),
  });
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
        params: [{
          chainId: chainIdHex,
          chainName: config.name,
          nativeCurrency: config.nativeCurrency,
          rpcUrls: [config.rpcUrl],
          blockExplorerUrls: [config.explorerUrl],
        }],
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
  const walletClient = getWalletClient(chainKey);
  const [account] = await walletClient.getAddresses();
  const amountWei = parseUnits(amount, decimals);
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, amountWei],
    account,
  });
  return hash;
}

export function evmAddressToBytes32(address: Address): `0x${string}` {
  return pad(address, { size: 32 }) as `0x${string}`;
}

export async function getBridgeFee(chainKey: string): Promise<bigint> {
  const config = EVM_CHAINS[chainKey];
  if (!config || config.bridgeAddress === "0x0000000000000000000000000000000000000000") return 0n;
  try {
    const client = getPublicClient(chainKey);
    const fee = await client.readContract({
      address: config.bridgeAddress,
      abi: BRIDGE_ABI,
      functionName: "flatFeeWei",
    });
    return fee as bigint;
  } catch {
    return 0n;
  }
}

export async function bridgeForgAI(params: {
  fromChainKey: string;
  toChainKey: string;
  amount: string;
  decimals: number;
  recipient?: Address;
}): Promise<BridgeResult> {
  const fromConfig = EVM_CHAINS[params.fromChainKey];
  const toConfig = EVM_CHAINS[params.toChainKey];
  if (!fromConfig || !toConfig) throw new Error("Invalid chain configuration");
  if (fromConfig.bridgeAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Bridge contract not configured. Set VITE_BRIDGE_BSC in environment.");
  }

  await switchBridgeChain(params.fromChainKey);

  const walletClient = getWalletClient(params.fromChainKey);
  const [account] = await walletClient.getAddresses();
  const recipient = params.recipient || account;
  const amountWei = parseUnits(params.amount, params.decimals);
  const recipientBytes32 = evmAddressToBytes32(recipient);
  const fee = await getBridgeFee(params.fromChainKey);

  const hash = await walletClient.writeContract({
    address: fromConfig.bridgeAddress,
    abi: BRIDGE_ABI,
    functionName: "bridgeOut",
    args: [FORGAI_TOKEN, amountWei, BigInt(toConfig.id), recipientBytes32],
    value: fee,
    account,
  });

  return {
    txHash: hash,
    explorerUrl: `${fromConfig.explorerUrl}/tx/${hash}`,
  };
}

export function quoteForgAIBridge(amount: string, fromChainKey: string, toChainKey: string): BridgeQuote {
  const fromConfig = EVM_CHAINS[fromChainKey];
  const toConfig = EVM_CHAINS[toChainKey];
  const parsedAmount = parseFloat(amount) || 0;
  const feePercent = 0.3;
  const fee = parsedAmount * (feePercent / 100);
  const receive = Math.max(parsedAmount - fee, 0);

  return {
    receiveAmount: receive.toFixed(4),
    protocolFee: `${fee.toFixed(4)} FORGAI + gas`,
    route: `${fromConfig?.shortName || fromChainKey} → CNovaBridge → ${toConfig?.shortName || toChainKey}`,
    eta: toChainKey === "opbnb" ? "~1 min" : "~2-5 min",
  };
}
