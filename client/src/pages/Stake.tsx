import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChainNova, useStakeInfo } from "@/hooks/useChainNova";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Coins, TrendingUp, Lock, Unlock, Wallet, RotateCcw,
  Info, Shield, Zap, Clock
} from "lucide-react";

const STAKE_PRESETS = [100, 500, 1000, 5000];

export default function Stake() {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toBase58();
  const { data: stakeInfo, isLoading } = useStakeInfo(address);
  const { stakeTokens, unstakeTokens, isLoading: txLoading } = useChainNova();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [stakeAmount, setStakeAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");

  const STATS_INFO = [
    { labelKey: "totalStaked" as const, value: "42.8M", sub: t.stake.variable, icon: Coins, color: "text-primary" },
    { labelKey: "currentAPY" as const, value: "24.5%", sub: t.stake.variable, icon: TrendingUp, color: "text-green-400" },
    { labelKey: "stakers" as const, value: "8,241", sub: t.stake.active, icon: Shield, color: "text-blue-400" },
    { labelKey: "lockPeriod" as const, value: `7 ${t.stake.days}`, sub: t.stake.minimum, icon: Clock, color: "text-yellow-400" },
  ];

  const dailyReward = stakeInfo
    ? ((stakeInfo.staked * stakeInfo.apy) / 100 / 365).toFixed(2)
    : "0";
  const estimatedReward = stakeAmount
    ? ((parseFloat(stakeAmount) * 24.5) / 100 / 365).toFixed(2)
    : "0";

  const getTxErrorMessage = (error: any): string => {
    const msg = error?.message || "";
    if (msg.includes("insufficient") || msg.includes("balance")) return t.stake.errInsufficientBalance || "Insufficient SOL or $CNOVA balance";
    if (msg.includes("User rejected") || error?.code === 4001) return t.stake.errUserRejected || "You rejected the wallet signature";
    if (msg.includes("timeout") || msg.includes("block height")) return t.stake.errTimeout || "Transaction timed out, network congested";
    if (msg.includes("0x1")) return t.stake.errContractFailed || "Contract execution failed";
    return t.stake.txFailed;
  };

  const handleStake = async () => {
    if (!connected) { setVisible(true); return; }
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast({ title: t.stake.invalidAmount, description: t.stake.invalidAmountDesc, variant: "destructive" });
      return;
    }
    try {
      await stakeTokens(parseFloat(stakeAmount));
      toast({ title: t.stake.stakingInitiated, description: `${t.stake.stakingDesc.replace("$CNOVA", `${stakeAmount} $CNOVA`)}` });
      setStakeAmount("");
    } catch (error: any) {
      toast({ title: t.stake.error, description: getTxErrorMessage(error), variant: "destructive" });
    }
  };

  const handleUnstake = async () => {
    if (!connected) { setVisible(true); return; }
    try {
      await unstakeTokens();
      toast({ title: t.stake.unstakingInitiated, description: t.stake.unstakingDesc });
    } catch (error: any) {
      toast({ title: t.stake.error, description: getTxErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-full px-6 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="font-orbitron text-2xl font-black uppercase tracking-wider text-foreground neon-glow-text mb-1">
            {t.stake.title}
          </h1>
          <p className="font-orbitron text-[9px] text-muted-foreground/60 tracking-widest uppercase">
            {t.stake.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {STATS_INFO.map((stat, i) => (
            <motion.div
              key={stat.labelKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="glass-card rounded-md border border-primary/15 p-4"
            >
              <stat.icon className={`w-4 h-4 ${stat.color} mb-2`} />
              <div className={`font-orbitron text-lg font-black ${stat.color}`}>{stat.value}</div>
              <div className="font-orbitron text-[8px] text-muted-foreground/50 uppercase tracking-wider">{stat.sub}</div>
              <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-widest mt-1">{t.stake[stat.labelKey]}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="glass-card rounded-md border border-primary/20 overflow-hidden">
            <div className="border-b border-primary/15 p-1 flex">
              {(["stake", "unstake"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  data-testid={`tab-${tab}`}
                  className={`flex-1 py-2.5 font-orbitron text-[10px] tracking-wider uppercase rounded transition-all ${
                    activeTab === tab
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground/60"
                  }`}
                >
                  {tab === "stake"
                    ? <><Lock className="w-3 h-3 inline mr-1" />{t.stake.stakeTab}</>
                    : <><Unlock className="w-3 h-3 inline mr-1" />{t.stake.unstakeTab}</>}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === "stake" ? (
                <div className="space-y-4">
                  <div>
                    <label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 block mb-2">
                      {t.stake.amountLabel}
                    </label>
                    <Input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      placeholder="0"
                      className="cyber-input font-orbitron text-lg tracking-wider text-center"
                      data-testid="input-stake-amount"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {STAKE_PRESETS.map((p) => (
                        <button
                          key={p}
                          onClick={() => setStakeAmount(String(p))}
                          data-testid={`button-preset-${p}`}
                          className="px-2.5 py-1 border border-border/50 rounded font-orbitron text-[9px] tracking-wider text-muted-foreground/70 transition-all"
                        >
                          {p.toLocaleString()}
                        </button>
                      ))}
                      <button
                        onClick={() => setStakeAmount("12500")}
                        data-testid="button-preset-max"
                        className="px-2.5 py-1 border border-primary/30 rounded font-orbitron text-[9px] tracking-wider text-primary transition-all"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {stakeAmount && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-3 rounded-md bg-green-400/5 border border-green-400/20 space-y-2"
                    >
                      <div className="flex justify-between">
                        <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.stake.estDailyReward}</span>
                        <span className="font-orbitron text-xs text-green-400 font-bold">{estimatedReward} $CNOVA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.stake.apy}</span>
                        <span className="font-orbitron text-xs text-green-400 font-bold">24.5%</span>
                      </div>
                    </motion.div>
                  )}

                  <Button
                    className="w-full font-orbitron text-[10px] tracking-wider uppercase gap-2"
                    onClick={handleStake}
                    disabled={txLoading || !stakeAmount}
                    data-testid="button-stake"
                    style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
                  >
                    {txLoading ? (
                      <><RotateCcw className="w-3 h-3 animate-spin" />{t.stake.processing}</>
                    ) : !connected ? (
                      <><Wallet className="w-3 h-3" />{t.stake.connectToStake}</>
                    ) : (
                      <><Coins className="w-3 h-3" />{t.stake.stakeButton}</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-md bg-primary/5 border border-primary/15 space-y-3">
                    <div className="flex justify-between">
                      <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.stake.currentlyStaked}</span>
                      <span className="font-orbitron text-sm font-bold text-foreground">
                        {isLoading ? "..." : `${(stakeInfo?.staked ?? 0).toLocaleString()} $CNOVA`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.stake.pendingRewards}</span>
                      <span className="font-orbitron text-sm font-bold text-green-400">
                        {isLoading ? "..." : `${stakeInfo?.rewards ?? 0} $CNOVA`}
                      </span>
                    </div>
                    <div className="h-px bg-border/30" />
                    <div className="flex justify-between">
                      <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.stake.totalReturn}</span>
                      <span className="font-orbitron text-sm font-bold text-primary">
                        {isLoading ? "..." : `${((stakeInfo?.staked ?? 0) + (stakeInfo?.rewards ?? 0)).toLocaleString()} $CNOVA`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/5 border border-yellow-500/20">
                    <Info className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="font-orbitron text-[9px] text-yellow-400/80 leading-relaxed tracking-wide">
                      {t.stake.unstakeWarning}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full font-orbitron text-[10px] tracking-wider uppercase gap-2 border-primary/30"
                    onClick={handleUnstake}
                    disabled={txLoading || !connected || !stakeInfo?.staked}
                    data-testid="button-unstake"
                  >
                    {txLoading ? (
                      <><RotateCcw className="w-3 h-3 animate-spin" />{t.stake.processing}</>
                    ) : (
                      <><Unlock className="w-3 h-3" />{t.stake.unstakeAll}</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {connected && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card rounded-md border border-primary/20 p-5"
              >
                <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest mb-4">
                  {t.stake.yourPosition}
                </div>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 bg-card/50" />)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{t.stake.currentlyStaked}</span>
                        <span className="font-orbitron text-xs font-bold text-foreground">
                          {(stakeInfo?.staked ?? 0).toLocaleString()} $CNOVA
                        </span>
                      </div>
                      <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all"
                          style={{ width: `${Math.min(((stakeInfo?.staked ?? 0) / 20000) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 rounded-md bg-primary/5 border border-primary/15">
                        <div className="font-orbitron text-lg font-black text-green-400">{stakeInfo?.rewards ?? 0}</div>
                        <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-wider">{t.stake.cnovaEarned}</div>
                      </div>
                      <div className="p-3 rounded-md bg-primary/5 border border-primary/15">
                        <div className="font-orbitron text-lg font-black text-primary">{dailyReward}</div>
                        <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-wider">{t.stake.dailyReward}</div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <div className="glass-card rounded-md border border-primary/15 p-5">
              <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest mb-4">
                {t.stake.rewardTiers}
              </div>
              <div className="space-y-3">
                {[
                  { tier: "Bronze", min: 100, apy: "18%", color: "text-amber-600" },
                  { tier: "Silver", min: 1000, apy: "21%", color: "text-slate-300" },
                  { tier: "Gold", min: 5000, apy: "24.5%", color: "text-yellow-400" },
                  { tier: "Diamond", min: 25000, apy: "30%", color: "text-cyan-300" },
                ].map((tier) => (
                  <div key={tier.tier} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                    <div className="flex items-center gap-2">
                      <Zap className={`w-3 h-3 ${tier.color}`} />
                      <span className={`font-orbitron text-[10px] font-bold ${tier.color}`}>{tier.tier}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-orbitron text-[10px] text-foreground">{tier.apy} APY</div>
                      <div className="font-orbitron text-[8px] text-muted-foreground/50">{tier.min.toLocaleString()}+ $CNOVA</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
