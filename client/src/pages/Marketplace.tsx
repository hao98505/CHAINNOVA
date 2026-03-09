import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AgentCard } from "@/components/AgentCard";
import { CreateAgentModal } from "@/components/CreateAgentModal";
import { useAgents } from "@/hooks/useChainNova";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, SlidersHorizontal, Zap } from "lucide-react";

const CATEGORIES_EN = ["All", "Research", "Security", "Creative", "Finance", "Oracle", "Governance"];

export default function Marketplace() {
  const { data: agents, isLoading } = useAgents();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortIndex, setSortIndex] = useState(0);
  const { t, lang } = useLanguage();

  const SORT_OPTIONS = [
    t.marketplace.sortPriceLow,
    t.marketplace.sortPriceHigh,
    t.marketplace.sortTflops,
    t.marketplace.sortUptime,
    t.marketplace.sortTasks,
  ];

  const SORT_KEYS = ["Price: Low", "Price: High", "TFLOPS", "Uptime", "Tasks"];

  const CATEGORIES_ZH: Record<string, string> = {
    All: t.marketplace.all,
    Research: "研究",
    Security: "安全",
    Creative: "创意",
    Finance: "金融",
    Oracle: "预言机",
    Governance: "治理",
  };

  const filtered = (agents ?? []).filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || a.category === category;
    return matchSearch && matchCat;
  }).sort((a, b) => {
    const sort = SORT_KEYS[sortIndex];
    if (sort === "Price: Low") return a.price - b.price;
    if (sort === "Price: High") return b.price - a.price;
    if (sort === "TFLOPS") return b.tflops - a.tflops;
    if (sort === "Uptime") return b.uptime - a.uptime;
    if (sort === "Tasks") return b.tasks - a.tasks;
    return 0;
  });

  return (
    <div className="min-h-full px-6 py-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-orbitron text-2xl font-black uppercase tracking-wider text-foreground neon-glow-text">
              {t.marketplace.title}
            </h1>
            <p className="font-orbitron text-[9px] text-muted-foreground/60 tracking-widest uppercase mt-1">
              {(agents ?? []).length} {t.marketplace.agentsAvailable}
            </p>
          </div>
          <Button
            className="font-orbitron text-[10px] tracking-wider uppercase gap-2 self-start md:self-auto"
            onClick={() => setCreateOpen(true)}
            data-testid="button-create-agent"
            style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)", border: "1px solid rgba(167,139,250,0.4)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            {t.marketplace.deployAgent}
          </Button>
        </div>

        <div className="glass-card rounded-md border border-primary/15 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.marketplace.searchPlaceholder}
                className="pl-9 cyber-input font-orbitron text-xs tracking-wider"
                data-testid="input-search-agents"
              />
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
              <select
                value={sortIndex}
                onChange={(e) => setSortIndex(Number(e.target.value))}
                className="cyber-input text-[10px] font-orbitron tracking-wider px-3 py-2 rounded-md"
                data-testid="select-sort"
              >
                {SORT_OPTIONS.map((opt, i) => (
                  <option key={i} value={i}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {CATEGORIES_EN.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                data-testid={`filter-${cat.toLowerCase()}`}
                className={`px-3 py-1 rounded border font-orbitron text-[9px] tracking-wider uppercase transition-all ${
                  category === cat
                    ? "bg-primary/30 border-primary/60 text-primary"
                    : "border-border/40 text-muted-foreground/60"
                }`}
              >
                {lang === "zh" ? CATEGORIES_ZH[cat] : cat}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-md bg-card/50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Zap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <div className="font-orbitron text-sm text-muted-foreground uppercase tracking-wider">
              {t.marketplace.noAgents}
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((agent, i) => (
              <AgentCard key={agent.id} agent={agent} index={i} />
            ))}
          </div>
        )}
      </div>

      <CreateAgentModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
