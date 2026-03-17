import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

export interface Agent {
  id: string;
  name: string;
  description: string;
  tflops: number;
  price: number;
  rentPrice: number;
  owner: string;
  category: string;
  status: string;
  uptime: number;
  tasks: number;
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
  { id: "agent-001", name: "NEXUS-7", description: "Advanced quantum reasoning engine optimized for complex multi-step problem solving.", tflops: 142.5, price: 1200, rentPrice: 45, owner: "7vFx...3kLm", category: "Research", status: "active", uptime: 99.2, tasks: 4821 },
  { id: "agent-002", name: "CIPHER-X", description: "Military-grade cryptographic AI for zero-knowledge proofs and security auditing.", tflops: 89.3, price: 850, rentPrice: 28, owner: "9kPr...8wNq", category: "Security", status: "active", uptime: 98.7, tasks: 2156 },
  { id: "agent-003", name: "AURORA-V", description: "Generative AI for NFT art creation, style transfer and digital media production.", tflops: 204.1, price: 2100, rentPrice: 72, owner: "3mZt...5rKj", category: "Creative", status: "rented", uptime: 97.5, tasks: 8934 },
  { id: "agent-004", name: "QUANT-DAO", description: "High-frequency trading and DeFi optimization AI processing 50k+ TPS.", tflops: 317.8, price: 3500, rentPrice: 120, owner: "5hQs...2vBx", category: "Finance", status: "active", uptime: 99.8, tasks: 15672 },
  { id: "agent-005", name: "ORACLE-9", description: "Cross-chain oracle AI providing real-time data feeds across 15+ blockchain networks.", tflops: 76.4, price: 720, rentPrice: 22, owner: "2nRw...7pXc", category: "Oracle", status: "idle", uptime: 95.1, tasks: 3421 },
  { id: "agent-006", name: "VERTEX-AI", description: "NLP AI for smart contract auditing, documentation and DAO governance analysis.", tflops: 155.2, price: 1650, rentPrice: 55, owner: "8fLm...4dTy", category: "Governance", status: "active", uptime: 98.3, tasks: 6783 },
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
