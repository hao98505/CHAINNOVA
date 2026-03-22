import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  connectBridgeWallet,
  switchBridgeChain,
  getTokenBalance as getEvmTokenBalance,
  getAllowance,
  approveBridge,
  EVM_CHAINS,
  getWrappedTokenForChain,
} from "@/lib/evmBridge";
import {
  getSolanaTokenBalance,
  SOLANA_MINT,
  type SolanaWalletAdapter,
} from "@/lib/solanaBridge";
import {
  ALL_CHAINS,
  getBridgeDirection,
  getValidTargets,
  quoteBridge,
  executeSolanaBridge,
  executeEvmToSolanaBridge,
  type ChainKey,
} from "@/lib/bridgeRouter";
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
  Link2,
} from "lucide-react";

type BridgeStatus = "idle" | "switching" | "approving" | "bridging" | "complete";

const AMOUNT_PRESETS = [100, 500, 1000, 5000];
const SOLANA_MINT_SHORT = "6ZcR1K...ppump";

export default function Bridge() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const solanaWallet = useWallet();

  const [sourceChain, setSourceChain] = useState<ChainKey>("solana");
  const [targetChain, setTargetChain] = useState<ChainKey>("bsc");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [bridgeResult, setBridgeResult] = useState<{ txHash: string; explorerUrl: string } | null>(null);
  const [balance, setBalance] = useState("0");
  const [decimals, setDecimals] = useState(6);
  const [allowance, setAllowance] = useState("0");
  const [evmAddress, setEvmAddress] = useState<Address | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const direction = getBridgeDirection(sourceChain, targetChain);
  const isSolanaSource = sourceChain === "solana";
  const isEvmSource = !isSolanaSource;
  const solanaConnected = !!solanaWallet.publicKey;
  const evmConnected = !!evmAddress;
  const connected = isSolanaSource ? solanaConnected : evmConnected;

  const parsedAmount = parseFloat(amount) || 0;
  const parsedBalance = parseFloat(balance) || 0;
  const parsedAllowance = parseFloat(allowance) || 0;
  const insufficientBalance = parsedAmount > parsedBalance;
  const needsApproval = isEvmSource && parsedAmount > 0 && parsedAmount > parsedAllowance;

  const validTargets = getValidTargets(sourceChain);

  const quote = useMemo(
    () => (parsedAmount > 0 && direction ? quoteBridge(amount, sourceChain, targetChain) : null),
    [amount, sourceChain, targetChain, parsedAmount, direction]
  );

  const canBridge = connected && parsedAmount > 0 && !insufficientBalance && !needsApproval && status === "idle" && !!direction;

  useEffect(() => {
    if (!validTargets.includes(targetChain)) {
      setTargetChain(validTargets[0]);
    }
  }, [sourceChain, validTargets, targetChain]);

  const loadBalance = useCallback(async () => {
    setLoadingMeta(true);
    try {
      if (isSolanaSource && solanaWallet.publicKey) {
        const info = await getSolanaTokenBalance(solanaWallet.publicKey);
        setBalance(info.balance);
        setDecimals(info.decimals);
        setAllowance("999999999");
      } else if (isEvmSource && evmAddress) {
        const wrappedToken = getWrappedTokenForChain(sourceChain);
        if (wrappedToken) {
          const bal = await getEvmTokenBalance(sourceChain, wrappedToken, evmAddress);
          setBalance(bal);
          setDecimals(18);
          const config = EVM_CHAINS[sourceChain];
          if (config) {
            const allow = await getAllowance(sourceChain, wrappedToken, evmAddress, config.bridgeAddress);
            setAllowance(allow);
          }
        } else {
          setBalance("0");
          setAllowance("0");
        }
      }
    } catch (err: any) {
      console.warn("Failed to load balance:", err.message);
    } finally {
      setLoadingMeta(false);
    }
  }, [isSolanaSource, isEvmSource, solanaWallet.publicKey, evmAddress, sourceChain]);

  useEffect(() => {
    if (connected) loadBalance();
  }, [connected, loadBalance]);

  useEffect(() => {
    setBalance("0");
    setAllowance("0");
    setAmount("");
    setRecipient("");
    setBridgeResult(null);
    setStatus("idle");
  }, [sourceChain]);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccounts = (accounts: unknown) => {
      const accs = accounts as string[];
      setEvmAddress(accs.length > 0 ? (accs[0] as Address) : null);
    };
    window.ethereum.on("accountsChanged", handleAccounts);
    return () => { window.ethereum?.removeListener("accountsChanged", handleAccounts); };
  }, []);

  const handleConnectEvm = async () => {
    try {
      const addr = await connectBridgeWallet();
      setEvmAddress(addr);
      await switchBridgeChain(sourceChain);
      toast({ title: "EVM Wallet Connected", description: `${addr.slice(0, 6)}...${addr.slice(-4)}` });
    } catch (err: any) {
      toast({ title: "Connection Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleApprove = async () => {
    if (!evmAddress) return;
    const wrappedToken = getWrappedTokenForChain(sourceChain);
    if (!wrappedToken) return;
    setStatus("approving");
    try {
      await switchBridgeChain(sourceChain);
      const config = EVM_CHAINS[sourceChain];
      const hash = await approveBridge(sourceChain, wrappedToken, config.bridgeAddress, amount, decimals);
      toast({ title: "Approval Sent", description: `Tx: ${hash.slice(0, 10)}...` });
      await loadBalance();
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
    if (!direction) return;
    setStatus("bridging");
    try {
      if (direction === "solana-to-evm") {
        if (!solanaWallet.publicKey) throw new Error("Solana wallet not connected");
        const recipientAddr = recipient || evmAddress || "";
        if (!recipientAddr) throw new Error("Please enter a target EVM address");
        const result = await executeSolanaBridge({
          wallet: solanaWallet as unknown as SolanaWalletAdapter,
          amount,
          decimals,
          targetChain,
          recipientEvmAddress: recipientAddr,
        });
        setBridgeResult({ txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        if (!evmAddress) throw new Error("EVM wallet not connected");
        const recipientAddr = recipient || (solanaWallet.publicKey?.toBase58() || "");
        if (!recipientAddr) throw new Error("Please enter a target Solana address");
        await switchBridgeChain(sourceChain);
        const result = await executeEvmToSolanaBridge({
          fromChainKey: sourceChain,
          amount,
          decimals,
          recipientSolanaAddress: recipientAddr,
        });
        setBridgeResult({ txHash: result.txHash, explorerUrl: result.explorerUrl });
      }
      setStatus("complete");
      toast({ title: "Bridge Initiated!", description: `${amount} ForgAI → ${ALL_CHAINS[targetChain].shortName}` });
      await loadBalance();
    } catch (err: any) {
      setStatus("idle");
      const msg = err?.message || "";
      if (msg.includes("User rejected") || err?.code === 4001) {
        toast({ title: "Cancelled", description: "You rejected the transaction.", variant: "destructive" });
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

  const truncAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const allChainKeys: ChainKey[] = ["solana", "bsc", "arbitrum", "ethereum"];

  return (
    <div className="min-h-full px-6 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="font-orbitron text-2xl font-black uppercase tracking-wider text-foreground neon-glow-text mb-1" data-testid="text-bridge-title">
            Bridge v3 · Solana ↔ EVM
          </h1>
          <p className="font-orbitron text-[9px] text-muted-foreground/60 tracking-widest uppercase">
            ForgAI 跨链桥 — Solana / BSC / Arbitrum / Ethereum
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: Shield, label: "Custodial MVP", color: "text-green-400" },
            { icon: Zap, label: "Fast Settlement", color: "text-yellow-400" },
            { icon: Globe, label: "4 Chains", color: "text-blue-400" },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-card rounded-md border border-primary/15 p-3 text-center">
              <item.icon className={`w-4 h-4 ${item.color} mx-auto mb-1`} />
              <div className="font-orbitron text-[8px] text-muted-foreground/70 uppercase tracking-widest">{item.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="glass-card rounded-md border border-primary/20 p-3 mb-4 flex items-start gap-2">
          <Info className="w-4 h-4 text-primary/70 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-primary font-semibold">Bridge v3</span> 支持 Solana 原生 ForgAI 与 EVM 三链 (BSC / Arbitrum / Ethereum) 双向桥接。
            Solana Mint：
            <button onClick={() => copyToClipboard(SOLANA_MINT.toBase58())}
              className="font-mono text-[10px] text-primary/80 ml-1 hover:text-primary transition-colors" data-testid="button-copy-mint">
              {SOLANA_MINT_SHORT} <Copy className="w-3 h-3 inline" />
            </button>
          </div>
        </div>

        {status !== "complete" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-card rounded-md border border-primary/20 p-4">
              <div className="flex items-center gap-3 mb-4 p-3 rounded-md bg-primary/5 border border-primary/10">
                <div className="flex-1">
                  <div className="font-orbitron text-[8px] text-muted-foreground/50 uppercase tracking-widest mb-1.5 text-center">Source</div>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {allChainKeys.map((chain) => (
                      <button key={chain} onClick={() => setSourceChain(chain)} data-testid={`button-source-${chain}`}
                        className={`px-2.5 py-1.5 rounded border font-orbitron text-[9px] tracking-wider uppercase transition-all ${
                          sourceChain === chain ? "bg-primary/30 border-primary/60 text-primary" : "border-border/40 text-muted-foreground/60"
                        }`}>
                        {ALL_CHAINS[chain].shortName}
                      </button>
                    ))}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-orbitron text-[8px] text-muted-foreground/50 uppercase tracking-widest mb-1.5 text-center">Target</div>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {validTargets.map((chain) => (
                      <button key={chain} onClick={() => setTargetChain(chain)} data-testid={`button-target-${chain}`}
                        className={`px-2.5 py-1.5 rounded border font-orbitron text-[9px] tracking-wider uppercase transition-all ${
                          targetChain === chain ? "bg-primary/30 border-primary/60 text-primary" : "border-border/40 text-muted-foreground/60"
                        }`}>
                        {ALL_CHAINS[chain].shortName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {!connected && (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                    <Wallet className="w-7 h-7 text-primary/60" />
                  </div>
                  {isSolanaSource ? (
                    <p className="text-muted-foreground text-xs mb-3">请使用顶部钱包按钮连接 Phantom / Solflare</p>
                  ) : (
                    <>
                      <p className="text-muted-foreground text-xs mb-3">使用 MetaMask 连接到 {ALL_CHAINS[sourceChain].name}</p>
                      <Button onClick={handleConnectEvm} className="font-orbitron text-[10px] tracking-wider uppercase gap-2"
                        data-testid="button-connect-evm" style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}>
                        <Wallet className="w-3.5 h-3.5" /> Connect EVM Wallet
                      </Button>
                    </>
                  )}
                </div>
              )}

              {connected && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest">Connected</span>
                    <span className="font-mono text-[10px] text-primary">
                      {isSolanaSource ? truncAddr(solanaWallet.publicKey!.toBase58()) : truncAddr(evmAddress!)}
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70">Amount (ForgAI)</label>
                      <span className="font-orbitron text-[9px] text-muted-foreground/50">
                        Balance: {loadingMeta ? "..." : parseFloat(balance).toLocaleString()}
                      </span>
                    </div>
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
                      className="cyber-input font-orbitron text-lg tracking-wider text-center" data-testid="input-bridge-amount" />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {AMOUNT_PRESETS.map((p) => (
                        <button key={p} onClick={() => setAmount(String(p))} data-testid={`button-amount-${p}`}
                          className="px-2.5 py-1 border border-border/50 rounded font-orbitron text-[9px] tracking-wider text-muted-foreground/70 transition-all hover:border-primary/40">
                          {p.toLocaleString()}
                        </button>
                      ))}
                      <button onClick={() => setAmount(balance)} data-testid="button-amount-max"
                        className="px-2.5 py-1 border border-primary/30 rounded font-orbitron text-[9px] tracking-wider text-primary transition-all">MAX</button>
                    </div>
                  </div>

                  {insufficientBalance && parsedAmount > 0 && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/30">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span className="font-orbitron text-[9px] text-red-400">余额不足</span>
                    </div>
                  )}

                  <div>
                    <label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 block mb-1.5">
                      {isSolanaSource ? "目标 EVM 地址 (必填)" : "目标 Solana 地址 (必填)"}
                    </label>
                    <Input value={recipient} onChange={(e) => setRecipient(e.target.value)}
                      placeholder={isSolanaSource ? "0x..." : "Base58 Solana address"}
                      className="cyber-input font-mono text-xs" data-testid="input-bridge-recipient" />
                  </div>
                </div>
              )}
            </div>

            {quote && parsedAmount > 0 && connected && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="glass-card rounded-md border border-primary/15 p-4 space-y-2">
                <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest mb-2">Quote</div>
                {[
                  { label: "You Send", value: `${parsedAmount} ForgAI` },
                  { label: "You Receive", value: `≈ ${quote.receiveAmount} ForgAI` },
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
                  需要先授权 (Approve) Bridge 合约使用你的 wrapped token。
                </p>
              </div>
            )}

            {connected && (
              <div className="flex gap-2">
                {needsApproval && parsedAmount > 0 && !insufficientBalance && (
                  <Button onClick={handleApprove} disabled={status !== "idle" && status !== "approving"}
                    className="flex-1 font-orbitron text-[10px] tracking-wider uppercase gap-2" data-testid="button-approve"
                    style={{ background: "linear-gradient(135deg, #b45309, #92400e)" }}>
                    {status === "approving" ? <><RotateCcw className="w-3 h-3 animate-spin" />Approving...</> : <><CheckCircle className="w-3 h-3" />Approve</>}
                  </Button>
                )}
                <Button onClick={handleBridge} disabled={!canBridge}
                  className="flex-1 font-orbitron text-[10px] tracking-wider uppercase gap-2" data-testid="button-bridge"
                  style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}>
                  {status === "bridging" ? <><RotateCcw className="w-3 h-3 animate-spin" />Bridging...</> :
                    <><ArrowDownUp className="w-3 h-3" />Bridge to {ALL_CHAINS[targetChain].shortName}</>}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {status === "complete" && bridgeResult && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-md border border-green-500/30 p-6 text-center space-y-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
              className="w-16 h-16 rounded-full bg-green-400/20 border border-green-400/40 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </motion.div>
            <div>
              <div className="font-orbitron text-lg font-bold text-foreground uppercase tracking-wider mb-1">Bridge Initiated!</div>
              <p className="text-sm text-muted-foreground">{amount} ForgAI → {ALL_CHAINS[targetChain].name}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Relayer 将在几分钟内完成目标链铸币/释放</p>
            </div>
            <div className="p-3 rounded-md bg-primary/5 border border-primary/15 space-y-2 text-left">
              <div className="flex justify-between items-center">
                <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest">Tx Hash</span>
                <button onClick={() => copyToClipboard(bridgeResult.txHash)} className="flex items-center gap-1" data-testid="button-copy-tx">
                  <span className="font-mono text-[9px] text-primary">{truncAddr(bridgeResult.txHash)}</span>
                  <Copy className="w-3 h-3 text-primary/60" />
                </button>
              </div>
              <a href={bridgeResult.explorerUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] text-primary/70 hover:text-primary transition-colors font-orbitron tracking-wider">
                <ExternalLink className="w-3 h-3" /> View on Explorer
              </a>
            </div>
            <Button onClick={resetBridge} className="w-full font-orbitron text-[10px] tracking-wider uppercase gap-2"
              data-testid="button-bridge-again" style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}>
              <ArrowDownUp className="w-3 h-3" /> Bridge Again
            </Button>
          </motion.div>
        )}

        <div className="mt-6 glass-card rounded-md border border-primary/10 p-4">
          <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest mb-3">Supported Routes</div>
          <div className="space-y-2">
            {[
              { from: "Solana", to: "BSC", mode: "Custodial", eta: "~2-5 min" },
              { from: "Solana", to: "Arbitrum", mode: "Custodial", eta: "~3-7 min" },
              { from: "Solana", to: "Ethereum", mode: "Custodial", eta: "~5-15 min" },
              { from: "BSC", to: "Solana", mode: "Custodial", eta: "~2-5 min" },
              { from: "Arbitrum", to: "Solana", mode: "Custodial", eta: "~3-7 min" },
              { from: "Ethereum", to: "Solana", mode: "Custodial", eta: "~5-15 min" },
            ].map((route, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                <div className="flex items-center gap-2">
                  <Link2 className="w-3 h-3 text-primary/60" />
                  <span className="font-orbitron text-[10px] text-foreground">{route.from} → {route.to}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-orbitron text-[8px] text-muted-foreground/50 uppercase">{route.mode}</span>
                  <span className="font-orbitron text-[8px] text-green-400">{route.eta}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 glass-card rounded-md border border-yellow-500/20 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-yellow-400/70 leading-relaxed">
            当前为 Custodial MVP 版本，资金由项目方 Vault 托管。请仅用于测试用途，不要桥接大额资金。
          </p>
        </div>
      </div>
    </div>
  );
}
