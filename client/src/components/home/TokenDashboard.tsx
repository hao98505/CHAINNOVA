import { motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
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
  TrendingUp, Send, FileText, ChevronRight, Coins,
  BadgeCheck, CircleDollarSign, Layers, AlertTriangle, RefreshCw,
} from "lucide-react";

const ICON_MAP = {
  Users,
  Droplets,
  Link,
  Megaphone,
} as const;

const FLOW_ICON_MAP = [CircleDollarSign, ArrowRight, Layers, Gift] as const;
const FLOW_COLORS = ["#A78BFA", "#6B46C1", "#34D399", "#FBBF24"] as const;

function Placeholder() {
  return <span className="text-muted-foreground/50 font-mono">--</span>;
}

function SkeletonValue({ isLoading, value, width = "w-20" }: { isLoading: boolean; value: React.ReactNode; width?: string }) {
  if (isLoading) return <Skeleton className={`h-5 ${width} bg-primary/10`} />;
  return <>{value ?? <Placeholder />}</>;
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-2 p-3 rounded border border-red-500/20 bg-red-500/5 text-red-400 text-xs" data-testid="banner-error">
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] ml-auto" onClick={onRetry} data-testid="button-retry">
          <RefreshCw className="w-3 h-3 mr-1" /> {t.tokenDashboard.retry}
        </Button>
      )}
    </div>
  );
}

function CopyableAddress({ address, short = true, context = "default" }: { address: string; short?: boolean; context?: string }) {
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
      data-testid={`button-copy-address-${context}`}
    >
      <span>{display}</span>
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 opacity-50 group-hover:opacity-100" />}
    </button>
  );
}

function StatusBadge({ active, label, id }: { active: boolean; label: string; id: string }) {
  const { t } = useLanguage();
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
        active
          ? "border-red-500/40 bg-red-500/10 text-red-400"
          : "border-green-500/40 bg-green-500/10 text-green-400"
      }`}
      data-testid={`status-${id}`}
    >
      {active ? <ShieldX className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5" />}
      {label}: {active ? t.tokenDashboard.yes : t.tokenDashboard.no}
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
  const { t } = useLanguage();
  const { data, isLoading, isError, error, refetch } = useTokenOverview();

  const td = t.tokenDashboard;
  const metrics = [
    { label: td.currentPrice, key: "current-price", value: data?.currentPrice != null ? `$${data.currentPrice.toFixed(6)}` : null, icon: CircleDollarSign },
    { label: td.marketCap, key: "market-cap", value: data?.marketCap != null ? `$${(data.marketCap / 1e6).toFixed(2)}M` : null, icon: TrendingUp },
    { label: td.liquidity, key: "liquidity", value: data?.liquidity != null ? `$${(data.liquidity / 1e3).toFixed(1)}K` : null, icon: Droplets },
    { label: td.holders, key: "holders", value: data?.holders != null ? data.holders.toLocaleString() : null, icon: Users },
    { label: td.volume24h, key: "24h-volume", value: data?.volume24h != null ? `$${(data.volume24h / 1e3).toFixed(1)}K` : null, icon: Layers },
    { label: td.buyTax, key: "buy-tax", value: `${TOKEN_CONFIG.buyTaxPercent}%`, icon: ArrowRight },
    { label: td.sellTax, key: "sell-tax", value: `${TOKEN_CONFIG.sellTaxPercent}%`, icon: ArrowRight },
  ];

  return (
    <GlowCard delay={0.1}>
      <div className="p-5">
        <SectionTitle icon={Coins}>{td.tokenOverview}</SectionTitle>

        {isError && <ErrorBanner message={td.loadError} onRetry={() => refetch()} />}

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
            <CopyableAddress address={TOKEN_CONFIG.contractAddress} context="token-contract" />
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
            <div key={m.key} className="text-center p-2 rounded bg-background/30 border border-primary/[0.07]">
              <m.icon className="w-3 h-3 text-primary/60 mx-auto mb-1" />
              <div className="font-orbitron text-sm font-bold text-foreground" data-testid={`text-${m.key}`}>
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
  const { t } = useLanguage();
  const { data: vaults, isLoading, isError, refetch } = useVaults();
  const td = t.tokenDashboard;

  return (
    <div>
      <SectionTitle icon={Shield}>{td.vaultAllocation}</SectionTitle>
      {isError && <ErrorBanner message={td.loadError} onRetry={() => refetch()} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {VAULT_CONFIG.map((vc, i) => {
          const vault = vaults?.find((v) => v.id === vc.id);
          const Icon = ICON_MAP[vc.icon];
          const vaultLabel = td[vc.labelKey as keyof typeof td] as string;
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
                      {vaultLabel}
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground/60">{vc.allocationPercent}%</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { label: td.balance, value: vault?.currentBalance },
                    { label: td.totalIn, value: vault?.totalInflow },
                    { label: td.totalOut, value: vault?.totalOutflow },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">{row.label}</span>
                      <span className="font-mono text-xs text-foreground">
                        <SkeletonValue isLoading={isLoading} value={row.value != null ? row.value.toLocaleString() : null} width="w-14" />
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">{td.updated}</span>
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
  const { t } = useLanguage();
  const { connected } = useWallet();
  const { data, isLoading, isError, refetch } = useMyTokenDashboard();
  const { toast } = useToast();
  const td = t.tokenDashboard;

  const handleClaim = useCallback((type: string) => {
    toast({ title: td.claimInitiated, description: `${type} ${td.claimPending}` });
  }, [toast, td]);

  if (!connected) {
    return (
      <GlowCard delay={0.3}>
        <div className="p-6 text-center">
          <Wallet className="w-8 h-8 text-primary/40 mx-auto mb-3" />
          <div className="text-sm text-muted-foreground" data-testid="text-connect-dashboard">{td.connectWalletDashboard}</div>
        </div>
      </GlowCard>
    );
  }

  const rows = [
    { label: td.myBalance, key: "my-balance", value: data?.balance, suffix: ` ${TOKEN_CONFIG.symbol}` },
    { label: td.eligible, key: "eligible", value: data?.eligible != null ? (data.eligible ? `${td.yes} ✓` : `${td.no} (${TOKEN_CONFIG.holdingThreshold.toLocaleString()})`) : null },
    { label: td.holdingWeight, key: "holding-weight", value: data?.holdingWeight != null ? `${data.holdingWeight.toFixed(2)}%` : null },
    { label: td.timeMultiplier, key: "time-multiplier", value: data?.timeMultiplier != null ? `${data.timeMultiplier}x` : null },
  ];

  const rewards = [
    { label: td.pendingBnb, key: "pending-bnb", value: data?.pendingBnbRewards, unit: "BNB", type: "BNB" },
    { label: td.pendingLp, key: "pending-lp", value: data?.pendingLpRewards, unit: "LP", type: "LP" },
    { label: td.referralComm, key: "referral-comm", value: data?.pendingReferralCommission, unit: TOKEN_CONFIG.symbol, type: "Referral" },
  ];

  return (
    <GlowCard delay={0.3}>
      <div className="p-5">
        <SectionTitle icon={Wallet}>{td.myDashboard}</SectionTitle>
        {isError && <ErrorBanner message={td.loadError} onRetry={() => refetch()} />}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {rows.map((r) => (
            <div key={r.key} className="p-2 rounded bg-background/30 border border-primary/[0.07]">
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-1">{r.label}</div>
              <div className="font-mono text-sm text-foreground" data-testid={`text-${r.key}`}>
                <SkeletonValue isLoading={isLoading} value={r.value != null ? `${r.value}${r.suffix || ""}` : null} />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {rewards.map((r) => (
            <div key={r.key} className="flex items-center justify-between p-3 rounded bg-background/30 border border-primary/[0.07]">
              <div>
                <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider">{r.label}</div>
                <div className="font-mono text-sm font-bold text-foreground" data-testid={`text-${r.key}`}>
                  <SkeletonValue isLoading={isLoading} value={r.value != null ? `${r.value} ${r.unit}` : null} />
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-[10px] uppercase tracking-wider border-primary/30 hover:border-primary/60 h-7 px-2"
                onClick={() => handleClaim(r.type)}
                data-testid={`button-claim-${r.key}`}
              >
                <Gift className="w-3 h-3 mr-1" /> {td.claim}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </GlowCard>
  );
}

function MechanismFlowSection() {
  const { t } = useLanguage();
  const td = t.tokenDashboard;

  const steps = MECHANISM_FLOW_STEPS.map((step, i) => ({
    ...step,
    icon: FLOW_ICON_MAP[i],
    color: FLOW_COLORS[i],
    label: td[step.labelKey as keyof typeof td] as string,
  }));

  const destinations = [
    { label: td.holderDividends, pct: "40%", color: "#A78BFA" },
    { label: td.lpRewards, pct: "30%", color: "#34D399" },
    { label: td.referral, pct: "15%", color: "#60A5FA" },
    { label: td.marketing, pct: "15%", color: "#FBBF24" },
  ];

  return (
    <GlowCard delay={0.35}>
      <div className="p-5">
        <SectionTitle icon={Send}>{td.mechanismFlow}</SectionTitle>
        <div className="flex flex-col sm:flex-row items-center gap-2 mb-5">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
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
  const { t } = useLanguage();
  const { connected } = useWallet();
  const { data, isLoading, isError, refetch } = useReferralData();
  const { toast } = useToast();
  const td = t.tokenDashboard;

  const handleSubmitReview = useCallback(() => {
    toast({ title: td.reviewSubmitted, description: td.reviewPending });
  }, [toast, td]);

  if (!connected) {
    return (
      <GlowCard delay={0.4}>
        <div className="p-6 text-center">
          <Link className="w-8 h-8 text-primary/40 mx-auto mb-3" />
          <div className="text-sm text-muted-foreground" data-testid="text-connect-referral">{td.connectWalletReferral}</div>
        </div>
      </GlowCard>
    );
  }

  const stats = [
    { label: td.inviteCode, key: "invite-code", value: data?.inviteCode },
    { label: td.directReferrals, key: "direct-referrals", value: data?.directReferrals },
    { label: td.qualifiedVolume, key: "qualified-volume", value: data?.qualifiedVolume },
    { label: td.pendingReview, key: "pending-review", value: data?.pendingReview },
    { label: td.claimable, key: "claimable", value: data?.claimableCommission },
  ];

  return (
    <GlowCard delay={0.4}>
      <div className="p-5">
        <SectionTitle icon={Users}>{td.referralProgram}</SectionTitle>
        {isError && <ErrorBanner message={td.loadError} onRetry={() => refetch()} />}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          {stats.map((s) => (
            <div key={s.key} className="p-2 rounded bg-background/30 border border-primary/[0.07]">
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-1">{s.label}</div>
              <div className="font-mono text-sm text-foreground" data-testid={`text-referral-${s.key}`}>
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
            <FileText className="w-3 h-3 mr-1" /> {td.submitReview}
          </Button>
        </div>
        <div className="mt-3 pt-3 border-t border-primary/10">
          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{td.referralHistory}</div>
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
            <div className="text-xs text-muted-foreground/40 mt-1">{td.noHistory}</div>
          )}
        </div>
      </div>
    </GlowCard>
  );
}

function TransparencySection() {
  const { t } = useLanguage();
  const cfg = TRANSPARENCY_CONFIG;
  const td = t.tokenDashboard;

  return (
    <GlowCard delay={0.45}>
      <div className="p-5">
        <SectionTitle icon={ShieldCheck}>{td.transparency}</SectionTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">{td.tokenContract}</div>
              <CopyableAddress address={cfg.tokenContract} short={false} context="transparency-contract" />
            </div>
            <div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">{td.marketingMultisig}</div>
              <CopyableAddress address={cfg.marketingMultisig} context="marketing-multisig" />
            </div>
            <div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">{td.reimbursementVault}</div>
              <CopyableAddress address={cfg.reimbursementVault} context="reimbursement-vault" />
            </div>
            <div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">{td.githubSource}</div>
              <a
                href={cfg.githubSource}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary/80 hover:text-primary transition-colors inline-flex items-center gap-1"
                data-testid="link-github"
              >
                <ExternalLink className="w-3 h-3" /> {td.viewRepository}
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-1">{td.vaultAddresses}</div>
              <div className="space-y-1">
                {cfg.vaultAddresses.map((v) => {
                  const vaultLabel = td[v.label as keyof typeof td] as string;
                  return (
                    <div key={v.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/60 capitalize w-20 truncate">
                        {vaultLabel}
                      </span>
                      <CopyableAddress address={v.address} context={`vault-${v.label}`} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-wider mb-1">{td.auditStatus}</div>
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
              <StatusBadge active={cfg.mintable} label={td.mintable} id="mintable" />
              <StatusBadge active={cfg.taxMutable} label={td.taxMutable} id="tax-mutable" />
              <StatusBadge active={cfg.adminWithdrawal} label={td.adminWithdrawal} id="admin-withdrawal" />
            </div>
          </div>
        </div>
      </div>
    </GlowCard>
  );
}

export function TokenDashboard() {
  const { t } = useLanguage();
  const td = t.tokenDashboard;

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
              {td.sectionBadge}
            </span>
          </div>
          <h2 className="font-orbitron text-xl md:text-2xl font-black uppercase tracking-wider text-foreground neon-glow-text">
            {TOKEN_CONFIG.name} {td.analyticsTitle}
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
