import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

export interface Agent {
  id: number;
  name: string;
  category: string;
  description: string;
  tflops: number;
  price: number;
  rentPerHr: number;
  uptime: number;
  tasks: number;
  status: string;
  mintAddress: string;
}

export interface StakeStats {
  totalStaked: number;
  currentAPY: number;
  stakers: number;
  lockPeriod: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAgents(): Promise<Agent[]>;
  getStakeStats(): Promise<StakeStats>;
}

const MOCK_AGENTS: Agent[] = [
  { id: 1, name: "NEXUS-7", category: "Security", description: "Military-grade cryptographic AI agent specialized in zero-knowledge proofs and on-chain security auditing.", tflops: 12.4, price: 2800, rentPerHr: 45, uptime: 99.8, tasks: 3241, status: "active", mintAddress: "demo1111111111111111111111111111" },
  { id: 2, name: "AURORA-V", category: "Creative", description: "Generative AI agent for NFT artwork creation, style migration and large-scale digital media production.", tflops: 8.2, price: 1500, rentPerHr: 28, uptime: 97.5, tasks: 1842, status: "active", mintAddress: "demo2222222222222222222222222222" },
  { id: 3, name: "QUANT-DAO", category: "Finance", description: "High-frequency trading and DeFi optimization AI. Processes 50,000+ transactions per second with ML-driven arbitrage.", tflops: 18.7, price: 4200, rentPerHr: 72, uptime: 99.9, tasks: 8934, status: "active", mintAddress: "demo3333333333333333333333333333" },
  { id: 4, name: "ATLAS-9", category: "Analytics", description: "On-chain data analytics agent. Tracks whale wallets, monitors smart contract activity and generates market intelligence reports.", tflops: 6.8, price: 980, rentPerHr: 18, uptime: 98.2, tasks: 2156, status: "idle", mintAddress: "demo4444444444444444444444444444" },
  { id: 5, name: "CIPHER-X", category: "Security", description: "Real-time threat detection agent for DeFi protocols. Monitors for rug pulls, flash loan attacks and abnormal contract behavior.", tflops: 9.5, price: 2100, rentPerHr: 35, uptime: 99.1, tasks: 4782, status: "active", mintAddress: "demo5555555555555555555555555555" },
  { id: 6, name: "SIGMA-3", category: "Trading", description: "Autonomous liquidity management agent for DEX pools. Optimizes fee tiers and rebalances positions using predictive modeling.", tflops: 14.2, price: 3500, rentPerHr: 58, uptime: 99.6, tasks: 6103, status: "active", mintAddress: "demo6666666666666666666666666666" },
  { id: 7, name: "NOVA-AI", category: "Research", description: "Scientific research agent trained on blockchain whitepapers and crypto economics. Generates investment research reports.", tflops: 5.1, price: 750, rentPerHr: 12, uptime: 96.8, tasks: 934, status: "idle", mintAddress: "demo7777777777777777777777777777" },
  { id: 8, name: "VORTEX-1", category: "Trading", description: "Cross-chain arbitrage agent. Monitors price discrepancies across 15+ DEXs on Solana, Ethereum and BSC simultaneously.", tflops: 22.3, price: 5800, rentPerHr: 95, uptime: 99.7, tasks: 12847, status: "active", mintAddress: "demo8888888888888888888888888888" },
];

const MOCK_STAKE_STATS: StakeStats = {
  totalStaked: 8420000,
  currentAPY: 24.5,
  stakers: 1284,
  lockPeriod: 7,
};

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAgents(): Promise<Agent[]> {
    return MOCK_AGENTS;
  }

  async getStakeStats(): Promise<StakeStats> {
    return MOCK_STAKE_STATS;
  }
}

export const storage = new MemStorage();
