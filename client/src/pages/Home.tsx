import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/AgentCard";
import { CreateAgentModal } from "@/components/CreateAgentModal";
import { ParticleBackground } from "@/components/ParticleBackground";
import { TokenDashboard } from "@/components/home/TokenDashboard";
import { useAgents } from "@/hooks/useChainNova";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useCallback } from "react";
import {
  Zap, Bot, ArrowRight, TrendingUp, Users, Activity, Shield,
  Plus, Store, Coins, BarChart3
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: agents, isLoading } = useAgents();
  const [createOpen, setCreateOpen] = useState(false);
  const { t } = useLanguage();

  const hotAgents = agents?.slice(0, 3) ?? [];

  const STATS = [
    { labelKey: "statTotalAgents" as const, value: "1,842", change: "+12.4%", icon: Bot, color: "text-primary" },
    { labelKey: "statVolume" as const, value: "$4.2M", change: "+8.7%", icon: TrendingUp, color: "text-green-400" },
    { labelKey: "statUsers" as const, value: "28,493", change: "+23.1%", icon: Users, color: "text-blue-400" },
    { labelKey: "statTasks" as const, value: "142K", change: "+31.5%", icon: Activity, color: "text-yellow-400" },
  ];

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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-yellow-500/30 bg-yellow-500/10 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 status-dot" />
              <span className="text-xs font-semibold text-yellow-300 tracking-widest uppercase">
                {t.home.liveBadge}
              </span>
            </div>

            <h1 className="font-orbitron text-4xl md:text-6xl font-black uppercase tracking-wider mb-4 leading-tight">
              <span className="gradient-text">{t.home.heroTitle1}</span>
              <br />
              <span className="text-foreground neon-glow-text">{t.home.heroTitle2}</span>
            </h1>

            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
              {t.home.heroDesc}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                className="text-sm font-semibold tracking-wide uppercase gap-2"
                onClick={() => setCreateOpen(true)}
                data-testid="button-hero-deploy"
                style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)", border: "1px solid rgba(167,139,250,0.4)" }}
              >
                <Plus className="w-4 h-4" />
                {t.home.deployAgent}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-sm font-semibold tracking-wide uppercase gap-2 border-primary/30"
                asChild
              >
                <Link href="/marketplace">
                  <Store className="w-4 h-4" />
                  {t.home.browseMarket}
                </Link>
              </Button>
            </div>

            <button
              onClick={() => {
                const el = document.getElementById("token-dashboard");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 text-sm text-yellow-300/90 hover:text-yellow-200 border border-yellow-500/25 hover:border-yellow-400/40 rounded bg-yellow-500/5 hover:bg-yellow-500/10 transition-all tracking-wide uppercase"
              data-testid="button-hero-dashboard"
            >
              <BarChart3 className="w-4 h-4" />
              {t.home.viewDashboard}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="flex flex-wrap items-center justify-center gap-6 mt-6">
              {["MetaMask", "BSC", "Phantom", "Solflare"].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-primary/60" />
                  <span className="text-xs text-muted-foreground/80 tracking-wide uppercase">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </section>

      <TokenDashboard />

      <section className="px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.labelKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-md border border-primary/15 p-4"
                data-testid={`card-stat-${stat.labelKey}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-xs text-green-400 font-medium tracking-wide">
                    {stat.change}
                  </span>
                </div>
                <div className={`font-orbitron text-2xl font-black ${stat.color} mb-1`}>
                  {stat.value}
                </div>
                <div className="text-xs text-muted-foreground/80 uppercase tracking-wide">
                  {t.home[stat.labelKey]}
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
                {t.home.hotAgents}
              </h2>
              <p className="text-xs text-muted-foreground/80 tracking-wide uppercase mt-1">
                {t.home.hotAgentsDesc}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-medium tracking-wide uppercase border-primary/30 gap-1"
              asChild
            >
              <Link href="/marketplace">
                {t.home.viewAll} <ArrowRight className="w-3 h-3" />
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
                <div className="text-xs font-semibold text-primary tracking-wide uppercase mb-2">
                  {t.home.earnPassive}
                </div>
                <h2 className="font-orbitron text-2xl font-black uppercase tracking-wider text-foreground mb-2">
                  {t.home.earnTitle}
                </h2>
                <p className="text-muted-foreground text-sm max-w-md">
                  {t.home.earnDesc}
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="text-center">
                  <div className="font-orbitron text-4xl font-black text-primary">24.5%</div>
                  <div className="text-xs text-muted-foreground/80 uppercase tracking-wide">APY</div>
                </div>
                <Button
                  size="lg"
                  className="text-sm font-semibold tracking-wide uppercase gap-2"
                  asChild
                  style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
                >
                  <Link href="/stake">
                    <Coins className="w-4 h-4" />
                    {t.home.startStaking}
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
