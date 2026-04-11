import { motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  useTokenOverview,
  useVaults,
  useMyTokenDashboard,
  useReferralData,
} from "@/hooks/useTokenDashboard";
import {
  TOKEN_CONFIG,
  VAULT_CONFIG,
  TRANSPARENCY_CONFIG,
  MECHANISM_FLOW_STEPS,
} from "@/config/tokenDashboard";
import {
  Copy, Check, ExternalLink, Users, Droplets, Link, Megaphone,
  ArrowRight, Shield, ShieldCheck, ShieldX, Wallet, Gift,
  TrendingUp, Clock, Send, FileText, ChevronRight, Coins,
  BadgeCheck, CircleDollarSign, Layers,
} from "lucide-react";

const ICON_MAP = {
  Users,
  Droplets,
  Link,
  Megaphone,
} as const;

function Placeholder({ width = "w-16" }: { width?: string }) {
  return <span className="text-muted-foreground/50 font-mono">--</span>;
}

function SkeletonValue({ isLoading, value, width = "w-20" }: { isLoading: boolean; value: React.ReactNode; width?: string }) {
  if (isLoading) return <Skeleton className={`h-5 ${width} bg-primary/10`} />;
  return <>{value ?? <Placeholder />}</>;
}

function CopyableAddress({ address, short = true }: { address: string; short?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  const display = short ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-primary/90 hover:text-primary transition-colors group"
      data-testid="button-copy-address"
    >
      <span>{display}</span>
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 opacity-50 group-hover:opacity-100" />}
    </button>
  );
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
        active
          ? "border-red-500/40 bg-red-500/10 text-red-400"
          : "border-green-500/40 bg-green-500/10 text-green-400"
      }`}
      data-testid={`status-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      {active ? <ShieldX className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5" />}
      {label}: {active ? "Yes" : "No"}
    </span>
  );
}

function GlowCard({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={`relative rounded-lg border border-primary/20 overflow-hidden ${className}`}
      style={{
        background: "rgba(15, 10, 35, 0.65)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 1px rgba(167, 139, 250, 0.3), 0 0 15px rgba(107, 70, 193, 0.08), inset 0 1px 0 rgba(167, 139, 250, 0.06)",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon className="w-4 h-4 text-primary" />}
      <h3 className="font-orbitron text-sm font-bold uppercase tracking-wider text-foreground">
        {children}
      </h3>
      <div className="flex-1 h-px bg-gradient-to-r from-primary/30 to-transparent" />
    </div>
  );
}

function OverviewSection() {
  const { data, isLoading } = useTokenOverview();

  const metrics = [
    { label: "Current Price", value: data?.currentPrice != null ? `$${data.currentPrice.toFixed(6)}` : null, icon: CircleDollarSign },
    { label: "Market Cap", value: data?.marketCap != null ? `$${(data.marketCap / 1e6).toFixed(2)}M` : null, icon: TrendingUp },
    { label: "Liquidity", value: data?.liquidity != null ? `$${(data.liquidity / 1e3).toFixed(1)}K` : null, icon: Droplets },
    { label: "Holders", value: data?.holders != null ? data.holders.toLocaleString() : null, icon: Users },
    { label: "24h Volume", value: data?.volume24h != null ? `$${(data.volume24h / 1e3).toFixed(1)}K` : null, icon: Layers },
    { label: "Buy Tax", value: `${TOKEN_CONFIG.buyTaxPercent}%`, icon: ArrowRight },
    { label: "Sell Tax", value: `${TOKEN_CONFIG.sellTaxPercent}%`, icon: ArrowRight },
  ];

  return (
    <GlowCard delay={0.1}>
      <div className="p-5">
        <SectionTitle icon={Coins}>Token Overview</SectionTitle>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="font-orbitron text-xs font-bold text-primary">F</span>
            </div>
            <div>
              <div className="font-orbitron text-base font-bold text-foreground" data-testid="text-token-name">
                {TOKEN_CONFIG.name}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider" data-testid="text-token-symbol">
                ${TOKEN_CONFIG.symbol}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CopyableAddress address={TOKEN_CONFIG.contractAddress} />
            <a
              href={TOKEN_CONFIG.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground/50 hover:text-primary transition-colors"
              data-testid="link-explorer"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="text-center p-2 rounded bg-background/30 border border-primary/[0.07]">
              <m.icon className="w-3 h-3 text-primary/60 mx-auto mb-1" />
              <div className="font-orbitron text-sm font-bold text-foreground" data-testid={`text-${m.label.toLowerCase().replace(/\s/g, "-")}`}>
                <SkeletonValue isLoading={isLoading} value={m.value} />
              </div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </GlowCard>
  );
}

function VaultsSection() {
  const { data: vaults, isLoading } = useVaults();

  return (
    <div>
      <SectionTitle icon={Shield}>Vault Allocation</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {VAULT_CONFIG.map((vc, i) => {
          const vault = vaults?.find((v) => v.id === vc.id);
          const Icon = ICON_MAP[vc.icon];
          return (
            <GlowCard key={vc.id} delay={0.15 + i * 0.05}>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ background: `${vc.color}15`, border: `1px solid ${vc.color}30` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: vc.color }} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground capitalize" data-testid={`text-vault-${vc.id}`}>
                      {vc.labelKey.replace(/([A-Z])/g, " $1").trim()}
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground/60">{vc.allocationPercent}%</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { label: "Balance", value: vault?.currentBalance },
                    { label: "Total In", value: vault?.totalInflow },
                    { label: "Total Out", value: vault?.totalOutflow },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">{row.label}</span>
                      <span className="font-mono text-xs text-foreground">
                        <SkeletonValue isLoading={isLoading} value={row.value != null ? row.value.toLocaleString() : null} width="w-14" />
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Updated</span>
                    <span className="font-mono text-[10px] text-muted-foreground/50">
                      <SkeletonValue isLoading={isLoading} value={vault?.lastUpdateTime} width="w-14" />
                    </span>
                  </div>
                </div>

                <div className="mt-3 h-1 rounded-full bg-background/50 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${vc.allocationPercent}%`, background: vc.color }}
                  />
                </div>
              </div>
            </GlowCard>
          );
        })}
      </div>
    </div>
  );
}

function MyDashboardSection() {
  const { connected } = useWallet();
  const { data, isLoading } = useMyTokenDashboard();
  const { toast } = useToast();

  const handleClaim = useCallback((type: string) => {
    toast({ title: "Claim Initiated", description: `${type} claim submitted — pending implementation.` });
  }, [toast]);

  if (!connected) {
    return (
      <GlowCard delay={0.3}>
        <div className="p-6 text-center">
          <Wallet className="w-8 h-8 text-primary/40 mx-auto mb-3" />
          <div className="text-sm text-muted-foreground">Connect wallet to view your dashboard</div>
        </div>
      </GlowCard>
    );
  }

  const rows = [
    { label: "My Balance", value: data?.balance, suffix: ` ${TOKEN_CONFIG.symbol}` },
    { label: "Eligible", value: data?.eligible != null ? (data.eligible ? "Yes ✓" : `No (need ${TOKEN_CONFIG.holdingThreshold.toLocaleString()})`) : null },
    { label: "Holding Weight", value: data?.holdingWeight != null ? `${data.holdingWeight.toFixed(2)}%` : null },
    { label: "Time Multiplier", value: data?.timeMultiplier != null ? `${data.timeMultiplier}x` : null },
  ];

  const rewards = [
    { label: "Pending BNB", value: data?.pendingBnbRewards, unit: "BNB", type: "BNB Rewards" },
    { label: "Pending LP", value: data?.pendingLpRewards, unit: "LP", type: "LP Rewards" },
    { label: "Referral Comm.", value: data?.pendingReferralCommission, unit: TOKEN_CONFIG.symbol, type: "Referral Commission" },
  ];

  return (
    <GlowCard delay={0.3}>
      <div className="p-5">
        <SectionTitle icon={Wallet}>My Dashboard</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {rows.map((r) => (
            <div key={r.label} className="p-2 rounded bg-background/30 border border-primary/[0.07]">
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-1">{r.label}</div>
              <div className="font-mono text-sm text-foreground" data-testid={`text-my-${r.label.toLowerCase().replace(/\s/g, "-")}`}>
                <SkeletonValue isLoading={isLoading} value={r.value != null ? `${r.value}${r.suffix || ""}` : null} />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {rewards.map((r) => (
            <div key={r.label} className="flex items-center justify-between p-3 rounded bg-background/30 border border-primary/[0.07]">
              <div>
                <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider">{r.label}</div>
                <div className="font-mono text-sm font-bold text-foreground" data-testid={`text-${r.label.toLowerCase().replace(/[\s.]/g, "-")}`}>
                  <SkeletonValue isLoading={isLoading} value={r.value != null ? `${r.value} ${r.unit}` : null} />
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-[10px] uppercase tracking-wider border-primary/30 hover:border-primary/60 h-7 px-2"
                onClick={() => handleClaim(r.type)}
                data-testid={`button-claim-${r.type.toLowerCase().replace(/\s/g, "-")}`}
              >
                <Gift className="w-3 h-3 mr-1" /> Claim
              </Button>
            </div>
          ))}
        </div>
      </div>
    </GlowCard>
  );
}

function MechanismFlowSection() {
  const steps = [
    { icon: CircleDollarSign, label: "Buy / Sell", color: "#A78BFA" },
    { icon: ArrowRight, label: "Tax (5%)", color: "#6B46C1" },
    { icon: Layers, label: "4 Vaults", color: "#34D399" },
    { icon: Gift, label: "Rewards", color: "#FBBF24" },
  ];

  const destinations = [
    { label: "Holder Dividends", pct: "40%", color: "#A78BFA" },
    { label: "LP Rewards", pct: "30%", color: "#34D399" },
    { label: "Referral", pct: "15%", color: "#60A5FA" },
    { label: "Marketing", pct: "15%", color: "#FBBF24" },
  ];

  return (
    <GlowCard delay={0.35}>
      <div className="p-5">
        <SectionTitle icon={Send}>Mechanism Flow</SectionTitle>
        <div className="flex flex-col sm:flex-row items-center gap-2 mb-5">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-primary/15 bg-background/40">
                <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                <span className="text-xs font-semibold text-foreground whitespace-nowrap">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 text-primary/30 hidden sm:block" />
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {destinations.map((d) => (
            <div key={d.label} className="text-center p-2 rounded border border-primary/[0.07] bg-background/20">
              <div className="font-orbitron text-lg font-bold" style={{ color: d.color }}>{d.pct}</div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider">{d.label}</div>
            </div>
          ))}
        </div>
      </div>
    </GlowCard>
  );
}

function ReferralSection() {
  const { connected } = useWallet();
  const { data, isLoading } = useReferralData();
  const { toast } = useToast();

  const handleSubmitReview = useCallback(() => {
    toast({ title: "Review Submitted", description: "Your referral review has been submitted — pending implementation." });
  }, [toast]);

  if (!connected) {
    return (
      <GlowCard delay={0.4}>
        <div className="p-6 text-center">
          <Link className="w-8 h-8 text-primary/40 mx-auto mb-3" />
          <div className="text-sm text-muted-foreground">Connect wallet to view referral program</div>
        </div>
      </GlowCard>
    );
  }

  const stats = [
    { label: "Invite Code", value: data?.inviteCode },
    { label: "Direct Referrals", value: data?.directReferrals },
    { label: "Qualified Volume", value: data?.qualifiedVolume },
    { label: "Pending Review", value: data?.pendingReview },
    { label: "Claimable", value: data?.claimableCommission },
  ];

  return (
    <GlowCard delay={0.4}>
      <div className="p-5">
        <SectionTitle icon={Users}>Referral Program</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          {stats.map((s) => (
            <div key={s.label} className="p-2 rounded bg-background/30 border border-primary/[0.07]">
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-1">{s.label}</div>
              <div className="font-mono text-sm text-foreground" data-testid={`text-referral-${s.label.toLowerCase().replace(/\s/g, "-")}`}>
                <SkeletonValue isLoading={isLoading} value={s.value} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-[10px] uppercase tracking-wider border-primary/30 hover:border-primary/60"
            onClick={handleSubmitReview}
            data-testid="button-submit-review"
          >
            <FileText className="w-3 h-3 mr-1" /> Submit Review
          </Button>
        </div>
        <div className="mt-3 pt-3 border-t border-primary/10">
          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Referral History</div>
          {data?.history && data.history.length > 0 ? (
            <div className="mt-2 space-y-1">
              {data.history.map((h, i) => (
                <div key={i} className="flex justify-between text-xs text-muted-foreground">
                  <span>{h.date}</span>
                  <span>{h.amount} {TOKEN_CONFIG.symbol}</span>
                  <span className="uppercase text-[10px]">{h.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground/40 mt-1">No history yet</div>
          )}
        </div>
      </div>
    </GlowCard>
  );
}

function TransparencySection() {
  const cfg = TRANSPARENCY_CONFIG;

  return (
    <GlowCard delay={0.45}>
      <div className="p-5">
        <SectionTitle icon={ShieldCheck}>Transparency</SectionTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Token Contract</div>
              <CopyableAddress address={cfg.tokenContract} short={false} />
            </div>
            <div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Marketing Multisig</div>
              <CopyableAddress address={cfg.marketingMultisig} />
            </div>
            <div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">Reimbursement Vault</div>
              <CopyableAddress address={cfg.reimbursementVault} />
            </div>
            <div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">GitHub Source</div>
              <a
                href={cfg.githubSource}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary/80 hover:text-primary transition-colors inline-flex items-center gap-1"
                data-testid="link-github"
              >
                <ExternalLink className="w-3 h-3" /> View Repository
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-1">Vault Addresses</div>
              <div className="space-y-1">
                {cfg.vaultAddresses.map((v) => (
                  <div key={v.label} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/60 capitalize w-20 truncate">
                      {v.label.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <CopyableAddress address={v.address} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-1">Audit Status</div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
                cfg.auditStatus === "completed"
                  ? "border-green-500/40 bg-green-500/10 text-green-400"
                  : cfg.auditStatus === "in-progress"
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                  : "border-muted-foreground/20 bg-muted/10 text-muted-foreground"
              }`} data-testid="status-audit">
                <BadgeCheck className="w-2.5 h-2.5" />
                {cfg.auditStatus}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mt-1">
              <StatusBadge active={cfg.mintable} label="Mintable" />
              <StatusBadge active={cfg.taxMutable} label="Tax Mutable" />
              <StatusBadge active={cfg.adminWithdrawal} label="Admin Withdrawal" />
            </div>
          </div>
        </div>
      </div>
    </GlowCard>
  );
}

export function TokenDashboard() {
  return (
    <section className="px-6 py-10" data-testid="section-token-dashboard">
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-2"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-primary/20 bg-primary/5 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary status-dot" />
            <span className="text-[10px] font-semibold text-primary tracking-widest uppercase">
              Token Dashboard
            </span>
          </div>
          <h2 className="font-orbitron text-xl md:text-2xl font-black uppercase tracking-wider text-foreground neon-glow-text">
            {TOKEN_CONFIG.name} Analytics
          </h2>
        </motion.div>

        <OverviewSection />
        <VaultsSection />
        <MyDashboardSection />
        <MechanismFlowSection />
        <ReferralSection />
        <TransparencySection />
      </div>
    </section>
  );
}
