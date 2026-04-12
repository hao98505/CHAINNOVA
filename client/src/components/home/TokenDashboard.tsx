import { motion } from "framer-motion";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTokenOverview, useOnChainTokenMeta } from "@/hooks/useTokenDashboard";
import { TOKEN_CONFIG } from "@/config/tokenDashboard";
import {
  Copy, Check, ExternalLink, TrendingUp, Layers, CircleDollarSign,
  Droplets, AlertTriangle, RefreshCw, Wallet, CheckCircle2, XCircle,
  Globe, Lock, Activity, BarChart2, Coins,
} from "lucide-react";
import { formatUsd, formatTokenCount } from "@/lib/tokenDashboard/formatters";
import { useEvmWallet } from "@/contexts/EvmWalletContext";

function Placeholder() {
  return <span className="text-purple-300/50 font-mono">--</span>;
}

function UnavailableBadge({ reason }: { reason?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border border-orange-500/30 bg-orange-500/5 text-orange-400/80">
      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
      {reason ?? "Unavailable"}
    </div>
  );
}

function NotConnectedBadge({ reason }: { reason?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border border-yellow-500/30 bg-yellow-500/5 text-yellow-400/80">
      <Lock className="w-3 h-3 flex-shrink-0" />
      {reason ?? "Not Connected"}
    </div>
  );
}

function GlowCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="glass-card rounded-xl border border-purple-500/20 bg-purple-950/30 backdrop-blur-sm overflow-hidden"
    >
      {children}
    </motion.div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h3 className="font-orbitron text-sm font-bold uppercase tracking-wider text-purple-100">
        {children}
      </h3>
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
      data-testid={`button-copy-${context}`}
    >
      <span>{display}</span>
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />}
    </button>
  );
}

function SkeletonValue({ isLoading, value, width = "w-20" }: { isLoading: boolean; value: React.ReactNode; width?: string }) {
  if (isLoading) return <Skeleton className={`h-6 ${width} bg-primary/10`} />;
  return <>{value ?? <Placeholder />}</>;
}

function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-red-500/25 bg-red-500/5 text-red-300 text-sm mb-4">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={onRetry} data-testid="button-retry">
        <RefreshCw className="w-3 h-3 mr-1" /> {t.tokenDashboard.retry}
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   BLOCK 1: Buy / Chart / Contract
───────────────────────────────────────────── */
function TokenInfoSection() {
  const { t } = useLanguage();
  const { data, isLoading, isError, refetch } = useTokenOverview();
  const { data: meta } = useOnChainTokenMeta();
  const td = t.tokenDashboard;

  const tokenName = meta?.name || "ChainNovaAI";
  const tokenSymbol = meta?.symbol || "CNOVA";

  return (
    <GlowCard delay={0.1}>
      <div className="p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center flex-shrink-0">
              <span className="font-orbitron text-base font-black text-primary">
                {tokenName.charAt(0)}
              </span>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-50" data-testid="text-token-name">{tokenName}</div>
              <div className="text-sm text-purple-300 tracking-wide">${tokenSymbol}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <a
              href={TOKEN_CONFIG.buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20 transition-colors"
              data-testid="link-buy"
            >
              <TrendingUp className="w-4 h-4" /> {td.buyNow}
            </a>
            <a
              href={TOKEN_CONFIG.chartUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-colors"
              data-testid="link-chart"
            >
              <BarChart2 className="w-4 h-4" /> {td.viewChart}
            </a>
            <a
              href={TOKEN_CONFIG.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-purple-500/20 text-purple-400 hover:text-purple-200 transition-colors"
              data-testid="link-bscscan"
            >
              <ExternalLink className="w-4 h-4" /> BSCScan
            </a>
          </div>
        </div>

        {isError && <ErrorRetry message={td.loadError} onRetry={() => refetch()} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-1 uppercase tracking-wide">{td.tokenContract}</div>
            <div className="flex items-center gap-2">
              <CopyableAddress address={TOKEN_CONFIG.contractAddress} short={false} context="token-contract" />
            </div>
          </div>
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-1 uppercase tracking-wide">{td.tradingPlatformLabel}</div>
            <div className="text-sm font-semibold text-purple-100">{TOKEN_CONFIG.tradingPlatform}</div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-green-300 font-semibold border border-green-500/30 bg-green-500/8 px-2 py-0.5 rounded">
                {td.buyTax}: {TOKEN_CONFIG.buyTaxPercent}%
              </span>
              <span className="text-xs text-red-300 font-semibold border border-red-500/30 bg-red-500/8 px-2 py-0.5 rounded">
                {td.sellTax}: {TOKEN_CONFIG.sellTaxPercent}%
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: td.currentPrice, key: "price", icon: CircleDollarSign, value: data?.currentPrice != null ? formatUsd(data.currentPrice) : null },
            { label: td.marketCap, key: "mcap", icon: TrendingUp, value: data?.marketCap != null ? formatUsd(data.marketCap) : null },
            { label: td.liquidity, key: "liquidity", icon: Droplets, value: data?.liquidity != null ? formatUsd(data.liquidity) : null },
          ].map((m) => (
            <div key={m.key} className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15 text-center">
              <m.icon className="w-4 h-4 text-purple-400 mx-auto mb-2" />
              <div className="text-lg font-bold text-purple-50 leading-tight" data-testid={`text-${m.key}`}>
                <SkeletonValue isLoading={isLoading} value={m.value} />
              </div>
              <div className="text-xs text-purple-300/70 mt-1">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 p-3 rounded-lg border border-purple-500/15 bg-purple-950/20 text-xs text-purple-400/70">
          <Activity className="w-3 h-3 inline mr-1.5" />
          {td.dataSourcePortal} · GMGN Buy/Chart
        </div>
      </div>
    </GlowCard>
  );
}

/* ─────────────────────────────────────────────
   BLOCK 2: Global Vault Stats
───────────────────────────────────────────── */
function GlobalVaultStatsSection() {
  const { t } = useLanguage();
  const td = t.tokenDashboard;
  const { data, isLoading } = useTokenOverview();

  const stats = [
    {
      label: td.volume24h,
      key: "volume",
      value: data?.volume24h != null ? formatUsd(data.volume24h) : null,
      unavailable: true,
      reason: td.unavailable,
    },
    {
      label: td.holders,
      key: "holders",
      value: data?.holders != null ? data.holders.toLocaleString() : null,
      unavailable: true,
      reason: td.unavailable,
    },
    {
      label: td.dividendContractLabel,
      key: "dividend-contract",
      value: null,
      unavailable: false,
      notConnected: true,
      reason: td.contractNotDeployed,
    },
    {
      label: td.totalDistributedLabel,
      key: "total-distributed",
      value: null,
      unavailable: false,
      notConnected: true,
      reason: td.contractNotDeployed,
    },
  ];

  return (
    <GlowCard delay={0.15}>
      <div className="p-6 md:p-8">
        <SectionTitle icon={Layers}>{td.globalVaultStats}</SectionTitle>

        <div className="mb-4 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-sm text-yellow-300/80 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{td.taxFlowsToPortal}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {stats.map((s) => (
            <div key={s.key} className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
              <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{s.label}</div>
              <div data-testid={`text-global-${s.key}`}>
                {isLoading ? (
                  <Skeleton className="h-5 w-20 bg-primary/10" />
                ) : s.value != null ? (
                  <span className="font-mono font-bold text-purple-50">{s.value}</span>
                ) : s.notConnected ? (
                  <NotConnectedBadge reason={s.reason} />
                ) : (
                  <UnavailableBadge reason={s.reason} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlowCard>
  );
}

/* ─────────────────────────────────────────────
   BLOCK 3: Your Dividend
───────────────────────────────────────────── */
function YourDividendSection() {
  const { t } = useLanguage();
  const td = t.tokenDashboard;
  const evm = useEvmWallet();
  const { data: meta } = useOnChainTokenMeta();
  const tokenSymbol = meta?.symbol || "CNOVA";

  if (!evm.address) {
    return (
      <GlowCard delay={0.2}>
        <div className="p-8 text-center">
          <Wallet className="w-12 h-12 text-yellow-400/40 mx-auto mb-4" />
          <div className="text-base text-purple-300 mb-2">{td.connectToView}</div>
          <div className="text-sm text-purple-400/60 mb-4">MetaMask / BSC Wallet</div>
          <Button
            onClick={evm.connect}
            disabled={evm.isConnecting}
            data-testid="button-connect-evm"
            className="text-sm font-bold tracking-wide uppercase"
            style={{ background: "linear-gradient(135deg, #F0B90B, #D4A00A)", border: "1px solid rgba(240,185,11,0.4)", color: "#1a1a2e" }}
          >
            <Wallet className="w-4 h-4 mr-2" />
            {evm.isConnecting ? "..." : "Connect BSC Wallet"}
          </Button>
        </div>
      </GlowCard>
    );
  }

  return (
    <GlowCard delay={0.2}>
      <div className="p-6 md:p-8">
        <SectionTitle icon={Wallet}>{td.yourDividend}</SectionTitle>

        <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 status-dot" />
              <span className="text-sm font-semibold text-green-300">{td.walletConnected}</span>
            </div>
            {evm.isOnBsc ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs border border-green-500/40 bg-green-500/10 text-green-300" data-testid="status-bsc">
                <CheckCircle2 className="w-3 h-3" /> BSC Mainnet
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs border border-yellow-500/40 bg-yellow-500/10 text-yellow-300" data-testid="status-bsc">
                <XCircle className="w-3 h-3" /> {td.notOnBsc}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2" data-testid="text-evm-address">
            <Globe className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-sm text-purple-300/80">{evm.chainName || "--"}</span>
          </div>
          <CopyableAddress address={evm.address} context="evm-wallet" />
        </div>

        {evm.address && !evm.isOnBsc && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 mb-4 text-sm text-yellow-300/80">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {td.switchToBsc}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{td.myBalance}</div>
            <div className="font-mono font-bold text-purple-50 leading-tight" data-testid="text-balance">
              {evm.balanceLoading ? (
                <Skeleton className="h-6 w-20 bg-primary/10" />
              ) : evm.balance != null ? (
                <span className="text-base">{formatTokenCount(evm.balance)} <span className="text-xs text-purple-300/60">{tokenSymbol}</span></span>
              ) : (
                <Placeholder />
              )}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{td.holdingThreshold}</div>
            <div className="text-base font-bold" data-testid="text-eligibility">
              {evm.balanceLoading ? (
                <Skeleton className="h-6 w-16 bg-primary/10" />
              ) : evm.eligible != null ? (
                evm.eligible ? (
                  <span className="text-green-300 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {td.eligible}</span>
                ) : (
                  <span className="text-yellow-300 flex items-center gap-1"><XCircle className="w-4 h-4" /> {td.notEligible}</span>
                )
              ) : (
                <Placeholder />
              )}
            </div>
            <div className="text-xs text-purple-400/50 mt-1">{td.minRequired}: {TOKEN_CONFIG.holdingThreshold.toLocaleString()}</div>
          </div>

          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{td.registeredStatus}</div>
            <NotConnectedBadge reason={td.contractNotDeployed} />
          </div>

          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{td.pendingDividend}</div>
            <NotConnectedBadge reason={td.contractNotDeployed} />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-500/15 flex items-center justify-between">
          <div className="text-xs text-purple-300/60 uppercase tracking-wide">{td.totalClaimed}</div>
          <NotConnectedBadge reason={td.contractNotDeployed} />
        </div>
      </div>
    </GlowCard>
  );
}

/* ─────────────────────────────────────────────
   BLOCK 4: Register / Claim
───────────────────────────────────────────── */
function RegisterClaimSection() {
  const { t } = useLanguage();
  const td = t.tokenDashboard;
  const evm = useEvmWallet();

  return (
    <GlowCard delay={0.25}>
      <div className="p-6 md:p-8">
        <SectionTitle icon={Coins}>{td.registerClaim}</SectionTitle>

        <div className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 mb-5 flex items-start gap-3">
          <Lock className="w-5 h-5 text-yellow-400/70 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-yellow-300 mb-1">{td.contractNotDeployed}</div>
            <div className="text-xs text-yellow-300/70">{td.taxFlowsToPortal}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg border border-purple-500/15 bg-purple-950/40">
            <div className="text-sm font-semibold text-purple-100 mb-1">{td.registerDividend}</div>
            <div className="text-xs text-purple-400/60 mb-4">{td.graduationRequired}</div>
            <Button
              disabled
              size="default"
              className="w-full text-sm font-semibold opacity-40 cursor-not-allowed"
              data-testid="button-register-dividend"
              title={td.contractNotDeployed}
            >
              <Lock className="w-4 h-4 mr-2" />
              {td.registerDividend}
              <span className="ml-2 text-xs border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">{td.comingSoon}</span>
            </Button>
          </div>

          <div className="p-5 rounded-lg border border-purple-500/15 bg-purple-950/40">
            <div className="text-sm font-semibold text-purple-100 mb-1">{td.claimDividend}</div>
            <div className="text-xs text-purple-400/60 mb-4">
              {!evm.address ? td.connectToView : !evm.isOnBsc ? td.switchToBsc : td.contractNotDeployed}
            </div>
            <Button
              disabled
              size="default"
              className="w-full text-sm font-semibold opacity-40 cursor-not-allowed"
              data-testid="button-claim-dividend"
              title={td.contractNotDeployed}
            >
              <Lock className="w-4 h-4 mr-2" />
              {td.claimDividend}
              <span className="ml-2 text-xs border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">{td.comingSoon}</span>
            </Button>
          </div>
        </div>
      </div>
    </GlowCard>
  );
}

/* ─────────────────────────────────────────────
   BLOCK 5: LP Status
───────────────────────────────────────────── */
function LPStatusSection() {
  const { t } = useLanguage();
  const td = t.tokenDashboard;

  return (
    <GlowCard delay={0.3}>
      <div className="p-6 md:p-8">
        <SectionTitle icon={Activity}>{td.lpStatus}</SectionTitle>

        <div className="flex items-start gap-4 p-5 rounded-lg border border-orange-500/20 bg-orange-500/5 mb-5">
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-orange-300 mb-1">{td.lpNotStarted}</div>
            <div className="text-sm text-orange-300/70">{td.lpStatusDesc}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{td.bondingCurveStatus}</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 status-dot" />
              <span className="text-sm font-semibold text-green-300" data-testid="status-bonding-curve">{td.portalLive}</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">DEX Pair</div>
            <UnavailableBadge reason={td.notGraduated} />
          </div>

          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">LP Dividend</div>
            <NotConnectedBadge reason={td.graduateFirst} />
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg border border-purple-500/15 bg-purple-950/20 text-xs text-purple-400/70">
          {td.lpRewardInactive}
        </div>
      </div>
    </GlowCard>
  );
}

/* ─────────────────────────────────────────────
   ROOT EXPORT
───────────────────────────────────────────── */
export function TokenDashboard() {
  const { t } = useLanguage();
  const td = t.tokenDashboard;
  const { data: meta } = useOnChainTokenMeta();
  const displayName = meta?.name || "ChainNovaAI";

  return (
    <section id="token-dashboard" className="px-4 sm:px-6 py-12" data-testid="section-token-dashboard">
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-2"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md border border-yellow-500/25 bg-yellow-500/5 mb-4">
            <div className="w-2 h-2 rounded-full bg-yellow-400 status-dot" />
            <span className="text-xs font-semibold text-yellow-300 tracking-widest uppercase">
              BSC MAINNET · LIVE
            </span>
          </div>
          <h2 className="font-orbitron text-2xl md:text-3xl font-bold tracking-wider text-purple-50">
            {displayName} <span className="text-primary">{td.sectionBadge}</span>
          </h2>
          <p className="text-sm text-purple-400/70 mt-2 max-w-xl mx-auto">
            {td.dataSourcePortal} · {TOKEN_CONFIG.contractAddress.slice(0, 10)}...
          </p>
        </motion.div>

        <TokenInfoSection />
        <GlobalVaultStatsSection />
        <YourDividendSection />
        <RegisterClaimSection />
        <LPStatusSection />
      </div>
    </section>
  );
}
