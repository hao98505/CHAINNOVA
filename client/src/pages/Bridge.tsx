import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChainNova } from "@/hooks/useChainNova";
import { useLanguage } from "@/contexts/LanguageContext";
import { getBridgeQuote, WORMHOLE_CHAINS } from "@/lib/wormhole";
import type { WormholeChainId } from "@/lib/wormhole";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeftRight, ArrowRight, CheckCircle, RotateCcw,
  Wallet, AlertTriangle, Clock, Shield, Zap, ExternalLink, Copy, Info
} from "lucide-react";

const CHAINS = [
  { id: "solana" as WormholeChainId, name: "Solana", symbol: "SOL", color: "text-purple-400", bg: "bg-purple-500/20", icon: "◎" },
  { id: "bsc" as WormholeChainId, name: "BNB Chain", symbol: "BNB", color: "text-yellow-400", bg: "bg-yellow-500/20", icon: "⬡" },
  { id: "arbitrum" as WormholeChainId, name: "Arbitrum", symbol: "ARB", color: "text-blue-400", bg: "bg-blue-500/20", icon: "◆" },
  { id: "ethereum" as WormholeChainId, name: "Ethereum", symbol: "ETH", color: "text-slate-300", bg: "bg-slate-500/20", icon: "◈" },
];

type BridgeStatus = "idle" | "approving" | "bridging" | "confirming" | "complete";

interface BridgeResult {
  signature: string;
  vaaId: string | null;
  explorerUrl: string;
  status: string;
  estimatedTime: string;
  fee: number;
}

export default function Bridge() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { bridgeTokens, isLoading } = useChainNova();
  const { toast } = useToast();
  const { t, lang } = useLanguage();

  const [fromChain] = useState<WormholeChainId>("solana");
  const [toChain, setToChain] = useState<WormholeChainId>("bsc");
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [bridgeResult, setBridgeResult] = useState<BridgeResult | null>(null);

  const fromChainData = CHAINS.find((c) => c.id === fromChain)!;
  const toChainData = CHAINS.find((c) => c.id === toChain)!;

  const quote = amount && parseFloat(amount) > 0
    ? getBridgeQuote(parseFloat(amount), fromChain, toChain)
    : null;

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
      const result = await bridgeTokens({
        amount: parseFloat(amount),
        fromChain,
        toChain,
        recipientAddress: recipientAddress || undefined,
      });
      setBridgeResult(result);
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
    setRecipientAddress("");
    setBridgeResult(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: lang === "zh" ? "已复制" : "Copied", description: text.slice(0, 30) + "..." });
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
          <div className="flex items-center gap-2 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 status-dot" />
            <span className="font-orbitron text-[8px] text-green-400/80 tracking-widest uppercase">
              Powered by Wormhole Protocol
            </span>
          </div>
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
          {status === "complete" && bridgeResult ? (
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
                  {amount} $CNOVA {t.bridge.bridgeCompleteDesc} {fromChainData.name} {t.bridge.to} {toChainData.name}
                </p>
                {bridgeResult.status === "simulated" && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                    <Info className="w-3 h-3 text-yellow-400" />
                    <span className="font-orbitron text-[8px] text-yellow-400 tracking-wider uppercase">
                      {lang === "zh" ? "模拟模式 — $CNOVA 代币尚未部署" : "Simulation — $CNOVA token not yet deployed"}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-md bg-primary/5 border border-primary/15">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-widest">
                      {lang === "zh" ? "交易签名" : "Transaction Signature"}
                    </div>
                    <button onClick={() => copyToClipboard(bridgeResult.signature)} className="text-primary/60 hover:text-primary transition-colors">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="font-mono text-[9px] text-primary break-all">{bridgeResult.signature}</div>
                </div>

                {bridgeResult.vaaId && (
                  <div className="p-3 rounded-md bg-primary/5 border border-primary/15">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-widest">
                        Wormhole VAA ID
                      </div>
                      <button onClick={() => copyToClipboard(bridgeResult.vaaId!)} className="text-primary/60 hover:text-primary transition-colors">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground break-all">{bridgeResult.vaaId}</div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-md bg-primary/5 border border-primary/10 text-center">
                    <div className="font-orbitron text-[8px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">
                      {lang === "zh" ? "费用" : "Fee"}
                    </div>
                    <div className="font-orbitron text-[10px] font-bold text-foreground">{bridgeResult.fee.toFixed(4)} $CNOVA</div>
                  </div>
                  <div className="p-2 rounded-md bg-primary/5 border border-primary/10 text-center">
                    <div className="font-orbitron text-[8px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">
                      {lang === "zh" ? "预计到达" : "ETA"}
                    </div>
                    <div className="font-orbitron text-[10px] font-bold text-foreground">{bridgeResult.estimatedTime}</div>
                  </div>
                  <div className="p-2 rounded-md bg-primary/5 border border-primary/10 text-center">
                    <div className="font-orbitron text-[8px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">
                      {lang === "zh" ? "状态" : "Status"}
                    </div>
                    <div className={`font-orbitron text-[10px] font-bold ${bridgeResult.status === "simulated" ? "text-yellow-400" : "text-green-400"}`}>
                      {bridgeResult.status === "simulated"
                        ? (lang === "zh" ? "已模拟" : "Simulated")
                        : (lang === "zh" ? "已确认" : "Confirmed")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {bridgeResult.explorerUrl && (
                  <a
                    href={bridgeResult.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                    data-testid="link-explorer"
                  >
                    <Button
                      variant="outline"
                      className="w-full font-orbitron text-[9px] tracking-wider uppercase gap-1.5 border-primary/30"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Solana Explorer
                    </Button>
                  </a>
                )}
                {bridgeResult.vaaId && (
                  <a
                    href={`https://testnet.wormholescan.io/#/tx/${bridgeResult.vaaId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                    data-testid="link-wormholescan"
                  >
                    <Button
                      variant="outline"
                      className="w-full font-orbitron text-[9px] tracking-wider uppercase gap-1.5 border-primary/30"
                    >
                      <ExternalLink className="w-3 h-3" />
                      WormholeScan
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
              <div className="p-4 rounded-md bg-primary/5 border border-primary/15 text-center">
                <div className="font-orbitron text-2xl font-black text-foreground mb-1">{amount} $CNOVA</div>
                <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest">
                  {fromChainData.name} → {toChainData.name} via Wormhole
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

              <div>
                <label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 block mb-2">
                  {lang === "zh" ? "目标地址（可选，默认为当前钱包）" : "Recipient Address (optional, defaults to your wallet)"}
                </label>
                <Input
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder={lang === "zh" ? "0x... 或 Solana 地址" : "0x... or Solana address"}
                  className="cyber-input font-mono text-xs tracking-wider"
                  data-testid="input-recipient-address"
                />
              </div>

              {quote && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-md bg-primary/5 border border-primary/15 space-y-2"
                >
                  <div className="flex justify-between">
                    <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                      {lang === "zh" ? "桥接路由" : "Route"}
                    </span>
                    <span className="font-orbitron text-[9px] text-primary font-bold">Wormhole Token Bridge</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.bridge.bridgeFee}</span>
                    <span className="font-orbitron text-[10px] text-foreground">{quote.fee.toFixed(4)} $CNOVA ({quote.feePercent}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                      {lang === "zh" ? "中继费" : "Relayer Fee"}
                    </span>
                    <span className="font-orbitron text-[10px] text-foreground">{quote.relayerFee} $CNOVA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.bridge.estTime}</span>
                    <span className="font-orbitron text-[10px] text-foreground">{quote.estimatedTime}</span>
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
                  {lang === "zh"
                    ? "跨链桥通过 Wormhole 协议运行。$CNOVA 代币部署后将启用真实跨链转账，当前为模拟模式。"
                    : "Bridge powered by Wormhole Protocol. Real cross-chain transfers activate once $CNOVA token is deployed. Currently in simulation mode."}
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
