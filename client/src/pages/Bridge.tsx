import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  connectBridgeWallet,
  switchBridgeChain,
  getTokenMeta,
  getTokenBalance,
  getAllowance,
  approveBridge,
  bridgeForgAI,
  quoteForgAIBridge,
  EVM_CHAINS,
  FORGAI_TOKEN,
  type TokenMeta,
  type BridgeQuote,
  type BridgeResult,
} from "@/lib/evmBridge";
import type { Address } from "viem";
import {
  ArrowRight,
  CheckCircle,
  RotateCcw,
  Wallet,
  AlertTriangle,
  Shield,
  Zap,
  ExternalLink,
  Copy,
  Info,
  ArrowDownUp,
  Globe,
  Activity,
  Link2,
} from "lucide-react";

type BridgeStatus = "idle" | "switching" | "approving" | "bridging" | "complete";
type TargetChainKey = "opbnb" | "arbitrum";

const AMOUNT_PRESETS = [100, 500, 1000, 5000];

export default function Bridge() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [evmAddress, setEvmAddress] = useState<Address | null>(null);
  const [targetChain, setTargetChain] = useState<TargetChainKey>("opbnb");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [bridgeResult, setBridgeResult] = useState<BridgeResult | null>(null);
  const [tokenMeta, setTokenMeta] = useState<TokenMeta | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [allowance, setAllowance] = useState<string>("0");
  const [loadingMeta, setLoadingMeta] = useState(false);

  const connected = !!evmAddress;
  const parsedAmount = parseFloat(amount) || 0;
  const parsedAllowance = parseFloat(allowance) || 0;
  const parsedBalance = parseFloat(balance) || 0;
  const needsApproval = parsedAmount > 0 && parsedAmount > parsedAllowance;
  const insufficientBalance = parsedAmount > parsedBalance;
  const fromConfig = EVM_CHAINS.bsc;
  const toConfig = EVM_CHAINS[targetChain];

  const quote: BridgeQuote | null = useMemo(
    () => (parsedAmount > 0 ? quoteForgAIBridge(amount, "bsc", targetChain) : null),
    [amount, targetChain, parsedAmount]
  );

  const canBridge =
    connected &&
    parsedAmount > 0 &&
    !insufficientBalance &&
    !needsApproval &&
    status === "idle";

  const canApprove =
    connected &&
    parsedAmount > 0 &&
    !insufficientBalance &&
    needsApproval &&
    status === "idle";

  const loadTokenInfo = useCallback(async () => {
    if (!evmAddress) return;
    setLoadingMeta(true);
    try {
      const [meta, bal, allow] = await Promise.all([
        getTokenMeta("bsc", FORGAI_TOKEN),
        getTokenBalance("bsc", FORGAI_TOKEN, evmAddress),
        getAllowance("bsc", FORGAI_TOKEN, evmAddress, fromConfig.bridgeAddress),
      ]);
      setTokenMeta(meta);
      setBalance(bal);
      setAllowance(allow);
    } catch (err: any) {
      console.warn("Failed to load token info:", err.message);
    } finally {
      setLoadingMeta(false);
    }
  }, [evmAddress, fromConfig.bridgeAddress]);

  useEffect(() => {
    if (evmAddress) loadTokenInfo();
  }, [evmAddress, loadTokenInfo]);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        setEvmAddress(null);
      } else {
        setEvmAddress(accs[0] as Address);
      }
    };
    const handleChainChanged = () => {
      if (evmAddress) loadTokenInfo();
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [evmAddress, loadTokenInfo]);

  const handleConnect = async () => {
    try {
      const addr = await connectBridgeWallet();
      setEvmAddress(addr);
      await switchBridgeChain("bsc");
      toast({ title: "Wallet Connected", description: `${addr.slice(0, 6)}...${addr.slice(-4)}` });
    } catch (err: any) {
      toast({ title: "Connection Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleApprove = async () => {
    if (!evmAddress || !tokenMeta) return;
    setStatus("approving");
    try {
      await switchBridgeChain("bsc");
      const hash = await approveBridge(
        "bsc",
        FORGAI_TOKEN,
        fromConfig.bridgeAddress,
        amount,
        tokenMeta.decimals
      );
      toast({ title: "Approval Sent", description: `Tx: ${hash.slice(0, 10)}...` });
      await loadTokenInfo();
      setStatus("idle");
    } catch (err: any) {
      setStatus("idle");
      const msg = err?.message || "";
      if (msg.includes("User rejected") || err?.code === 4001) {
        toast({ title: "Cancelled", description: "You rejected the approval.", variant: "destructive" });
      } else {
        toast({ title: "Approve Failed", description: msg.slice(0, 100), variant: "destructive" });
      }
    }
  };

  const handleBridge = async () => {
    if (!evmAddress || !tokenMeta) return;
    setStatus("switching");
    try {
      await switchBridgeChain("bsc");
      setStatus("bridging");
      const result = await bridgeForgAI({
        fromChainKey: "bsc",
        toChainKey: targetChain,
        amount,
        decimals: tokenMeta.decimals,
        recipient: (recipient || undefined) as Address | undefined,
      });
      setBridgeResult(result);
      setStatus("complete");
      toast({ title: "Bridge Initiated!", description: `${amount} FORGAI → ${toConfig.name}` });
      await loadTokenInfo();
    } catch (err: any) {
      setStatus("idle");
      const msg = err?.message || "";
      if (msg.includes("User rejected") || err?.code === 4001) {
        toast({ title: "Cancelled", description: "You rejected the transaction.", variant: "destructive" });
      } else if (msg.includes("insufficient")) {
        toast({ title: "Insufficient Balance", description: "Check your BNB gas and token balance.", variant: "destructive" });
      } else {
        toast({ title: t.bridge.bridgeFailed, description: msg.slice(0, 120), variant: "destructive" });
      }
    }
  };

  const resetBridge = () => {
    setStatus("idle");
    setAmount("");
    setRecipient("");
    setBridgeResult(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: text.slice(0, 30) + "..." });
  };

  const truncateAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="min-h-full px-6 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="font-orbitron text-2xl font-black uppercase tracking-wider text-foreground neon-glow-text mb-1">
            Bridge v2 · EVM
          </h1>
          <p className="font-orbitron text-[9px] text-muted-foreground/60 tracking-widest uppercase">
            BSC ERC20 跨链桥 — 不再使用 Solana Wormhole
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: Shield, label: "MPC Secured", color: "text-green-400" },
            { icon: Zap, label: "Fast Settlement", color: "text-yellow-400" },
            { icon: Globe, label: "Multi-Chain", color: "text-blue-400" },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card rounded-md border border-primary/15 p-3 text-center"
            >
              <item.icon className={`w-4 h-4 ${item.color} mx-auto mb-1`} />
              <div className="font-orbitron text-[8px] text-muted-foreground/70 uppercase tracking-widest">{item.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="glass-card rounded-md border border-primary/20 p-3 mb-4 flex items-start gap-2">
          <Info className="w-4 h-4 text-primary/70 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-primary font-semibold">Bridge v2</span> 专为 BSC ERC20 代币设计。
            源链固定为 BSC，目标链支持 opBNB 和 Arbitrum。
            代币合约：
            <button
              onClick={() => copyToClipboard(FORGAI_TOKEN)}
              className="font-mono text-[10px] text-primary/80 ml-1 hover:text-primary transition-colors"
              data-testid="button-copy-token"
            >
              {truncateAddr(FORGAI_TOKEN)} <Copy className="w-3 h-3 inline" />
            </button>
          </div>
        </div>

        {!connected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-md border border-primary/20 p-8 text-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-primary/60" />
            </div>
            <h2 className="font-orbitron text-sm font-bold uppercase tracking-wider text-foreground mb-2">
              连接 EVM 钱包
            </h2>
            <p className="text-muted-foreground text-xs mb-4">
              使用 MetaMask / OKX Wallet 连接到 BSC 网络
            </p>
            <Button
              onClick={handleConnect}
              className="font-orbitron text-[10px] tracking-wider uppercase gap-2"
              data-testid="button-connect-evm"
              style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
            >
              <Wallet className="w-3.5 h-3.5" />
              Connect EVM Wallet
            </Button>
          </motion.div>
        )}

        {connected && status !== "complete" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-card rounded-md border border-primary/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest">
                  Connected
                </span>
                <span className="font-mono text-[10px] text-primary">{truncateAddr(evmAddress!)}</span>
              </div>

              <div className="flex items-center gap-3 mb-4 p-3 rounded-md bg-primary/5 border border-primary/10">
                <div className="flex-1 text-center">
                  <div className="font-orbitron text-[8px] text-muted-foreground/50 uppercase tracking-widest mb-1">Source</div>
                  <div className="font-orbitron text-xs font-bold text-foreground">{fromConfig.shortName}</div>
                  <div className="font-orbitron text-[8px] text-muted-foreground/50">Chain {fromConfig.id}</div>
                </div>
                <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-orbitron text-[8px] text-muted-foreground/50 uppercase tracking-widest mb-1 text-center">Target</div>
                  <div className="flex gap-2 justify-center">
                    {(["opbnb", "arbitrum"] as const).map((chain) => (
                      <button
                        key={chain}
                        onClick={() => setTargetChain(chain)}
                        data-testid={`button-chain-${chain}`}
                        className={`px-3 py-1.5 rounded border font-orbitron text-[9px] tracking-wider uppercase transition-all ${
                          targetChain === chain
                            ? "bg-primary/30 border-primary/60 text-primary"
                            : "border-border/40 text-muted-foreground/60"
                        }`}
                      >
                        {EVM_CHAINS[chain].shortName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70">
                      Amount ({tokenMeta?.symbol || "FORGAI"})
                    </label>
                    <span className="font-orbitron text-[9px] text-muted-foreground/50">
                      Balance: {loadingMeta ? "..." : parseFloat(balance).toLocaleString()}
                    </span>
                  </div>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="cyber-input font-orbitron text-lg tracking-wider text-center"
                    data-testid="input-bridge-amount"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {AMOUNT_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setAmount(String(p))}
                        data-testid={`button-amount-${p}`}
                        className="px-2.5 py-1 border border-border/50 rounded font-orbitron text-[9px] tracking-wider text-muted-foreground/70 transition-all hover:border-primary/40"
                      >
                        {p.toLocaleString()}
                      </button>
                    ))}
                    <button
                      onClick={() => setAmount(balance)}
                      data-testid="button-amount-max"
                      className="px-2.5 py-1 border border-primary/30 rounded font-orbitron text-[9px] tracking-wider text-primary transition-all"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {insufficientBalance && parsedAmount > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/30">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    <span className="font-orbitron text-[9px] text-red-400">Insufficient balance</span>
                  </div>
                )}

                <div>
                  <label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 block mb-1.5">
                    Recipient (optional)
                  </label>
                  <Input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder={`Defaults to ${truncateAddr(evmAddress!)}`}
                    className="cyber-input font-mono text-xs"
                    data-testid="input-bridge-recipient"
                  />
                </div>
              </div>
            </div>

            {quote && parsedAmount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="glass-card rounded-md border border-primary/15 p-4 space-y-2"
              >
                <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest mb-2">Quote</div>
                {[
                  { label: "You Send", value: `${parsedAmount} ${tokenMeta?.symbol || "FORGAI"}` },
                  { label: "You Receive", value: `≈ ${quote.receiveAmount} ${tokenMeta?.symbol || "FORGAI"}` },
                  { label: "Protocol Fee", value: quote.protocolFee },
                  { label: "Route", value: quote.route },
                  { label: "ETA", value: quote.eta },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
                    <span className="font-orbitron text-[10px] text-foreground font-semibold">{value}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {needsApproval && parsedAmount > 0 && !insufficientBalance && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/5 border border-yellow-500/20">
                <Info className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="font-orbitron text-[9px] text-yellow-400/80 leading-relaxed tracking-wide">
                  需要先授权 (Approve) Bridge 合约使用你的代币。当前授权额度不足。
                </p>
              </div>
            )}

            <div className="flex gap-2">
              {canApprove && (
                <Button
                  onClick={handleApprove}
                  disabled={status !== "idle"}
                  className="flex-1 font-orbitron text-[10px] tracking-wider uppercase gap-2"
                  data-testid="button-approve"
                  style={{ background: "linear-gradient(135deg, #b45309, #92400e)" }}
                >
                  {status === "approving" ? (
                    <><RotateCcw className="w-3 h-3 animate-spin" />Approving...</>
                  ) : (
                    <><CheckCircle className="w-3 h-3" />Approve {tokenMeta?.symbol || "FORGAI"}</>
                  )}
                </Button>
              )}
              <Button
                onClick={handleBridge}
                disabled={!canBridge || status !== "idle"}
                className="flex-1 font-orbitron text-[10px] tracking-wider uppercase gap-2"
                data-testid="button-bridge"
                style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
              >
                {status === "switching" ? (
                  <><RotateCcw className="w-3 h-3 animate-spin" />Switching Chain...</>
                ) : status === "bridging" ? (
                  <><RotateCcw className="w-3 h-3 animate-spin" />Bridging...</>
                ) : (
                  <><ArrowDownUp className="w-3 h-3" />Bridge to {toConfig.shortName}</>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {status === "complete" && bridgeResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-md border border-green-500/30 p-6 text-center space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-16 h-16 rounded-full bg-green-400/20 border border-green-400/40 flex items-center justify-center mx-auto"
            >
              <CheckCircle className="w-8 h-8 text-green-400" />
            </motion.div>
            <div>
              <div className="font-orbitron text-lg font-bold text-foreground uppercase tracking-wider mb-1">
                Bridge Initiated!
              </div>
              <p className="text-sm text-muted-foreground">
                {amount} {tokenMeta?.symbol || "FORGAI"} → {toConfig.name}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Relayer 将在几分钟内完成目标链铸币/释放
              </p>
            </div>
            <div className="p-3 rounded-md bg-primary/5 border border-primary/15 space-y-2 text-left">
              <div className="flex justify-between items-center">
                <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest">Tx Hash</span>
                <button onClick={() => copyToClipboard(bridgeResult.txHash)} className="flex items-center gap-1">
                  <span className="font-mono text-[9px] text-primary">{truncateAddr(bridgeResult.txHash)}</span>
                  <Copy className="w-3 h-3 text-primary/60" />
                </button>
              </div>
              <a
                href={bridgeResult.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] text-primary/70 hover:text-primary transition-colors font-orbitron tracking-wider"
              >
                <ExternalLink className="w-3 h-3" /> View on Explorer
              </a>
            </div>
            <Button
              onClick={resetBridge}
              className="w-full font-orbitron text-[10px] tracking-wider uppercase gap-2"
              data-testid="button-bridge-again"
              style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
            >
              <ArrowDownUp className="w-3 h-3" /> Bridge Again
            </Button>
          </motion.div>
        )}

        <div className="mt-6 glass-card rounded-md border border-primary/10 p-4">
          <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest mb-3">
            Supported Routes
          </div>
          <div className="space-y-2">
            {[
              { from: "BSC", to: "opBNB", mode: "Lock/Mint", eta: "~1 min" },
              { from: "BSC", to: "Arbitrum", mode: "Lock/Mint", eta: "~2-5 min" },
            ].map((route, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                <div className="flex items-center gap-2">
                  <Link2 className="w-3 h-3 text-primary/60" />
                  <span className="font-orbitron text-[10px] text-foreground">
                    {route.from} → {route.to}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-orbitron text-[8px] text-muted-foreground/50 uppercase">{route.mode}</span>
                  <span className="font-orbitron text-[8px] text-green-400">{route.eta}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
