import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChainNova } from "@/hooks/useChainNova";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getBridgeQuote,
  WORMHOLE_CHAINS,
  validateRecipientAddress,
  saveBridgeHistory,
  getBridgeHistory,
  clearBridgeHistory,
} from "@/lib/wormhole";
import type { WormholeChainId, BridgeHistoryEntry, BridgeTransferResult } from "@/lib/wormhole";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeftRight, ArrowRight, CheckCircle, RotateCcw,
  Wallet, AlertTriangle, Clock, Shield, Zap, ExternalLink,
  Copy, Info, Settings, History, ChevronDown, ChevronUp,
  Trash2, ArrowDownUp, Globe, Activity, TrendingUp
} from "lucide-react";

type BridgeStatus = "idle" | "approving" | "bridging" | "confirming" | "complete";
type TabType = "bridge" | "history";

const AMOUNT_PRESETS = [100, 500, 1000, 5000];
const SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0];
const MOCK_CNOVA_BALANCE = 12500;

export default function Bridge() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { bridgeTokens, isLoading } = useChainNova();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [fromChain] = useState<WormholeChainId>("solana");
  const [toChain, setToChain] = useState<WormholeChainId>("bsc");
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [bridgeResult, setBridgeResult] = useState<BridgeTransferResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("bridge");
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);
  const [showChainDetails, setShowChainDetails] = useState(false);
  const [history, setHistory] = useState<BridgeHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getBridgeHistory());
  }, []);

  const fromChainConfig = WORMHOLE_CHAINS[fromChain];
  const toChainConfig = WORMHOLE_CHAINS[toChain];

  const parsedAmount = parseFloat(amount) || 0;
  const quote = useMemo(
    () => parsedAmount > 0 ? getBridgeQuote(parsedAmount, fromChain, toChain, slippage) : null,
    [parsedAmount, fromChain, toChain, slippage]
  );

  const addressValidation = useMemo(
    () => recipientAddress ? validateRecipientAddress(recipientAddress, toChain) : { valid: true },
    [recipientAddress, toChain]
  );

  const insufficientBalance = parsedAmount > MOCK_CNOVA_BALANCE;
  const amountTooLow = quote !== null && quote.receiveAmount <= 0;
  const canBridge = parsedAmount > 0 && !insufficientBalance && !amountTooLow && addressValidation.valid && !isLoading;

  const handleBridge = async () => {
    if (!connected) { setVisible(true); return; }
    if (!canBridge) {
      toast({ title: t.bridge.invalidAmount, description: t.bridge.invalidAmountDesc, variant: "destructive" });
      return;
    }

    setStatus("approving");
    await new Promise((r) => setTimeout(r, 1200));
    setStatus("bridging");
    await new Promise((r) => setTimeout(r, 1800));
    setStatus("confirming");

    try {
      const result = await bridgeTokens({
        amount: parsedAmount,
        fromChain,
        toChain,
        recipientAddress: recipientAddress || undefined,
        slippage,
      });
      setBridgeResult(result);
      setStatus("complete");

      const historyEntry: BridgeHistoryEntry = {
        id: `bridge_${Date.now()}`,
        signature: result.signature,
        vaaId: result.vaaId,
        amount: parsedAmount,
        fromChain,
        toChain,
        status: result.status === "simulated" ? "simulated" : "confirmed",
        timestamp: Date.now(),
        fee: result.fee,
        receiveAmount: result.receiveAmount,
        explorerUrl: result.explorerUrl,
      };
      saveBridgeHistory(historyEntry);
      setHistory(getBridgeHistory());

      toast({ title: t.bridge.bridgeComplete, description: `${amount} $CNOVA ${t.bridge.bridgeCompleteToast} ${toChainConfig.name}` });
    } catch {
      setStatus("idle");
      toast({ title: t.bridge.bridgeFailed, description: t.bridge.bridgeFailedDesc, variant: "destructive" });
    }
  };

  const resetBridge = () => {
    setStatus("idle");
    setAmount("");
    setRecipientAddress("");
    setBridgeResult(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t.bridge.copied, description: text.slice(0, 30) + "..." });
  };

  const handleClearHistory = () => {
    clearBridgeHistory();
    setHistory([]);
    toast({ title: t.bridge.clearHistory });
  };

  const setPresetAmount = (preset: number) => {
    setAmount(preset.toString());
  };

  const setMaxAmount = () => {
    setAmount(MOCK_CNOVA_BALANCE.toString());
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="font-orbitron text-2xl font-black uppercase tracking-wider text-foreground neon-glow-text mb-1" data-testid="text-bridge-title">
            {t.bridge.title}
          </h1>
          <p className="font-orbitron text-[9px] text-muted-foreground/60 tracking-widest uppercase">
            {t.bridge.subtitle}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 status-dot" />
            <span className="font-orbitron text-[8px] text-green-400/80 tracking-widest uppercase">
              Powered by Wormhole Protocol
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { icon: TrendingUp, value: "$2.4M", label: t.bridge.totalBridged, color: "text-purple-400" },
            { icon: Globe, value: "3", label: t.bridge.activeRoutes, color: "text-blue-400" },
            { icon: Clock, value: "~13 min", label: t.bridge.avgTime, color: "text-yellow-400" },
            { icon: Activity, value: "14,892", label: t.bridge.totalTxns, color: "text-green-400" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass-card rounded-md border border-primary/15 p-3 text-center"
              data-testid={`stat-bridge-${i}`}
            >
              <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1.5`} />
              <div className={`font-orbitron text-sm font-black ${stat.color}`}>{stat.value}</div>
              <div className="font-orbitron text-[7px] text-muted-foreground/50 uppercase tracking-widest mt-0.5">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: Shield, label: t.bridge.securedBy, color: "text-green-400" },
            { icon: Zap, label: t.bridge.fastSettlement, color: "text-yellow-400" },
            { icon: Clock, label: t.bridge.availability, color: "text-blue-400" },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 + i * 0.08 }}
              className="glass-card rounded-md border border-primary/15 p-3 text-center"
            >
              <item.icon className={`w-4 h-4 ${item.color} mx-auto mb-1`} />
              <div className={`font-orbitron text-[9px] ${item.color} uppercase tracking-widest`}>{item.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-1 mb-4 glass-card rounded-md border border-primary/15 p-1 w-fit">
          {([
            { key: "bridge" as TabType, label: t.bridge.bridgeForm, icon: ArrowLeftRight },
            { key: "history" as TabType, label: t.bridge.history, icon: History },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              data-testid={`tab-${tab.key}`}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-sm font-orbitron text-[9px] uppercase tracking-widest transition-all ${
                activeTab === tab.key
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground/50 hover:text-muted-foreground/80"
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
              {tab.key === "history" && history.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[7px]">{history.length}</span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "history" ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {history.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearHistory}
                    className="font-orbitron text-[8px] tracking-wider uppercase text-muted-foreground/50 hover:text-red-400 gap-1"
                    data-testid="button-clear-history"
                  >
                    <Trash2 className="w-3 h-3" />
                    {t.bridge.clearHistory}
                  </Button>
                </div>
              )}

              {history.length === 0 ? (
                <div className="glass-card rounded-md border border-primary/15 p-12 text-center">
                  <History className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <div className="font-orbitron text-sm text-muted-foreground/40 uppercase tracking-wider mb-1">{t.bridge.noHistory}</div>
                  <div className="font-orbitron text-[8px] text-muted-foreground/30 tracking-wider">{t.bridge.noHistoryDesc}</div>
                </div>
              ) : (
                history.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card rounded-md border border-primary/15 p-4"
                    data-testid={`history-entry-${i}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-base ${WORMHOLE_CHAINS[entry.fromChain].color}`}>{WORMHOLE_CHAINS[entry.fromChain].icon}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground/40" />
                        <span className={`text-base ${WORMHOLE_CHAINS[entry.toChain].color}`}>{WORMHOLE_CHAINS[entry.toChain].icon}</span>
                        <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                          {WORMHOLE_CHAINS[entry.fromChain].name} → {WORMHOLE_CHAINS[entry.toChain].name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-orbitron text-[8px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          entry.status === "simulated"
                            ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                            : entry.status === "completed"
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}>
                          {t.bridge[entry.status as keyof typeof t.bridge] || entry.status}
                        </span>
                        <span className="font-orbitron text-[8px] text-muted-foreground/40">{formatTime(entry.timestamp)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <div className="font-orbitron text-[7px] text-muted-foreground/40 uppercase tracking-widest mb-0.5">{t.bridge.amount}</div>
                        <div className="font-orbitron text-xs font-bold text-foreground">{entry.amount.toLocaleString()} $CNOVA</div>
                      </div>
                      <div>
                        <div className="font-orbitron text-[7px] text-muted-foreground/40 uppercase tracking-widest mb-0.5">{t.bridge.received}</div>
                        <div className="font-orbitron text-xs font-bold text-primary">{entry.receiveAmount.toLocaleString()} $CNOVA</div>
                      </div>
                      <div>
                        <div className="font-orbitron text-[7px] text-muted-foreground/40 uppercase tracking-widest mb-0.5">{t.bridge.fee}</div>
                        <div className="font-orbitron text-xs text-muted-foreground">{entry.fee.toFixed(4)} $CNOVA</div>
                      </div>
                      <div className="flex items-end justify-end gap-1">
                        {entry.explorerUrl && (
                          <a href={entry.explorerUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <ExternalLink className="w-3 h-3 text-muted-foreground/50" />
                            </Button>
                          </a>
                        )}
                        <button onClick={() => copyToClipboard(entry.signature)} className="h-6 w-6 flex items-center justify-center">
                          <Copy className="w-3 h-3 text-muted-foreground/50 hover:text-primary transition-colors" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : status === "complete" && bridgeResult ? (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card rounded-md border border-green-400/30 p-8 space-y-4"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="w-16 h-16 rounded-full bg-green-400/20 border border-green-400/40 flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </motion.div>
                <div className="font-orbitron text-xl font-black text-foreground uppercase tracking-wider mb-2">{t.bridge.bridgeComplete}</div>
                <p className="text-muted-foreground text-sm mb-1">
                  {amount} $CNOVA {t.bridge.bridgeCompleteDesc} {fromChainConfig.name} {t.bridge.to} {toChainConfig.name}
                </p>
                {bridgeResult.status === "simulated" && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                    <Info className="w-3 h-3 text-yellow-400" />
                    <span className="font-orbitron text-[8px] text-yellow-400 tracking-wider uppercase">
                      {t.bridge.simulationNote}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-md bg-primary/5 border border-primary/15">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-widest">{t.bridge.txSignature}</div>
                    <button onClick={() => copyToClipboard(bridgeResult.signature)} className="text-primary/60 hover:text-primary transition-colors">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="font-mono text-[9px] text-primary break-all">{bridgeResult.signature}</div>
                </div>

                {bridgeResult.vaaId && (
                  <div className="p-3 rounded-md bg-primary/5 border border-primary/15">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-widest">Wormhole VAA ID</div>
                      <button onClick={() => copyToClipboard(bridgeResult.vaaId!)} className="text-primary/60 hover:text-primary transition-colors">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground break-all">{bridgeResult.vaaId}</div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2">
                  <div className="p-2 rounded-md bg-primary/5 border border-primary/10 text-center">
                    <div className="font-orbitron text-[8px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">{t.bridge.fee}</div>
                    <div className="font-orbitron text-[10px] font-bold text-foreground">{bridgeResult.fee.toFixed(4)}</div>
                  </div>
                  <div className="p-2 rounded-md bg-primary/5 border border-primary/10 text-center">
                    <div className="font-orbitron text-[8px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">{t.bridge.received}</div>
                    <div className="font-orbitron text-[10px] font-bold text-primary">{bridgeResult.receiveAmount.toFixed(4)}</div>
                  </div>
                  <div className="p-2 rounded-md bg-primary/5 border border-primary/10 text-center">
                    <div className="font-orbitron text-[8px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">{t.bridge.eta}</div>
                    <div className="font-orbitron text-[10px] font-bold text-foreground">{bridgeResult.estimatedTime}</div>
                  </div>
                  <div className="p-2 rounded-md bg-primary/5 border border-primary/10 text-center">
                    <div className="font-orbitron text-[8px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">{t.bridge.status}</div>
                    <div className={`font-orbitron text-[10px] font-bold ${bridgeResult.status === "simulated" ? "text-yellow-400" : "text-green-400"}`}>
                      {bridgeResult.status === "simulated" ? t.bridge.simulated : t.bridge.confirmed}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {bridgeResult.explorerUrl && (
                  <a href={bridgeResult.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex-1" data-testid="link-explorer">
                    <Button variant="outline" className="w-full font-orbitron text-[9px] tracking-wider uppercase gap-1.5 border-primary/30">
                      <ExternalLink className="w-3 h-3" /> Solana Explorer
                    </Button>
                  </a>
                )}
                {bridgeResult.vaaId && (
                  <a href={`https://testnet.wormholescan.io/#/tx/${bridgeResult.vaaId}`} target="_blank" rel="noopener noreferrer" className="flex-1" data-testid="link-wormholescan">
                    <Button variant="outline" className="w-full font-orbitron text-[9px] tracking-wider uppercase gap-1.5 border-primary/30">
                      <ExternalLink className="w-3 h-3" /> WormholeScan
                    </Button>
                  </a>
                )}
              </div>

              <Button
                className="w-full font-orbitron text-[10px] tracking-wider uppercase"
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

              <div className="p-4 rounded-md bg-primary/5 border border-primary/15">
                <div className="flex items-center justify-center gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${fromChainConfig.color}`}>{fromChainConfig.icon}</span>
                    <span className="font-orbitron text-xs text-muted-foreground">{fromChainConfig.name}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary" />
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${toChainConfig.color}`}>{toChainConfig.icon}</span>
                    <span className="font-orbitron text-xs text-muted-foreground">{toChainConfig.name}</span>
                  </div>
                </div>
                <div className="font-orbitron text-2xl font-black text-foreground text-center mb-1">{amount} $CNOVA</div>
                <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest text-center">
                  via Wormhole Token Bridge
                </div>
              </div>

              <div className="mt-4 p-3 rounded-md bg-blue-500/5 border border-blue-500/15 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span className="font-orbitron text-[8px] text-blue-400/80 tracking-wider">
                  {t.bridge.estTime}: {quote?.estimatedTime || "~10 min"} | {t.bridge.confirmations}: {toChainConfig.confirmations}
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="glass-card rounded-md border border-primary/20 p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest">
                    {t.bridge.bridgeForm}
                  </div>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-sm transition-all ${
                      showSettings ? "bg-primary/20 text-primary" : "text-muted-foreground/40 hover:text-muted-foreground/70"
                    }`}
                    data-testid="button-bridge-settings"
                  >
                    <Settings className="w-3 h-3" />
                    <span className="font-orbitron text-[8px] tracking-wider uppercase">{t.bridge.settingsTitle}</span>
                  </button>
                </div>

                <AnimatePresence>
                  {showSettings && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 rounded-md bg-primary/5 border border-primary/10 space-y-2">
                        <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-widest">{t.bridge.slippage}</div>
                        <div className="flex gap-2">
                          {SLIPPAGE_OPTIONS.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => setSlippage(opt)}
                              data-testid={`button-slippage-${opt}`}
                              className={`flex-1 py-1.5 rounded-sm font-orbitron text-[9px] tracking-wider transition-all ${
                                slippage === opt
                                  ? "bg-primary/20 text-primary border border-primary/40"
                                  : "text-muted-foreground/50 border border-border/20 hover:border-border/40"
                              }`}
                            >
                              {opt}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 block mb-2">
                      {t.bridge.fromChain}
                    </label>
                    <div className={`p-3 rounded-md border ${fromChainConfig.bg} border-primary/30 flex items-center gap-2`}>
                      <span className={`text-lg ${fromChainConfig.color}`}>{fromChainConfig.icon}</span>
                      <div className="flex-1">
                        <div className={`font-orbitron text-[10px] font-bold ${fromChainConfig.color}`}>{fromChainConfig.name}</div>
                        <div className="font-orbitron text-[8px] text-muted-foreground/50">{fromChainConfig.symbol}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-orbitron text-[7px] text-muted-foreground/40 uppercase tracking-widest">{t.bridge.confirmations}</div>
                        <div className="font-orbitron text-[9px] text-muted-foreground/60">{fromChainConfig.confirmations}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center pt-5">
                    <div className="w-8 h-8 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
                      <ArrowDownUp className="w-3.5 h-3.5 text-primary" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70">
                        {t.bridge.toChain}
                      </label>
                      <button
                        onClick={() => setShowChainDetails(!showChainDetails)}
                        className="flex items-center gap-0.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                      >
                        <span className="font-orbitron text-[7px] uppercase tracking-widest">{t.bridge.chainDetails}</span>
                        {showChainDetails ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(["bsc", "arbitrum", "ethereum"] as WormholeChainId[]).map((chainId) => {
                        const chain = WORMHOLE_CHAINS[chainId];
                        const isSelected = toChain === chainId;
                        return (
                          <button
                            key={chainId}
                            onClick={() => setToChain(chainId)}
                            data-testid={`button-to-chain-${chainId}`}
                            className={`w-full p-2.5 rounded-md border flex items-center gap-2 transition-all text-left ${
                              isSelected
                                ? `${chain.bg} border-current ${chain.color}`
                                : "border-border/40 bg-transparent hover:border-border/60"
                            }`}
                          >
                            <span className={`text-base ${isSelected ? chain.color : "text-muted-foreground/50"}`}>{chain.icon}</span>
                            <div className="flex-1">
                              <div className={`font-orbitron text-[9px] font-bold ${isSelected ? chain.color : "text-muted-foreground/60"}`}>
                                {chain.name}
                              </div>
                              <div className="font-orbitron text-[8px] text-muted-foreground/40">{chain.symbol}</div>
                            </div>
                            {showChainDetails && (
                              <div className="text-right">
                                <div className="font-orbitron text-[7px] text-muted-foreground/30">{chain.confirmations} conf.</div>
                                <div className="font-orbitron text-[7px] text-muted-foreground/30">Gas: {chain.gasToken}</div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70">
                      {t.bridge.amountLabel}
                    </label>
                    {connected && (
                      <div className="flex items-center gap-1">
                        <Wallet className="w-3 h-3 text-muted-foreground/40" />
                        <span className="font-orbitron text-[8px] text-muted-foreground/50">
                          {t.bridge.balance}: {MOCK_CNOVA_BALANCE.toLocaleString()} $CNOVA
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className={`cyber-input font-orbitron text-lg tracking-wider text-center pr-16 ${
                        insufficientBalance ? "border-red-500/50" : ""
                      }`}
                      data-testid="input-bridge-amount"
                    />
                    <button
                      onClick={setMaxAmount}
                      className="absolute right-3 top-1/2 -translate-y-1/2 font-orbitron text-[8px] text-primary/70 hover:text-primary uppercase tracking-widest transition-colors px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/20"
                      data-testid="button-max-amount"
                    >
                      MAX
                    </button>
                  </div>
                  {insufficientBalance && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <span className="font-orbitron text-[8px] text-red-400 tracking-wider">
                        {t.bridge.invalidAmount} — {t.bridge.balance}: {MOCK_CNOVA_BALANCE.toLocaleString()} $CNOVA
                      </span>
                    </div>
                  )}
                  {amountTooLow && !insufficientBalance && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 text-yellow-400" />
                      <span className="font-orbitron text-[8px] text-yellow-400 tracking-wider">
                        {t.bridge.invalidAmount} — {t.bridge.bridgeFee} + {t.bridge.relayerFee} &gt; {t.bridge.amount}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    {AMOUNT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setPresetAmount(preset)}
                        data-testid={`button-preset-${preset}`}
                        className={`flex-1 py-1.5 rounded-sm font-orbitron text-[9px] tracking-wider border transition-all ${
                          amount === preset.toString()
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "text-muted-foreground/40 border-border/20 hover:border-border/40"
                        }`}
                      >
                        {preset.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70">
                      {t.bridge.recipientAddress}
                    </label>
                    <span className="font-orbitron text-[7px] text-muted-foreground/40 tracking-wider">
                      {t.bridge.recipientDefault}
                    </span>
                  </div>
                  <Input
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder={t.bridge.recipientPlaceholder}
                    className={`cyber-input font-mono text-xs tracking-wider ${
                      !addressValidation.valid ? "border-red-500/50" : ""
                    }`}
                    data-testid="input-recipient-address"
                  />
                  {!addressValidation.valid && addressValidation.error && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <span className="font-orbitron text-[8px] text-red-400 tracking-wider">{addressValidation.error}</span>
                    </div>
                  )}
                </div>

                {quote && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-md bg-primary/5 border border-primary/15 space-y-2"
                    data-testid="bridge-quote"
                  >
                    <div className="flex justify-between">
                      <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.bridge.route}</span>
                      <span className="font-orbitron text-[9px] text-primary font-bold">Wormhole Token Bridge</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.bridge.bridgeFee}</span>
                      <span className="font-orbitron text-[10px] text-foreground">{quote.fee.toFixed(4)} $CNOVA ({quote.feePercent}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.bridge.relayerFee}</span>
                      <span className="font-orbitron text-[10px] text-foreground">{quote.relayerFee} $CNOVA</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.bridge.estTime}</span>
                      <span className="font-orbitron text-[10px] text-foreground">{quote.estimatedTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.bridge.gasEstimate}</span>
                      <span className="font-orbitron text-[10px] text-foreground">{quote.gasEstimate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.bridge.priceImpact}</span>
                      <span className={`font-orbitron text-[10px] ${quote.priceImpact > 0.1 ? "text-yellow-400" : "text-green-400"}`}>
                        {quote.priceImpact}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                        {t.bridge.minReceived} ({t.bridge.slippage}: {slippage}%)
                      </span>
                      <span className="font-orbitron text-[10px] text-foreground">{quote.minReceived.toFixed(4)} $CNOVA</span>
                    </div>
                    <div className="h-px bg-border/30" />
                    <div className="flex justify-between">
                      <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.bridge.youReceive}</span>
                      <span className="font-orbitron text-sm font-bold text-primary">{quote.receiveAmount.toFixed(4)} $CNOVA</span>
                    </div>
                  </motion.div>
                )}

                <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/5 border border-yellow-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="font-orbitron text-[8px] text-yellow-400/80 leading-relaxed tracking-wide">
                    {t.bridge.warning}
                  </p>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-md bg-blue-500/5 border border-blue-500/20">
                  <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="font-orbitron text-[8px] text-blue-400/80 leading-relaxed tracking-wide">
                    {t.bridge.wormholeNote}
                  </p>
                </div>

                <Button
                  className="w-full font-orbitron text-[10px] tracking-wider uppercase gap-2"
                  onClick={handleBridge}
                  disabled={isLoading || (!connected ? false : !canBridge)}
                  data-testid="button-bridge"
                  style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
                >
                  {!connected ? (
                    <><Wallet className="w-3.5 h-3.5" />{t.bridge.connectBridge}</>
                  ) : (
                    <><ArrowLeftRight className="w-3.5 h-3.5" />{parsedAmount > 0 ? `${t.bridge.bridgeButton.replace("$CNOVA", `${amount} $CNOVA`)}` : t.bridge.bridgeButton}</>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
