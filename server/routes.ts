import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/agents", async (_req, res) => {
    const agents = await storage.getAgents();
    res.json(agents);
  });

  app.get("/api/stake", async (_req, res) => {
    const stats = await storage.getStakeStats();
    res.json(stats);
  });

  return httpServer;
}
