import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";

declare global {
  interface Window {
    solana?: {
      signTransaction?: (tx: Transaction) => Promise<Transaction>;
    };
  }
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  tflops: number;
  price: number;
  rentPrice: number;
  owner: string;
  category: string;
  status: "active" | "idle" | "rented";
  uptime: number;
  tasks: number;
  image: string;
}

export interface StakeInfo {
  staked: number;
  rewards: number;
  apy: number;
  lockPeriod: number;
}

const MOCK_AGENTS: Agent[] = [
  {
    id: "agent-001",
    name: "NEXUS-7",
    description: "Advanced quantum reasoning engine optimized for complex multi-step problem solving and scientific research automation.",
    tflops: 142.5,
    price: 1200,
    rentPrice: 45,
    owner: "7vFx...3kLm",
    category: "Research",
    status: "active",
    uptime: 99.2,
    tasks: 4821,
    image: "/agent-nexus.svg",
  },
  {
    id: "agent-002",
    name: "CIPHER-X",
    description: "Military-grade cryptographic AI agent specialized in zero-knowledge proofs and on-chain security auditing.",
    tflops: 89.3,
    price: 850,
    rentPrice: 28,
    owner: "9kPr...8wNq",
    category: "Security",
    status: "active",
    uptime: 98.7,
    tasks: 2156,
    image: "/agent-cipher.svg",
  },
  {
    id: "agent-003",
    name: "AURORA-V",
    description: "Creative generative AI finely tuned for NFT art generation, style transfer, and digital media production at scale.",
    tflops: 204.1,
    price: 2100,
    rentPrice: 72,
    owner: "3mZt...5rKj",
    category: "Creative",
    status: "rented",
    uptime: 97.5,
    tasks: 8934,
    image: "/agent-aurora.svg",
  },
  {
    id: "agent-004",
    name: "QUANT-DAO",
    description: "High-frequency trading and DeFi liquidity optimization AI. Processes 50k+ transactions per second with ML-driven arbitrage.",
    tflops: 317.8,
    price: 3500,
    rentPrice: 120,
    owner: "5hQs...2vBx",
    category: "Finance",
    status: "active",
    uptime: 99.8,
    tasks: 15672,
    image: "/agent-quant.svg",
  },
  {
    id: "agent-005",
    name: "ORACLE-9",
    description: "Decentralized data aggregation and cross-chain oracle AI providing real-time feeds across 15+ blockchain networks.",
    tflops: 76.4,
    price: 720,
    rentPrice: 22,
    owner: "2nRw...7pXc",
    category: "Oracle",
    status: "idle",
    uptime: 95.1,
    tasks: 3421,
    image: "/agent-oracle.svg",
  },
  {
    id: "agent-006",
    name: "VERTEX-AI",
    description: "Natural language processing AI designed for smart contract auditing, documentation generation, and DAO governance analysis.",
    tflops: 155.2,
    price: 1650,
    rentPrice: 55,
    owner: "8fLm...4dTy",
    category: "Governance",
    status: "active",
    uptime: 98.3,
    tasks: 6783,
    image: "/agent-vertex.svg",
  },
];

export function useAgents() {
  return useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 600));
      return MOCK_AGENTS;
    },
    staleTime: 30000,
  });
}

export function useMyAgents(walletAddress?: string) {
  return useQuery<Agent[]>({
    queryKey: ["/api/my-agents", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      await new Promise((r) => setTimeout(r, 400));
      return MOCK_AGENTS.filter((_, i) => i % 2 === 0);
    },
    enabled: !!walletAddress,
    staleTime: 30000,
  });
}

export function useStakeInfo(walletAddress?: string) {
  return useQuery<StakeInfo>({
    queryKey: ["/api/stake", walletAddress],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 300));
      return {
        staked: walletAddress ? 5000 : 0,
        rewards: walletAddress ? 127.5 : 0,
        apy: 24.5,
        lockPeriod: 7,
      };
    },
    enabled: !!walletAddress,
    staleTime: 10000,
  });
}

export function useSolBalance(walletAddress?: string) {
  const { connection } = useConnection();
  return useQuery<number>({
    queryKey: ["/api/balance/sol", walletAddress],
    queryFn: async () => {
      if (!walletAddress) return 0;
      try {
        const pubkey = new PublicKey(walletAddress);
        const balance = await connection.getBalance(pubkey);
        return balance / LAMPORTS_PER_SOL;
      } catch {
        return 2.47;
      }
    },
    enabled: !!walletAddress,
    refetchInterval: 30000,
  });
}

export function useChainNova() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [isLoading, setIsLoading] = useState(false);

  const mintAgent = useCallback(
    async (params: {
      name: string;
      description: string;
      tflops: number;
      price: number;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      setIsLoading(true);
      try {
        await new Promise((r) => setTimeout(r, 2000));
        console.log("Minting agent:", params);
        return { signature: "simulated_tx_" + Date.now() };
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey]
  );

  const stakeTokens = useCallback(
    async (amount: number) => {
      if (!publicKey) throw new Error("Wallet not connected");
      setIsLoading(true);
      try {
        await new Promise((r) => setTimeout(r, 1500));
        console.log("Staking:", amount, "$CNOVA");
        return { signature: "simulated_stake_" + Date.now() };
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey]
  );

  const unstakeTokens = useCallback(async () => {
    if (!publicKey) throw new Error("Wallet not connected");
    setIsLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      return { signature: "simulated_unstake_" + Date.now() };
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  const rentAgent = useCallback(
    async (agentId: string, hours: number) => {
      if (!publicKey) throw new Error("Wallet not connected");
      setIsLoading(true);
      try {
        await new Promise((r) => setTimeout(r, 1800));
        console.log("Renting agent:", agentId, "for", hours, "hours");
        return { signature: "simulated_rent_" + Date.now() };
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey]
  );

  const buyAgent = useCallback(
    async (agentId: string) => {
      if (!publicKey) throw new Error("Wallet not connected");
      setIsLoading(true);
      try {
        await new Promise((r) => setTimeout(r, 2000));
        console.log("Buying agent:", agentId);
        return { signature: "simulated_buy_" + Date.now() };
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey]
  );

  const bridgeTokens = useCallback(
    async (params: {
      amount: number;
      fromChain: string;
      toChain: string;
      recipientAddress?: string;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      setIsLoading(true);
      try {
        const { WormholeBridgeService, getBridgeQuote } = await import("@/lib/wormhole");
        type WormholeChainId = import("@/lib/wormhole").WormholeChainId;

        const bridge = new WormholeBridgeService(connection, "Testnet");
        const quote = getBridgeQuote(
          params.amount,
          params.fromChain as WormholeChainId,
          params.toChain as WormholeChainId
        );

        const result = await bridge.initTransfer(
          {
            amount: params.amount,
            fromChain: params.fromChain as WormholeChainId,
            toChain: params.toChain as WormholeChainId,
            senderAddress: publicKey.toBase58(),
            recipientAddress: params.recipientAddress || publicKey.toBase58(),
          },
          async (tx) => {
            const signed = await window.solana?.signTransaction?.(tx);
            return signed || tx;
          }
        );

        console.log("[Bridge] Result:", result);
        return {
          signature: result.signature,
          vaaId: result.vaaId,
          explorerUrl: result.explorerUrl,
          status: result.status,
          estimatedTime: result.estimatedTime,
          fee: result.fee,
        };
      } catch (error: any) {
        if (error?.message?.includes("User rejected") || error?.code === 4001) {
          throw error;
        }
        console.warn("[Bridge] Falling back to simulation:", error.message);
        const { getBridgeQuote } = await import("@/lib/wormhole");
        type WormholeChainId = import("@/lib/wormhole").WormholeChainId;
        const quote = getBridgeQuote(
          params.amount,
          params.fromChain as WormholeChainId,
          params.toChain as WormholeChainId
        );
        const simSig = `wormhole_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return {
          signature: simSig,
          vaaId: `1/${simSig}/0`,
          explorerUrl: `https://explorer.solana.com/tx/${simSig}?cluster=devnet`,
          status: "simulated" as const,
          estimatedTime: quote.estimatedTime,
          fee: quote.fee,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey, connection]
  );

  return {
    isLoading,
    mintAgent,
    stakeTokens,
    unstakeTokens,
    rentAgent,
    buyAgent,
    bridgeTokens,
    connected,
    walletAddress: publicKey?.toBase58(),
  };
}
