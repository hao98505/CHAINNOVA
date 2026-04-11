import { motion } from "framer-motion";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useTokenOverview,
  useMyTokenDashboard,
  useReferralData,
  useOnChainTokenMeta,
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
  TrendingUp, Send, FileText, ChevronRight, ChevronDown, Coins,
  BadgeCheck, CircleDollarSign, Layers, AlertTriangle, RefreshCw,
  Globe, CheckCircle2, XCircle,
} from "lucide-react";
import { formatUsd, formatTokenCount } from "@/lib/tokenDashboard/formatters";
import { useEvmWallet } from "@/contexts/EvmWalletContext";

const ICON_MAP = {
  Users,
  Droplets,
  Link,
  Megaphone,
} as const;

const FLOW_ICON_MAP = [CircleDollarSign, ArrowRight, Layers, Gift] as const;
const FLOW_COLORS = ["#A78BFA", "#6B46C1", "#34D399", "#FBBF24"] as const;

function Placeholder() {
  return <span className="text-purple-300/60 font-mono text-lg">--</span>;
}

function NotDeployedBadge() {
  const { t } = useLanguage();
  return (
    <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-semibold border border-yellow-500/30 bg-yellow-500/5 text-yellow-400/70">
      <AlertTriangle className="w-3 h-3" />
      {t.tokenDashboard.notDeployed}
    </div>
  );
}

function SkeletonValue({ isLoading, value, width = "w-24" }: { isLoading: boolean; value: React.ReactNode; width?: string }) {
  if (isLoading) return <Skeleton className={`h-7 ${width} bg-primary/10`} />;
  return <>{value ?? <Placeholder />}</>;
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/5 text-red-300 text-sm mb-4" data-testid="banner-error">
      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button size="sm" variant="ghost" className="h-8 px-3 text-sm" onClick={onRetry} data-testid="button-retry">
          <RefreshCw className="w-4 h-4 mr-1.5" /> {t.tokenDashboard.retry}
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
      className="inline-flex items-center gap-2 font-mono text-sm text-purple-300 hover:text-purple-100 transition-colors group"
      data-testid={`button-copy-address-${context}`}
    >
      <span>{display}</span>
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 opacity-60 group-hover:opacity-100" />}
    </button>
  );
}

function StatusBadge({ active, label, id }: { active: boolean; label: string; id: string }) {
  const { t } = useLanguage();
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold border ${
        active
          ? "border-red-500/40 bg-red-500/10 text-red-300"
          : "border-green-500/40 bg-green-500/10 text-green-300"
      }`}
      data-testid={`status-${id}`}
    >
      {active ? <ShieldX className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
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
      className={`relative rounded-xl border border-purple-500/25 overflow-hidden ${className}`}
      style={{
        background: "rgba(15, 10, 35, 0.7)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 1px rgba(167, 139, 250, 0.4), 0 0 20px rgba(107, 70, 193, 0.1), inset 0 1px 0 rgba(167, 139, 250, 0.08)",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {Icon && <Icon className="w-6 h-6 text-primary" />}
      <h3 className="text-lg md:text-xl font-semibold text-purple-100 tracking-wide">
        {children}
      </h3>
      <div className="flex-1 h-px bg-gradient-to-r from-purple-500/30 to-transparent" />
    </div>
  );
}

function OverviewSection() {
  const { t } = useLanguage();
  const { data, isLoading, isError, refetch } = useTokenOverview();
  const { data: meta } = useOnChainTokenMeta();

  const tokenName = data?.name || meta?.name || TOKEN_CONFIG.name || TOKEN_CONFIG.contractAddress;
  const tokenSymbol = data?.symbol || meta?.symbol || TOKEN_CONFIG.symbol || "TOKEN";
  const tokenInitial = tokenName.charAt(0).toUpperCase() || "?";

  const td = t.tokenDashboard;
  const metrics = [
    { label: td.currentPrice, key: "current-price", value: data?.currentPrice != null ? formatUsd(data.currentPrice) : null, icon: CircleDollarSign },
    { label: td.marketCap, key: "market-cap", value: data?.marketCap != null ? formatUsd(data.marketCap) : null, icon: TrendingUp },
    { label: td.liquidity, key: "liquidity", value: data?.liquidity != null ? formatUsd(data.liquidity) : null, icon: Droplets },
    { label: td.holders, key: "holders", value: data?.holders != null ? data.holders.toLocaleString() : null, icon: Users },
    { label: td.volume24h, key: "24h-volume", value: data?.volume24h != null ? formatUsd(data.volume24h) : null, icon: Layers },
    { label: td.buyTax, key: "buy-tax", value: `${TOKEN_CONFIG.buyTaxPercent}%`, icon: ArrowRight },
    { label: td.sellTax, key: "sell-tax", value: `${TOKEN_CONFIG.sellTaxPercent}%`, icon: ArrowRight },
  ];

  return (
    <GlowCard delay={0.1}>
      <div className="p-6 md:p-8">
        <SectionTitle icon={Coins}>{td.tokenOverview}</SectionTitle>

        {isError && <ErrorBanner message={td.loadError} onRetry={() => refetch()} />}

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center">
              <span className="font-orbitron text-lg font-bold text-primary">{tokenInitial}</span>
            </div>
            <div>
              <div className="text-xl font-bold text-purple-50" data-testid="text-token-name">
                {tokenName}
              </div>
              <div className="text-sm text-purple-300 tracking-wide" data-testid="text-token-symbol">
                ${tokenSymbol}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CopyableAddress address={TOKEN_CONFIG.contractAddress} context="token-contract" />
            <a
              href={TOKEN_CONFIG.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-200 transition-colors"
              data-testid="link-explorer"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
            {TOKEN_CONFIG.buyUrl && (
              <a
                href={TOKEN_CONFIG.buyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold border border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20 transition-colors"
                data-testid="link-buy"
              >
                <TrendingUp className="w-4 h-4" /> {td.buyNow || "Buy"}
              </a>
            )}
            {TOKEN_CONFIG.chartUrl && (
              <a
                href={TOKEN_CONFIG.chartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-colors"
                data-testid="link-chart"
              >
                <Layers className="w-4 h-4" /> {td.viewChart || "Chart"}
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {metrics.map((m) => (
            <div key={m.key} className="text-center p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
              <m.icon className="w-5 h-5 text-purple-400 mx-auto mb-2" />
              <div className="text-xl md:text-2xl font-bold text-purple-50 leading-tight" data-testid={`text-${m.key}`}>
                <SkeletonValue isLoading={isLoading} value={m.value} />
              </div>
              <div className="text-sm text-purple-300/80 mt-1.5">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </GlowCard>
  );
}

function VaultsSection() {
  const { t } = useLanguage();
  const td = t.tokenDashboard;
  const hasAnyVault = VAULT_CONFIG.some((vc) => vc.address && vc.address.length > 2);

  return (
    <div>
      <SectionTitle icon={Shield}>{td.vaultAllocation}</SectionTitle>

      <div className="flex items-center gap-3 p-4 rounded-lg border border-purple-500/20 bg-purple-950/30 mb-4">
        <Coins className="w-5 h-5 text-purple-400 flex-shrink-0" />
        <div className="text-sm text-purple-300/80">
          {td.currentTaxMechanism}: <span className="font-semibold text-purple-200">{TOKEN_CONFIG.tradingPlatform}</span>
          <span className="mx-2">|</span>
          {td.buyTax}: <span className="font-semibold text-green-300">{TOKEN_CONFIG.buyTaxPercent}%</span>
          <span className="mx-2">|</span>
          {td.sellTax}: <span className="font-semibold text-red-300">{TOKEN_CONFIG.sellTaxPercent}%</span>
        </div>
      </div>

      {!hasAnyVault && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 mb-4">
          <AlertTriangle className="w-5 h-5 text-yellow-400/70 flex-shrink-0" />
          <span className="text-sm text-yellow-300/80">{td.vaultsNotDeployed}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {VAULT_CONFIG.map((vc, i) => {
          const Icon = ICON_MAP[vc.icon];
          const vaultLabel = td[vc.labelKey as keyof typeof td] as string;
          const deployed = vc.address && vc.address.length > 2;
          return (
            <GlowCard key={vc.id} delay={0.15 + i * 0.05}>
              <div className="p-5 md:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: `${vc.color}18`, border: `1.5px solid ${vc.color}40` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: vc.color }} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-purple-100" data-testid={`text-vault-${vc.id}`}>
                      {vaultLabel}
                    </div>
                    <div className="text-2xl font-bold" style={{ color: vc.color }}>{vc.allocationPercent}%</div>
                  </div>
                </div>

                {deployed ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-purple-300/80">{td.balance}</span>
                      <span className="font-mono text-sm text-purple-100"><Placeholder /></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-purple-300/80">{td.totalIn}</span>
                      <span className="font-mono text-sm text-purple-100"><Placeholder /></span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-purple-300/80">{td.totalOut}</span>
                      <span className="font-mono text-sm text-purple-100"><Placeholder /></span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <NotDeployedBadge />
                    <div className="text-xs text-purple-400/50 mt-2">{td.pendingDeployment}</div>
                  </div>
                )}

                <div className="mt-4 h-2 rounded-full bg-purple-950/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${vc.allocationPercent}%`, background: deployed ? vc.color : `${vc.color}40` }}
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
  const evm = useEvmWallet();
  const { data, isLoading, isError, refetch } = useMyTokenDashboard();
  const { data: meta } = useOnChainTokenMeta();
  const { toast } = useToast();
  const td = t.tokenDashboard;
  const tokenSymbol = meta?.symbol || TOKEN_CONFIG.symbol || "TOKEN";

  const handleClaim = useCallback((type: string) => {
    toast({ title: td.claimInitiated, description: `${type} ${td.claimPending}` });
  }, [toast, td]);

  if (!evm.address) {
    return (
      <GlowCard delay={0.3}>
        <div className="p-8 md:p-10 text-center">
          <Wallet className="w-12 h-12 text-yellow-400/50 mx-auto mb-4" />
          <div className="text-base text-purple-300 mb-2" data-testid="text-connect-dashboard">{td.connectEvmDashboard}</div>
          <div className="text-sm text-purple-400/60 mb-4">{td.connectEvmHint}</div>
          <Button
            onClick={evm.connect}
            disabled={evm.isConnecting}
            data-testid="button-connect-evm-dashboard"
            className="text-sm font-semibold tracking-wide uppercase"
            style={{
              background: "linear-gradient(135deg, #F0B90B, #D4A00A)",
              border: "1px solid rgba(240,185,11,0.5)",
              color: "#1a1a2e",
            }}
          >
            <Wallet className="w-4 h-4 mr-2" />
            {evm.isConnecting ? "..." : td.connectEvmDashboard.split(" ").slice(0, 2).join(" ")}
          </Button>
        </div>
      </GlowCard>
    );
  }

  return (
    <GlowCard delay={0.3}>
      <div className="p-6 md:p-8">
        <SectionTitle icon={Wallet}>{td.myDashboard}</SectionTitle>
        {isError && <ErrorBanner message={td.loadError} onRetry={() => refetch()} />}

        <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 status-dot" />
              <span className="text-sm font-semibold text-green-300">{td.evmWalletConnected}</span>
            </div>
            {evm.isOnBsc ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-sm border border-green-500/40 bg-green-500/10 text-green-300" data-testid="status-bsc">
                <CheckCircle2 className="w-3.5 h-3.5" /> {td.onBsc}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-sm border border-yellow-500/40 bg-yellow-500/10 text-yellow-300" data-testid="status-bsc">
                <XCircle className="w-3.5 h-3.5" /> {td.notOnBsc}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2" data-testid="text-evm-address">
            <CopyableAddress address={evm.address} context="evm-dashboard" />
            <a
              href={`${TOKEN_CONFIG.explorerAddressUrl}/${evm.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-200 transition-colors"
              data-testid="link-evm-explorer"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-200" data-testid="text-evm-network">
              {evm.chainName || "--"}
            </span>
          </div>
        </div>

        {evm.address && !evm.isOnBsc && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400/70 flex-shrink-0" />
            <span className="text-sm text-yellow-300/80">{td.switchToBsc}</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-sm text-purple-300/80 mb-2">{td.myBalance}</div>
            <div className="font-mono text-lg font-bold text-purple-50" data-testid="text-my-balance">
              {evm.balanceLoading ? (
                <Skeleton className="h-7 w-24 bg-primary/10" />
              ) : evm.balance != null ? (
                `${formatTokenCount(evm.balance)} ${tokenSymbol}`
              ) : (
                <Placeholder />
              )}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-sm text-purple-300/80 mb-2">{td.eligible}</div>
            <div className="font-mono text-lg font-bold" data-testid="text-eligible">
              {evm.balanceLoading ? (
                <Skeleton className="h-7 w-24 bg-primary/10" />
              ) : evm.eligible != null ? (
                evm.eligible ? (
                  <span className="text-green-300">{td.eligibleYes}</span>
                ) : (
                  <span className="text-yellow-300">{td.eligibleNo} ({TOKEN_CONFIG.holdingThreshold.toLocaleString()})</span>
                )
              ) : (
                <Placeholder />
              )}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-sm text-purple-300/80 mb-2">{td.holdingWeight}</div>
            <div className="font-mono text-lg font-bold text-purple-50" data-testid="text-holding-weight">
              <Placeholder />
            </div>
            <NotDeployedBadge />
          </div>
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-sm text-purple-300/80 mb-2">{td.timeMultiplier}</div>
            <div className="font-mono text-lg font-bold text-purple-50" data-testid="text-time-multiplier">
              <Placeholder />
            </div>
            <NotDeployedBadge />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {[
            { label: td.pendingBnb, key: "pending-bnb", unit: "BNB", type: "BNB" },
            { label: td.pendingLp, key: "pending-lp", unit: "LP", type: "LP" },
            { label: td.referralComm, key: "referral-comm", unit: tokenSymbol, type: "Referral" },
          ].map((r) => (
            <div key={r.key} className="flex items-center justify-between p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
              <div>
                <div className="text-sm text-purple-300/80 mb-1">{r.label}</div>
                <div className="font-mono text-xl font-bold text-purple-50" data-testid={`text-${r.key}`}>
                  <Placeholder />
                </div>
                <NotDeployedBadge />
              </div>
              <Button
                size="default"
                variant="outline"
                className="text-sm border-purple-500/40 text-purple-200/40 h-10 px-4 cursor-not-allowed opacity-50"
                disabled
                data-testid={`button-claim-${r.key}`}
              >
                <Gift className="w-4 h-4 mr-2" /> {td.claim}
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
    { label: td.holderDividends, pct: "30%", color: "#A78BFA" },
    { label: td.lpRewards, pct: "30%", color: "#34D399" },
    { label: td.referral, pct: "30%", color: "#60A5FA" },
    { label: td.marketing, pct: "10%", color: "#FBBF24" },
  ];

  return (
    <GlowCard delay={0.35}>
      <div className="p-6 md:p-8">
        <SectionTitle icon={Send}>{td.mechanismFlow}</SectionTitle>
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-purple-500/20 bg-purple-950/40">
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
                <span className="text-sm font-semibold text-purple-100 whitespace-nowrap">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="w-5 h-5 text-purple-500/40 hidden sm:block" />
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {destinations.map((d) => (
            <div key={d.label} className="text-center p-4 rounded-lg border border-purple-500/15 bg-purple-950/30">
              <div className="text-2xl md:text-3xl font-bold mb-1" style={{ color: d.color }}>{d.pct}</div>
              <div className="text-sm text-purple-300/80">{d.label}</div>
            </div>
          ))}
        </div>
      </div>
    </GlowCard>
  );
}

function ReferralSection() {
  const { t } = useLanguage();
  const evm = useEvmWallet();
  const { data, isLoading, isError, refetch } = useReferralData();
  const { data: meta } = useOnChainTokenMeta();
  const { toast } = useToast();
  const td = t.tokenDashboard;
  const tokenSymbol = meta?.symbol || TOKEN_CONFIG.symbol || "TOKEN";

  const handleSubmitReview = useCallback(() => {
    toast({ title: td.reviewSubmitted, description: td.reviewPending });
  }, [toast, td]);

  if (!evm.address) {
    return (
      <GlowCard delay={0.4}>
        <div className="p-8 md:p-10 text-center">
          <Link className="w-12 h-12 text-purple-400/50 mx-auto mb-4" />
          <div className="text-base text-purple-300" data-testid="text-connect-referral">{td.connectWalletReferral}</div>
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
      <div className="p-6 md:p-8">
        <SectionTitle icon={Users}>{td.referralProgram}</SectionTitle>
        {isError && <ErrorBanner message={td.loadError} onRetry={() => refetch()} />}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-5">
          {stats.map((s) => (
            <div key={s.key} className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
              <div className="text-sm text-purple-300/80 mb-2">{s.label}</div>
              <div className="font-mono text-lg font-bold text-purple-50" data-testid={`text-referral-${s.key}`}>
                <SkeletonValue isLoading={isLoading} value={s.value} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="default"
            variant="outline"
            className="text-sm border-purple-500/40 hover:border-purple-400/70 hover:bg-purple-500/10 text-purple-200 h-10 px-5"
            onClick={handleSubmitReview}
            data-testid="button-submit-review"
          >
            <FileText className="w-4 h-4 mr-2" /> {td.submitReview}
          </Button>
        </div>
        <div className="mt-5 pt-5 border-t border-purple-500/15">
          <div className="text-sm text-purple-300/70 mb-2">{td.referralHistory}</div>
          {data?.history && data.history.length > 0 ? (
            <div className="space-y-2">
              {data.history.map((h, i) => (
                <div key={i} className="flex justify-between text-sm text-purple-300/80">
                  <span>{h.date}</span>
                  <span>{h.amount} {tokenSymbol}</span>
                  <span>{h.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-purple-300/50">{td.noHistory}</div>
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
      <div className="p-6 md:p-8">
        <SectionTitle icon={ShieldCheck}>{td.transparency}</SectionTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-sm text-purple-300/70 mb-1">{td.tokenContract}</div>
              <CopyableAddress address={cfg.tokenContract} short={false} context="transparency-contract" />
            </div>
            <div>
              <div className="text-sm text-purple-300/70 mb-1">{td.marketingMultisig}</div>
              <CopyableAddress address={cfg.marketingMultisig} context="marketing-multisig" />
            </div>
            <div>
              <div className="text-sm text-purple-300/70 mb-1">{td.reimbursementVault}</div>
              <CopyableAddress address={cfg.reimbursementVault} context="reimbursement-vault" />
            </div>
            <div>
              <div className="text-sm text-purple-300/70 mb-1">{td.githubSource}</div>
              <a
                href={cfg.githubSource}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-purple-300 hover:text-purple-100 transition-colors inline-flex items-center gap-2"
                data-testid="link-github"
              >
                <ExternalLink className="w-4 h-4" /> {td.viewRepository}
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-sm text-purple-300/70 mb-2">{td.vaultAddresses}</div>
              <div className="space-y-2">
                {cfg.vaultAddresses.map((v) => {
                  const vaultLabel = td[v.label as keyof typeof td] as string;
                  return (
                    <div key={v.label} className="flex items-center gap-3">
                      <span className="text-sm text-purple-300/60 w-24 truncate">
                        {vaultLabel}
                      </span>
                      <CopyableAddress address={v.address} context={`vault-${v.label}`} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-sm text-purple-300/70 mb-2">{td.auditStatus}</div>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold border ${
                cfg.auditStatus === "completed"
                  ? "border-green-500/40 bg-green-500/10 text-green-300"
                  : cfg.auditStatus === "in-progress"
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                  : "border-purple-400/25 bg-purple-500/5 text-purple-300"
              }`} data-testid="status-audit">
                <BadgeCheck className="w-4 h-4" />
                {cfg.auditStatus}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 mt-2">
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
  const { data: meta } = useOnChainTokenMeta();
  const displayName = meta?.name || TOKEN_CONFIG.name || td.tokenLabel;

  return (
    <section id="token-dashboard" className="px-4 sm:px-6 py-12" data-testid="section-token-dashboard">
      <div className="max-w-5xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md border border-purple-500/25 bg-purple-500/5 mb-4">
            <div className="w-2 h-2 rounded-full bg-primary status-dot" />
            <span className="text-sm font-semibold text-purple-300 tracking-wider uppercase">
              {td.sectionBadge}
            </span>
          </div>
          <h2 className="font-orbitron text-2xl md:text-3xl font-bold tracking-wider text-purple-50">
            {displayName} {td.analyticsTitle}
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
