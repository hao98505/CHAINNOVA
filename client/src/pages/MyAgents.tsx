import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/AgentCard";
import { CreateAgentModal } from "@/components/CreateAgentModal";
import { useMyAgents } from "@/hooks/useChainNova";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Plus, Wallet, Zap, Activity, DollarSign } from "lucide-react";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function MyAgents() {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toBase58();
  const { data: agents, isLoading } = useMyAgents(address);
  const [createOpen, setCreateOpen] = useState(false);
  const { t } = useLanguage();

  if (!connected) {
    return (
      <div className="min-h-full flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-md border border-primary/20 p-10 text-center max-w-md w-full"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-primary/60" />
          </div>
          <h2 className="font-orbitron text-lg font-bold uppercase tracking-wider text-foreground mb-2">
            {t.myAgents.connectTitle}
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            {t.myAgents.connectDesc}
          </p>
          <Button
            className="font-orbitron text-[10px] tracking-wider uppercase w-full"
            onClick={() => setVisible(true)}
            data-testid="button-connect-wallet-agents"
            style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
          >
            <Wallet className="w-3.5 h-3.5 mr-2" />
            {t.myAgents.connectTitle}
          </Button>
        </motion.div>
      </div>
    );
  }

  const totalValue = (agents ?? []).reduce((sum, a) => sum + a.price, 0);
  const totalTasks = (agents ?? []).reduce((sum, a) => sum + a.tasks, 0);
  const avgUptime = agents?.length
    ? (agents.reduce((sum, a) => sum + a.uptime, 0) / agents.length).toFixed(1)
    : "0";

  return (
    <div className="min-h-full px-6 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-orbitron text-2xl font-black uppercase tracking-wider text-foreground neon-glow-text">
              {t.myAgents.title}
            </h1>
            <div className="font-orbitron text-[9px] text-muted-foreground/60 tracking-widest mt-1">
              {address ? truncate(address) : ""}
            </div>
          </div>
          <Button
            className="font-orbitron text-[10px] tracking-wider uppercase gap-2 self-start md:self-auto"
            onClick={() => setCreateOpen(true)}
            data-testid="button-deploy-agent-header"
            style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)", border: "1px solid rgba(167,139,250,0.4)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            {t.myAgents.deployAgent}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: t.myAgents.ownedNFTs, value: isLoading ? "..." : String(agents?.length ?? 0), icon: Bot, color: "text-primary" },
            { label: t.myAgents.portfolioValue, value: isLoading ? "..." : `${totalValue.toLocaleString()} $CNOVA`, icon: DollarSign, color: "text-green-400" },
            { label: t.myAgents.totalTasks, value: isLoading ? "..." : totalTasks.toLocaleString(), icon: Zap, color: "text-yellow-400" },
            { label: t.myAgents.avgUptime, value: isLoading ? "..." : `${avgUptime}%`, icon: Activity, color: "text-blue-400" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card rounded-md border border-primary/15 p-4"
              data-testid={`stat-${i}`}
            >
              <stat.icon className={`w-4 h-4 ${stat.color} mb-2`} />
              <div className={`font-orbitron text-sm font-bold ${stat.color} mb-0.5`}>
                {stat.value}
              </div>
              <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-widest">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-80 rounded-md bg-card/50" />
            ))}
          </div>
        ) : !agents || agents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card rounded-md border border-primary/15 p-12 text-center"
          >
            <Bot className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <div className="font-orbitron text-sm text-muted-foreground uppercase tracking-wider mb-2">
              {t.myAgents.noAgentsTitle}
            </div>
            <p className="text-muted-foreground/60 text-sm mb-6">
              {t.myAgents.noAgentsDesc}
            </p>
            <Button
              className="font-orbitron text-[10px] tracking-wider uppercase gap-2"
              onClick={() => setCreateOpen(true)}
              data-testid="button-empty-deploy"
              style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
            >
              <Plus className="w-3.5 h-3.5" />
              {t.myAgents.deployFirst}
            </Button>
          </motion.div>
        ) : (
          <>
            <div className="mb-3">
              <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest">
                {agents.length} {agents.length !== 1 ? t.myAgents.agentsInCollectionPlural : t.myAgents.agentsInCollection}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent, i) => (
                <AgentCard key={agent.id} agent={agent} index={i} />
              ))}
            </div>
          </>
        )}
      </div>

      <CreateAgentModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
