import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/AgentCard";
import { CreateAgentModal } from "@/components/CreateAgentModal";
import { ParticleBackground } from "@/components/ParticleBackground";
import { useAgents } from "@/hooks/useChainNova";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  Zap, Bot, ArrowRight, TrendingUp, Users, Activity, Shield,
  Plus, Store, Coins
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STATS = [
  { label: "Total Agents", value: "1,842", change: "+12.4%", icon: Bot, color: "text-primary" },
  { label: "Total Volume", value: "$4.2M", change: "+8.7%", icon: TrendingUp, color: "text-green-400" },
  { label: "Active Users", value: "28,493", change: "+23.1%", icon: Users, color: "text-blue-400" },
  { label: "Tasks/Day", value: "142K", change: "+31.5%", icon: Activity, color: "text-yellow-400" },
];

export default function Home() {
  const { data: agents, isLoading } = useAgents();
  const [createOpen, setCreateOpen] = useState(false);
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();

  const hotAgents = agents?.slice(0, 3) ?? [];

  return (
    <div className="min-h-full">
      <section className="relative overflow-hidden min-h-[520px] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F0F1A] via-[#1a0f3a]/60 to-[#0F0F1A]" />
        <div className="absolute inset-0 cyber-grid" />
        <ParticleBackground />

        <div className="absolute top-1/4 left-1/4 w-64 h-64 orb bg-primary/20" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 orb bg-purple-900/15" />
        <div className="absolute top-1/2 right-1/3 w-32 h-32 orb bg-violet-500/10" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-16 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-primary/30 bg-primary/10 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 status-dot" />
              <span className="font-orbitron text-[9px] text-primary tracking-widest uppercase">
                Live on Solana Devnet
              </span>
            </div>

            <h1 className="font-orbitron text-4xl md:text-6xl font-black uppercase tracking-wider mb-4 leading-tight">
              <span className="gradient-text">Decentralized</span>
              <br />
              <span className="text-foreground neon-glow-text">AI Agent Market</span>
            </h1>

            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
              Mint, trade, and deploy autonomous AI agents as NFTs on Solana.
              Earn $CNOVA by contributing compute power to the network.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                className="font-orbitron text-[11px] tracking-wider uppercase gap-2"
                onClick={() => setCreateOpen(true)}
                data-testid="button-hero-deploy"
                style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)", border: "1px solid rgba(167,139,250,0.4)" }}
              >
                <Plus className="w-4 h-4" />
                Deploy Agent
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="font-orbitron text-[11px] tracking-wider uppercase gap-2 border-primary/30"
                asChild
              >
                <Link href="/marketplace">
                  <Store className="w-4 h-4" />
                  Browse Market
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 mt-10">
              {["Phantom", "Solflare", "Anchor Protocol"].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-primary/60" />
                  <span className="font-orbitron text-[9px] text-muted-foreground/60 tracking-widest uppercase">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </section>

      <section className="px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-md border border-primary/15 p-4"
                data-testid={`card-stat-${stat.label.toLowerCase().replace(" ", "-")}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="font-orbitron text-[8px] text-green-400 tracking-wider">
                    {stat.change}
                  </span>
                </div>
                <div className={`font-orbitron text-2xl font-black ${stat.color} mb-1`}>
                  {stat.value}
                </div>
                <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-orbitron text-lg font-bold uppercase tracking-wider text-foreground neon-glow-text">
                Hot Agents
              </h2>
              <p className="font-orbitron text-[9px] text-muted-foreground/60 tracking-widest uppercase mt-1">
                Top performing agents this week
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="font-orbitron text-[9px] tracking-wider uppercase border-primary/30 gap-1"
              asChild
            >
              <Link href="/marketplace">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-72 rounded-md bg-card/50" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {hotAgents.map((agent, i) => (
                <AgentCard key={agent.id} agent={agent} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-6 pb-12">
        <div className="max-w-5xl mx-auto">
          <div className="glass-card rounded-md border border-primary/20 p-8 relative overflow-hidden">
            <div className="absolute inset-0 cyber-grid opacity-20" />
            <div className="absolute top-0 right-0 w-64 h-64 orb bg-primary/10" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="font-orbitron text-[9px] text-primary tracking-widest uppercase mb-2">
                  Earn Passive Income
                </div>
                <h2 className="font-orbitron text-2xl font-black uppercase tracking-wider text-foreground mb-2">
                  Stake $CNOVA
                </h2>
                <p className="text-muted-foreground text-sm max-w-md">
                  Lock your $CNOVA tokens to earn up to 24.5% APY while helping secure the network.
                  Rewards compound automatically.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="text-center">
                  <div className="font-orbitron text-4xl font-black text-primary">24.5%</div>
                  <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest">APY</div>
                </div>
                <Button
                  size="lg"
                  className="font-orbitron text-[10px] tracking-wider uppercase gap-2"
                  asChild
                  style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
                >
                  <Link href="/stake">
                    <Coins className="w-4 h-4" />
                    Start Staking
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CreateAgentModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
