import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Agent } from "@/hooks/useChainNova";
import { useChainNova } from "@/hooks/useChainNova";
import { useToast } from "@/hooks/use-toast";
import { Bot, Cpu, Zap, Activity, Clock, ShoppingCart, RotateCcw } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

const CATEGORY_COLORS: Record<string, string> = {
  Research: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  Security: "bg-red-500/20 text-red-300 border-red-500/40",
  Creative: "bg-pink-500/20 text-pink-300 border-pink-500/40",
  Finance: "bg-green-500/20 text-green-300 border-green-500/40",
  Oracle: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  Governance: "bg-purple-500/20 text-purple-300 border-purple-500/40",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-400",
  idle: "bg-yellow-400",
  rented: "bg-blue-400",
};

const AGENT_GRADIENTS = [
  "from-violet-900/60 to-purple-800/40",
  "from-indigo-900/60 to-blue-800/40",
  "from-fuchsia-900/60 to-pink-800/40",
  "from-emerald-900/60 to-teal-800/40",
  "from-amber-900/60 to-orange-800/40",
  "from-cyan-900/60 to-blue-800/40",
];

interface AgentCardProps {
  agent: Agent;
  index?: number;
  compact?: boolean;
}

export function AgentCard({ agent, index = 0, compact = false }: AgentCardProps) {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { buyAgent, rentAgent, isLoading } = useChainNova();
  const { toast } = useToast();
  const [showRentModal, setShowRentModal] = useState(false);
  const [rentHours, setRentHours] = useState(24);

  const gradient = AGENT_GRADIENTS[index % AGENT_GRADIENTS.length];
  const categoryStyle = CATEGORY_COLORS[agent.category] || "bg-primary/20 text-primary border-primary/40";

  const handleBuy = async () => {
    if (!connected) { setVisible(true); return; }
    try {
      await buyAgent(agent.id);
      toast({ title: "Purchase Initiated", description: `Acquiring ${agent.name} NFT...` });
    } catch (e) {
      toast({ title: "Error", description: "Transaction failed", variant: "destructive" });
    }
  };

  const handleRent = async () => {
    if (!connected) { setVisible(true); return; }
    try {
      await rentAgent(agent.id, rentHours);
      toast({ title: "Rental Initiated", description: `Renting ${agent.name} for ${rentHours}h...` });
      setShowRentModal(false);
    } catch (e) {
      toast({ title: "Error", description: "Transaction failed", variant: "destructive" });
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.07 }}
        whileHover={{ y: -4 }}
        className="glass-card rounded-md border border-primary/20 glass-card-hover group cursor-default"
        data-testid={`card-agent-${agent.id}`}
      >
        <div className={`h-32 rounded-t-md bg-gradient-to-br ${gradient} relative overflow-hidden flex items-center justify-center border-b border-primary/10`}>
          <div className="absolute inset-0 cyber-grid opacity-30" />
          <div className="absolute top-3 left-3">
            <span className={`text-[9px] font-orbitron tracking-widest uppercase px-2 py-0.5 rounded border ${categoryStyle}`}>
              {agent.category}
            </span>
          </div>
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[agent.status]} status-dot`} />
            <span className="font-orbitron text-[8px] text-white/70 tracking-widest uppercase">
              {agent.status}
            </span>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-md bg-black/40 border border-primary/30 flex items-center justify-center neon-glow-purple">
              <Bot className="w-7 h-7 text-primary/80" />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        <div className="p-4">
          <div className="mb-3">
            <h3 className="font-orbitron text-sm font-bold text-foreground tracking-wider uppercase mb-1 neon-glow-text"
                data-testid={`text-agent-name-${agent.id}`}>
              {agent.name}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {agent.description}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Cpu className="w-3 h-3 text-primary/70" />
                <span className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-wider">TFLOPS</span>
              </div>
              <span className="font-orbitron text-xs font-bold text-foreground" data-testid={`text-tflops-${agent.id}`}>
                {agent.tflops}
              </span>
            </div>
            <div className="text-center border-x border-border/30">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Activity className="w-3 h-3 text-green-400/70" />
                <span className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-wider">Uptime</span>
              </div>
              <span className="font-orbitron text-xs font-bold text-green-400">
                {agent.uptime}%
              </span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Zap className="w-3 h-3 text-yellow-400/70" />
                <span className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-wider">Tasks</span>
              </div>
              <span className="font-orbitron text-xs font-bold text-foreground">
                {agent.tasks.toLocaleString()}
              </span>
            </div>
          </div>

          {!compact && (
            <div className="flex items-center justify-between mb-3 p-2 rounded-md bg-primary/5 border border-primary/10">
              <div>
                <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Buy Price</div>
                <div className="font-orbitron text-sm font-bold text-foreground" data-testid={`text-price-${agent.id}`}>
                  {agent.price.toLocaleString()} <span className="text-primary text-[10px]">$CNOVA</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Rent/hr</div>
                <div className="font-orbitron text-sm font-bold text-muted-foreground">
                  {agent.rentPrice} <span className="text-primary/70 text-[10px]">$CNOVA</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 font-orbitron text-[9px] tracking-wider uppercase border-primary/30"
              onClick={() => setShowRentModal(true)}
              disabled={isLoading || agent.status === "rented"}
              data-testid={`button-rent-${agent.id}`}
            >
              <Clock className="w-3 h-3 mr-1" />
              Rent
            </Button>
            <Button
              size="sm"
              className="flex-1 font-orbitron text-[9px] tracking-wider uppercase"
              onClick={handleBuy}
              disabled={isLoading}
              data-testid={`button-buy-${agent.id}`}
              style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
            >
              <ShoppingCart className="w-3 h-3 mr-1" />
              Buy
            </Button>
          </div>
        </div>
      </motion.div>

      <Dialog open={showRentModal} onOpenChange={setShowRentModal}>
        <DialogContent className="glass-card border-primary/30 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-orbitron text-sm tracking-wider uppercase text-foreground">
              Rent {agent.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-md bg-primary/5 border border-primary/15">
              <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-widest mb-1">Agent</div>
              <div className="font-orbitron text-xs text-foreground font-semibold">{agent.name}</div>
            </div>

            <div>
              <label className="font-orbitron text-[9px] text-muted-foreground/70 uppercase tracking-widest block mb-2">
                Duration (hours)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 6, 24, 168].map((h) => (
                  <button
                    key={h}
                    onClick={() => setRentHours(h)}
                    data-testid={`button-rent-hours-${h}`}
                    className={`py-2 rounded-md border font-orbitron text-[9px] tracking-wider transition-all ${
                      rentHours === h
                        ? "bg-primary/30 border-primary/60 text-primary"
                        : "border-border/50 text-muted-foreground"
                    }`}
                  >
                    {h < 24 ? `${h}h` : h === 24 ? "1d" : "7d"}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-md bg-primary/5 border border-primary/15 space-y-2">
              <div className="flex justify-between">
                <span className="font-orbitron text-[9px] text-muted-foreground/70 uppercase tracking-wider">Rate</span>
                <span className="font-orbitron text-xs text-foreground">{agent.rentPrice} $CNOVA/hr</span>
              </div>
              <div className="flex justify-between border-t border-border/30 pt-2">
                <span className="font-orbitron text-[9px] text-muted-foreground/70 uppercase tracking-wider">Total</span>
                <span className="font-orbitron text-sm font-bold text-primary">{agent.rentPrice * rentHours} $CNOVA</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 font-orbitron text-[9px] tracking-wider uppercase" onClick={() => setShowRentModal(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 font-orbitron text-[9px] tracking-wider uppercase"
                onClick={handleRent}
                disabled={isLoading}
                data-testid="button-confirm-rent"
                style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
              >
                {isLoading ? <RotateCcw className="w-3 h-3 animate-spin" /> : "Confirm Rent"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
