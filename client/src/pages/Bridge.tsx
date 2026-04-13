import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  connectBridgeWallet,
  switchBridgeChain,
  getTokenBalance as getEvmTokenBalance,
  getAllowance,
  approveBridge,
  EVM_CHAINS,
  getSourceTokenForChain,
} from "@/lib/evmBridge";
import {
  ALL_CHAINS,
  getBridgeDirection,
  getValidTargets,
  getSelectableSourceChains,
  isChainDisabled,
  quoteBridge,
  executeEvmToEvmBridge,
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
  Construction,
} from "lucide-react";

type BridgeStatus = "idle" | "switching" | "approving" | "bridging" | "complete";

const AMOUNT_PRESETS = [100, 500, 1000, 5000];

const BSC_TOKEN_FULL = "0x0a9c2e3cda80a828334bfa2577a75a85229f7777";

function getSourceTokenDisplay(chain: ChainKey): { label: string; address: string; short: string } | null {
  if (isChainDisabled(chain)) return null;
  if (chain === "bsc") {
    return { label: "BSC Token", address: BSC_TOKEN_FULL, short: "0x0a9c...7777" };
  }
  const token = getSourceTokenForChain(chain);
  if (token) {
    const chainLabel = chain === "arbitrum" ? "ARB Token" : "ETH Token";
    return { label: chainLabel, address: token, short: `${token.slice(0, 8)}...${token.slice(-4)}` };
  }
  return null;
}

export default function Bridge() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [sourceChain, setSourceChain] = useState<ChainKey>("bsc");
  const [targetChain, setTargetChain] = useState<ChainKey>("arbitrum");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [bridgeResult, setBridgeResult] = useState<{ txHash: string; explorerUrl: string } | null>(null);
  const [balance, setBalance] = useState("0");
  const [decimals, setDecimals] = useState(18);
  const [allowance, setAllowance] = useState("0");
  const [evmAddress, setEvmAddress] = useState<Address | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const direction = getBridgeDirection(sourceChain, targetChain);
  const connected = !!evmAddress;

  const parsedAmount = parseFloat(amount) || 0;
  const parsedBalance = parseFloat(balance) || 0;
  const parsedAllowance = parseFloat(allowance) || 0;
  const insufficientBalance = parsedAmount > parsedBalance;
  const needsApproval = parsedAmount > 0 && parsedAmount > parsedAllowance;

  const validTargets = getValidTargets(sourceChain);
  const selectableSources = getSelectableSourceChains();

  const quote = useMemo(
    () => (parsedAmount > 0 && direction ? quoteBridge(amount, sourceChain, targetChain) : null),
    [amount, sourceChain, targetChain, parsedAmount, direction]
  );

  const canBridge = connected && parsedAmount > 0 && !insufficientBalance && !needsApproval && status === "idle" && !!direction;

  const sourceTokenInfo = useMemo(() => getSourceTokenDisplay(sourceChain), [sourceChain]);

  useEffect(() => {
    if (!validTargets.includes(targetChain)) {
      setTargetChain(validTargets[0] || "arbitrum");
    }
  }, [sourceChain, validTargets, targetChain]);

  const loadBalance = useCallback(async () => {
    if (!evmAddress) return;
    setLoadingMeta(true);
    try {
      const sourceToken = getSourceTokenForChain(sourceChain);
      if (sourceToken) {
        const bal = await getEvmTokenBalance(sourceChain, sourceToken, evmAddress);
        setBalance(bal);
        setDecimals(18);
        const config = EVM_CHAINS[sourceChain];
        if (config) {
          const allow = await getAllowance(sourceChain, sourceToken, evmAddress, config.bridgeAddress);
          setAllowance(allow);
        }
      } else {
        setBalance("0");
        setAllowance("0");
      }
    } catch (err: any) {
      console.warn("Failed to load balance:", err.message);
    } finally {
      setLoadingMeta(false);
    }
  }, [evmAddress, sourceChain]);

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
    const sourceToken = getSourceTokenForChain(sourceChain);
    if (!sourceToken) return;
    setStatus("approving");
    try {
      await switchBridgeChain(sourceChain);
      const config = EVM_CHAINS[sourceChain];
      const hash = await approveBridge(sourceChain, sourceToken, config.bridgeAddress, amount, decimals);
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
    if (!direction || direction !== "evm-to-evm") return;
    if (!evmAddress) return;
    setStatus("bridging");
    try {
      const recipientAddr = recipient || evmAddress;
      if (!recipientAddr) throw new Error("Please enter a target EVM address");
      await switchBridgeChain(sourceChain);
      const result = await executeEvmToEvmBridge({
        fromChainKey: sourceChain,
        toChainKey: targetChain,
        amount,
        decimals,
        recipientEvmAddress: recipientAddr,
      });
      setBridgeResult({ txHash: result.txHash, explorerUrl: result.explorerUrl });
      setStatus("complete");
      toast({ title: "Bridge Initiated!", description: `${amount} CNOVA → ${ALL_CHAINS[targetChain].shortName}` });
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
            CNOVA Cross-Chain Bridge
          </h1>
          <p className="text-sm text-muted-foreground tracking-wide">
            EVM Cross-Chain Bridge — BSC / Arbitrum / Ethereum
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: Shield, label: "On-Chain Verified", color: "text-green-400" },
            { icon: Zap, label: "Auto Relay", color: "text-yellow-400" },
            { icon: Globe, label: "3 EVM Chains", color: "text-blue-400" },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-card rounded-md border border-primary/15 p-3 text-center">
              <item.icon className={`w-4 h-4 ${item.color} mx-auto mb-1`} />
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{item.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="glass-card rounded-md border border-yellow-500/30 p-3 mb-4 flex items-start gap-2" data-testid="banner-solana-upgrading">
          <Construction className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-400/90 leading-relaxed">
            <span className="font-semibold">Solana Bridge Upgrading</span> — Solana direction is temporarily disabled while we migrate to the new wrapped SPL (wCNOVA) model. EVM↔EVM bridging remains fully operational.
          </div>
        </div>

        <div className="glass-card rounded-md border border-primary/20 p-3 mb-4 flex items-start gap-2">
          <Info className="w-4 h-4 text-primary/70 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground leading-relaxed">
            <span className="text-primary font-semibold">EVM Bridge</span> supports BSC ↔ Arbitrum ↔ Ethereum with auto-relay.
            {sourceTokenInfo ? (
              <button onClick={() => copyToClipboard(sourceTokenInfo.address)}
                className="font-mono text-sm text-primary/90 ml-1 hover:text-primary transition-colors inline-flex items-center gap-1" data-testid="button-copy-token">
                {sourceTokenInfo.label}: {sourceTokenInfo.short} <Copy className="w-3 h-3 inline" />
              </button>
            ) : null}
          </div>
        </div>

        {status !== "complete" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-card rounded-md border border-primary/20 p-4">
              <div className="flex items-center gap-3 mb-4 p-3 rounded-md bg-primary/5 border border-primary/10">
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1.5 text-center">Source</div>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {allChainKeys.map((chain) => {
                      const disabled = isChainDisabled(chain);
                      const isSelected = sourceChain === chain;
                      return (
                        <button
                          key={chain}
                          onClick={() => !disabled && setSourceChain(chain)}
                          disabled={disabled}
                          data-testid={`button-source-${chain}`}
                          className={`px-3 py-1.5 rounded border text-sm font-semibold tracking-wide uppercase transition-all ${
                            disabled
                              ? "border-border/20 text-muted-foreground/30 cursor-not-allowed line-through"
                              : isSelected
                                ? "bg-primary/30 border-primary/60 text-primary"
                                : "border-border/40 text-muted-foreground/80 hover:border-primary/30"
                          }`}>
                          {ALL_CHAINS[chain].shortName}
                          {disabled && <Construction className="w-3 h-3 inline ml-1 text-yellow-400/50" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1.5 text-center">Target</div>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {validTargets.map((chain) => (
                      <button key={chain} onClick={() => setTargetChain(chain)} data-testid={`button-target-${chain}`}
                        className={`px-3 py-1.5 rounded border text-sm font-semibold tracking-wide uppercase transition-all ${
                          targetChain === chain ? "bg-primary/30 border-primary/60 text-primary" : "border-border/40 text-muted-foreground/80 hover:border-primary/30"
                        }`}>
                        {ALL_CHAINS[chain].shortName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {sourceTokenInfo && (
                <div className="mb-3 px-3 py-2 rounded bg-primary/5 border border-primary/10 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{sourceTokenInfo.label}</span>
                  <button onClick={() => copyToClipboard(sourceTokenInfo.address)}
                    className="font-mono text-sm text-primary/90 hover:text-primary transition-colors flex items-center gap-1">
                    {sourceTokenInfo.short} <Copy className="w-3 h-3" />
                  </button>
                </div>
              )}

              {!connected && (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                    <Wallet className="w-7 h-7 text-primary/60" />
                  </div>
                  <p className="text-muted-foreground text-sm mb-3">Connect MetaMask to {ALL_CHAINS[sourceChain].name}</p>
                  <Button onClick={handleConnectEvm} className="text-sm tracking-wide uppercase gap-2"
                    data-testid="button-connect-evm" style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}>
                    <Wallet className="w-4 h-4" /> Connect EVM Wallet
                  </Button>
                </div>
              )}

              {connected && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground uppercase tracking-wide">Connected</span>
                    <span className="font-mono text-sm text-primary">
                      {truncAddr(evmAddress!)}
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Amount (CNOVA)</label>
                      <span className="text-sm text-muted-foreground">
                        Balance: {loadingMeta ? "..." : parseFloat(balance).toLocaleString()}
                      </span>
                    </div>
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
                      className="cyber-input text-base tracking-wider text-center" data-testid="input-bridge-amount" />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {AMOUNT_PRESETS.map((p) => (
                        <button key={p} onClick={() => setAmount(String(p))} data-testid={`button-amount-${p}`}
                          className="px-3 py-1 border border-border/50 rounded text-sm font-medium tracking-wide text-muted-foreground/80 transition-all hover:border-primary/40 hover:text-primary/80">
                          {p.toLocaleString()}
                        </button>
                      ))}
                      <button onClick={() => setAmount(balance)} data-testid="button-amount-max"
                        className="px-3 py-1 border border-primary/30 rounded text-sm font-semibold tracking-wide text-primary transition-all hover:bg-primary/10">MAX</button>
                    </div>
                  </div>

                  {insufficientBalance && parsedAmount > 0 && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/30">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span className="text-sm text-red-400 font-medium" data-testid="text-insufficient-balance">Insufficient balance</span>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium uppercase tracking-wide text-muted-foreground block mb-1.5">
                      Target EVM Address (optional, defaults to connected wallet)
                    </label>
                    <Input value={recipient} onChange={(e) => setRecipient(e.target.value)}
                      placeholder="0x... (leave empty to use connected wallet)"
                      className="cyber-input font-mono text-base" data-testid="input-bridge-recipient" />
                  </div>
                </div>
              )}
            </div>

            {quote && parsedAmount > 0 && connected && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="glass-card rounded-md border border-primary/15 p-4 space-y-2">
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Quote</div>
                {[
                  { label: "You Send", value: `${parsedAmount} CNOVA` },
                  { label: "You Receive", value: `≈ ${quote.receiveAmount} CNOVA` },
                  { label: "Protocol Fee", value: quote.protocolFee },
                  { label: "Route", value: quote.route },
                  { label: "ETA", value: quote.eta },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-sm text-muted-foreground uppercase tracking-wide">{label}</span>
                    <span className="text-sm text-foreground font-semibold">{value}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {needsApproval && parsedAmount > 0 && !insufficientBalance && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/5 border border-yellow-500/20">
                <Info className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-400/90 leading-relaxed">
                  Approve the Bridge contract to use your CNOVA tokens first.
                </p>
              </div>
            )}

            {connected && (
              <div className="flex gap-2">
                {needsApproval && parsedAmount > 0 && !insufficientBalance && (
                  <Button onClick={handleApprove} disabled={status !== "idle" && status !== "approving"}
                    className="flex-1 text-sm tracking-wide uppercase gap-2" data-testid="button-approve"
                    style={{ background: "linear-gradient(135deg, #b45309, #92400e)" }}>
                    {status === "approving" ? <><RotateCcw className="w-4 h-4 animate-spin" />Approving...</> : <><CheckCircle className="w-4 h-4" />Approve</>}
                  </Button>
                )}
                <Button onClick={handleBridge} disabled={!canBridge}
                  className="flex-1 text-sm tracking-wide uppercase gap-2" data-testid="button-bridge"
                  style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}>
                  {status === "bridging" ? <><RotateCcw className="w-4 h-4 animate-spin" />Bridging...</> :
                    <><ArrowDownUp className="w-4 h-4" />Bridge to {ALL_CHAINS[targetChain].shortName}</>}
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
              <p className="text-sm text-muted-foreground">{amount} CNOVA → {ALL_CHAINS[targetChain].name}</p>
              <p className="text-sm text-muted-foreground/80 mt-1">Relayer will auto-complete the transfer on {ALL_CHAINS[targetChain].name}</p>
            </div>
            <div className="p-3 rounded-md bg-primary/5 border border-primary/15 space-y-2 text-left">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground uppercase tracking-wide">Tx Hash</span>
                <button onClick={() => copyToClipboard(bridgeResult.txHash)} className="flex items-center gap-1" data-testid="button-copy-tx">
                  <span className="font-mono text-sm text-primary">{truncAddr(bridgeResult.txHash)}</span>
                  <Copy className="w-3 h-3 text-primary/60" />
                </button>
              </div>
              <a href={bridgeResult.explorerUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary/80 hover:text-primary transition-colors tracking-wide">
                <ExternalLink className="w-3 h-3" /> View on Explorer
              </a>
            </div>
            <Button onClick={resetBridge} className="w-full text-sm tracking-wide uppercase gap-2"
              data-testid="button-bridge-again" style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}>
              <RotateCcw className="w-4 h-4" /> Bridge Again
            </Button>
          </motion.div>
        )}

        <div className="mt-6 glass-card rounded-md border border-primary/10 p-4 space-y-2">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contract Addresses</div>
          {[
            { label: "Bridge (all chains)", value: "0x49daa7A1109d061BF67b56676def0Bc439289Cb8" },
            { label: "BSC CNOVA", value: BSC_TOKEN_FULL },
            { label: "ARB/ETH wCNOVA", value: "0x1452280dDa6Fa4C815f95B06cc15d429aEb0d917" },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{label}</span>
              <button onClick={() => copyToClipboard(value)}
                className="font-mono text-sm text-primary/80 hover:text-primary transition-colors flex items-center gap-1" data-testid={`button-copy-${label.toLowerCase().replace(/[^a-z]/g, '-')}`}>
                {value.slice(0, 8)}...{value.slice(-4)} <Copy className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
