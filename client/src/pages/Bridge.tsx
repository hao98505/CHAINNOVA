import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChainNova } from "@/hooks/useChainNova";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeftRight, ArrowRight, CheckCircle, RotateCcw,
  Wallet, AlertTriangle, Clock, Shield, Zap
} from "lucide-react";

const CHAINS = [
  { id: "solana", name: "Solana", symbol: "SOL", color: "text-purple-400", bg: "bg-purple-500/20", icon: "◎" },
  { id: "bsc", name: "BNB Chain", symbol: "BNB", color: "text-yellow-400", bg: "bg-yellow-500/20", icon: "⬡" },
  { id: "arbitrum", name: "Arbitrum", symbol: "ARB", color: "text-blue-400", bg: "bg-blue-500/20", icon: "◆" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH", color: "text-slate-300", bg: "bg-slate-500/20", icon: "◈" },
];

const BRIDGE_ROUTES = [
  { from: "solana", to: "bsc", time: "~8 min", fee: "0.3%", liquidity: "high" },
  { from: "solana", to: "arbitrum", time: "~12 min", fee: "0.25%", liquidity: "medium" },
  { from: "solana", to: "ethereum", time: "~20 min", fee: "0.5%", liquidity: "high" },
];

type BridgeStatus = "idle" | "approving" | "bridging" | "confirming" | "complete";

export default function Bridge() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { bridgeTokens, isLoading } = useChainNova();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [fromChain] = useState("solana");
  const [toChain, setToChain] = useState("bsc");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const fromChainData = CHAINS.find((c) => c.id === fromChain)!;
  const toChainData = CHAINS.find((c) => c.id === toChain)!;
  const route = BRIDGE_ROUTES.find((r) => r.from === fromChain && r.to === toChain);

  const fee = amount ? ((parseFloat(amount) * 0.003)).toFixed(2) : "0";
  const receive = amount ? (parseFloat(amount) - parseFloat(fee)).toFixed(2) : "0";

  const liquidityLabel = (key: string) => {
    if (key === "high") return t.bridge.high;
    if (key === "medium") return t.bridge.medium;
    return key;
  };

  const handleBridge = async () => {
    if (!connected) { setVisible(true); return; }
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: t.bridge.invalidAmount, description: t.bridge.invalidAmountDesc, variant: "destructive" });
      return;
    }

    setStatus("approving");
    await new Promise((r) => setTimeout(r, 1200));
    setStatus("bridging");
    await new Promise((r) => setTimeout(r, 1800));
    setStatus("confirming");

    try {
      const result = await bridgeTokens({ amount: parseFloat(amount), fromChain, toChain });
      setTxHash(result.signature);
      setStatus("complete");
      toast({ title: t.bridge.bridgeComplete, description: `${amount} $CNOVA ${t.bridge.bridgeCompleteToast} ${toChainData.name}` });
    } catch {
      setStatus("idle");
      toast({ title: t.bridge.bridgeFailed, description: t.bridge.bridgeFailedDesc, variant: "destructive" });
    }
  };

  const resetBridge = () => {
    setStatus("idle");
    setAmount("");
    setTxHash(null);
  };

  const STEPS = [
    { key: "approving", label: t.bridge.approving },
    { key: "bridging", label: t.bridge.bridging },
    { key: "confirming", label: t.bridge.confirming },
    { key: "complete", label: t.bridge.complete },
  ];
  const activeStep = STEPS.findIndex((s) => s.key === status);

  return (
    <div className="min-h-full px-6 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="font-orbitron text-2xl font-black uppercase tracking-wider text-foreground neon-glow-text mb-1">
            {t.bridge.title}
          </h1>
          <p className="font-orbitron text-[9px] text-muted-foreground/60 tracking-widest uppercase">
            {t.bridge.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: Shield, labelKey: "securedBy" as const, color: "text-green-400" },
            { icon: Zap, labelKey: "fastSettlement" as const, color: "text-yellow-400" },
            { icon: Clock, labelKey: "availability" as const, color: "text-blue-400" },
          ].map((item, i) => (
            <motion.div
              key={item.labelKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card rounded-md border border-primary/15 p-3 text-center"
            >
              <item.icon className={`w-4 h-4 ${item.color} mx-auto mb-1`} />
              <div className={`font-orbitron text-[9px] ${item.color} uppercase tracking-widest`}>{t.bridge[item.labelKey]}</div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {status === "complete" ? (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card rounded-md border border-green-400/30 p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-16 h-16 rounded-full bg-green-400/20 border border-green-400/40 flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle className="w-8 h-8 text-green-400" />
              </motion.div>
              <div className="font-orbitron text-xl font-black text-foreground uppercase tracking-wider mb-2">{t.bridge.bridgeComplete}</div>
              <p className="text-muted-foreground text-sm mb-4">
                {amount} $CNOVA {t.bridge.bridgeCompleteDesc} {fromChainData.name} {t.bridge.to} {toChainData.name}
              </p>
              {txHash && (
                <div className="p-3 rounded-md bg-primary/5 border border-primary/15 mb-4">
                  <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-widest mb-1">{t.bridge.transaction}</div>
                  <div className="font-mono text-[9px] text-primary break-all">{txHash}</div>
                </div>
              )}
              <Button
                className="font-orbitron text-[10px] tracking-wider uppercase"
                onClick={resetBridge}
                data-testid="button-bridge-again"
                style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
              >
                {t.bridge.bridgeAgain}
              </Button>
            </motion.div>
          ) : status !== "idle" ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card rounded-md border border-primary/20 p-8"
            >
              <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest text-center mb-6">
                {t.bridge.processing}
              </div>
              <div className="flex items-center justify-center gap-3 mb-8">
                {STEPS.map((step, i) => (
                  <div key={step.key} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                        i < activeStep ? "bg-green-400/20 border-green-400/40" :
                        i === activeStep ? "bg-primary/30 border-primary/60 pulse-border" :
                        "bg-muted/20 border-border/30"
                      }`}>
                        {i < activeStep ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        ) : i === activeStep ? (
                          <RotateCcw className="w-3 h-3 text-primary animate-spin" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-border/50" />
                        )}
                      </div>
                      <span className={`font-orbitron text-[8px] tracking-widest uppercase ${
                        i <= activeStep ? "text-primary" : "text-muted-foreground/40"
                      }`}>{step.label}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <ArrowRight className={`w-3 h-3 mb-4 ${i < activeStep ? "text-green-400" : "text-border/40"}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-md bg-primary/5 border border-primary/15 text-center">
                <div className="font-orbitron text-2xl font-black text-foreground mb-1">{amount} $CNOVA</div>
                <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest">
                  {fromChainData.name} → {toChainData.name}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-md border border-primary/20 p-6 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 block mb-2">
                    {t.bridge.fromChain}
                  </label>
                  <div className={`p-3 rounded-md border ${fromChainData.bg} border-primary/30 flex items-center gap-2`}>
                    <span className={`text-lg ${fromChainData.color}`}>{fromChainData.icon}</span>
                    <div>
                      <div className={`font-orbitron text-[10px] font-bold ${fromChainData.color}`}>{fromChainData.name}</div>
                      <div className="font-orbitron text-[8px] text-muted-foreground/50">{fromChainData.symbol}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center pt-5">
                  <div className="w-8 h-8 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
                  </div>
                </div>

                <div className="flex-1">
                  <label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 block mb-2">
                    {t.bridge.toChain}
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {CHAINS.filter((c) => c.id !== "solana").map((chain) => (
                      <button
                        key={chain.id}
                        onClick={() => setToChain(chain.id)}
                        data-testid={`button-to-chain-${chain.id}`}
                        className={`p-2.5 rounded-md border flex items-center gap-2 transition-all text-left ${
                          toChain === chain.id
                            ? `${chain.bg} border-current ${chain.color}`
                            : "border-border/40 bg-transparent"
                        }`}
                      >
                        <span className={`text-base ${toChain === chain.id ? chain.color : "text-muted-foreground/50"}`}>
                          {chain.icon}
                        </span>
                        <div>
                          <div className={`font-orbitron text-[9px] font-bold ${toChain === chain.id ? chain.color : "text-muted-foreground/60"}`}>
                            {chain.name}
                          </div>
                          <div className="font-orbitron text-[8px] text-muted-foreground/40">{chain.symbol}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 block mb-2">
                  {t.bridge.amountLabel}
                </label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="cyber-input font-orbitron text-lg tracking-wider text-center"
                  data-testid="input-bridge-amount"
                />
              </div>

              {amount && parseFloat(amount) > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-md bg-primary/5 border border-primary/15 space-y-2"
                >
                  <div className="flex justify-between">
                    <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.bridge.bridgeFee}</span>
                    <span className="font-orbitron text-[10px] text-foreground">{fee} $CNOVA (0.3%)</span>
                  </div>
                  {route && (
                    <>
                      <div className="flex justify-between">
                        <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.bridge.estTime}</span>
                        <span className="font-orbitron text-[10px] text-foreground">{route.time}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.bridge.liquidity}</span>
                        <span className="font-orbitron text-[10px] text-green-400">{liquidityLabel(route.liquidity)}</span>
                      </div>
                    </>
                  )}
                  <div className="h-px bg-border/30" />
                  <div className="flex justify-between">
                    <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.bridge.youReceive}</span>
                    <span className="font-orbitron text-sm font-bold text-primary">{receive} $CNOVA</span>
                  </div>
                </motion.div>
              )}

              <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/5 border border-yellow-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="font-orbitron text-[8px] text-yellow-400/80 leading-relaxed tracking-wide">
                  {t.bridge.warning}
                </p>
              </div>

              <Button
                className="w-full font-orbitron text-[10px] tracking-wider uppercase gap-2"
                onClick={handleBridge}
                disabled={isLoading || !amount}
                data-testid="button-bridge"
                style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
              >
                {!connected ? (
                  <><Wallet className="w-3.5 h-3.5" />{t.bridge.connectBridge}</>
                ) : (
                  <><ArrowLeftRight className="w-3.5 h-3.5" />{amount ? `${t.bridge.bridgeButton.replace("$CNOVA", `${amount} $CNOVA`)}` : t.bridge.bridgeButton}</>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
