import { motion } from "framer-motion";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  useTokenOverview, useOnChainTokenMeta, useHolderDividend,
} from "@/hooks/useTokenDashboard";
import { TOKEN_CONFIG, VAULT_CONTRACT_CONFIG } from "@/config/tokenDashboard";
import {
  Copy, Check, ExternalLink, TrendingUp, Layers, CircleDollarSign,
  Droplets, AlertTriangle, RefreshCw, Wallet, CheckCircle2, XCircle,
  Globe, Lock, Activity, BarChart2, Coins, Zap, Info,
} from "lucide-react";
import { formatUsd, formatTokenCount } from "@/lib/tokenDashboard/formatters";
import { useEvmWallet } from "@/contexts/EvmWalletContext";
import { encodeFunctionData } from "viem";

const ABI_REGISTER = [{ type: "function", name: "register", inputs: [], outputs: [] }] as const;
const ABI_CLAIM    = [{ type: "function", name: "claim",    inputs: [], outputs: [] }] as const;

async function sendContractCall(from: string, to: string, data: `0x${string}`): Promise<string> {
  const txHash = await (window as any).ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data, gas: "0x30d40" }], // 200_000 gas
  });
  return txHash as string;
}

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

        <div className="mt-3 p-3 rounded-lg border border-purple-500/15 bg-purple-950/20 text-xs text-purple-400/70 flex items-center justify-between">
          <span>
            <Activity className="w-3 h-3 inline mr-1.5" />
            {td.dataSourcePortal}
          </span>
          {data?.priceSource && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-blue-500/25 bg-blue-500/8 text-blue-300/80 font-mono">
              {data.priceSource === "gmgn"        ? td.priceSourceGmgn
               : data.priceSource === "dexscreener" ? td.priceSourceDex
               : td.priceSourcePortal}
            </span>
          )}
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
  const contractDeployed = !!VAULT_CONTRACT_CONFIG.dividendContract;

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
  ];

  return (
    <GlowCard delay={0.15}>
      <div className="p-6 md:p-8">
        <SectionTitle icon={Layers}>{td.globalVaultStats}</SectionTitle>

        {/* Pre-graduation info — neutral, accurate */}
        <div className="mb-4 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-sm text-blue-300/80 flex items-start gap-2.5">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{td.preGraduationNote}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {stats.map((s) => (
            <div key={s.key} className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
              <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{s.label}</div>
              <div data-testid={`text-global-${s.key}`}>
                {isLoading ? (
                  <Skeleton className="h-5 w-20 bg-primary/10" />
                ) : s.value != null ? (
                  <span className="font-mono font-bold text-purple-50">{s.value}</span>
                ) : (
                  <UnavailableBadge reason={s.reason} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Dividend contract status row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{td.dividendContractLabel}</div>
            <div data-testid="text-global-dividend-contract">
              {contractDeployed ? (
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border border-green-500/30 bg-green-500/8 text-green-300">
                    <CheckCircle2 className="w-3 h-3" /> {td.contractLive}
                  </span>
                  <div className="mt-1.5 font-mono text-xs text-purple-400/60">
                    {VAULT_CONTRACT_CONFIG.dividendContract.slice(0, 10)}…
                  </div>
                </div>
              ) : (
                <NotConnectedBadge reason={td.contractNotDeployed} />
              )}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{td.totalDistributedLabel}</div>
            <div data-testid="text-global-total-distributed">
              {contractDeployed ? (
                <span className="font-mono font-bold text-purple-50">0 BNB</span>
              ) : (
                <NotConnectedBadge reason={td.contractNotDeployed} />
              )}
            </div>
            {contractDeployed && (
              <div className="text-xs text-purple-400/40 mt-1 italic">{td.preGraduationNote.split(".")[0]}</div>
            )}
          </div>
        </div>

        {/* Vault & contract status grid (2-vault: 40/30/30 model) */}
        <div className="border-t border-purple-500/10 pt-4">
          <div className="text-xs text-purple-300/50 mb-3 uppercase tracking-wide font-semibold">{td.vaultStatusTitle}</div>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {/* HolderDividend (40 %) */}
            <div className="p-3 rounded-lg bg-purple-950/40 border border-green-500/20" data-testid="vault-holder-dividend">
              <div className="text-xs text-purple-300/50 mb-1 uppercase tracking-wide">{td.holderDividendVault}</div>
              <div className="text-xs text-purple-400/50 mb-1.5">40 %</div>
              {VAULT_CONTRACT_CONFIG.dividendContract ? (
                <>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border border-green-500/30 bg-green-500/8 text-green-300">
                    <CheckCircle2 className="w-2.5 h-2.5" /> {td.deployedPhase1}
                  </span>
                  <div className="mt-1 font-mono text-xs text-purple-400/50">{VAULT_CONTRACT_CONFIG.dividendContract.slice(0,8)}…</div>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border border-orange-500/25 bg-orange-500/5 text-orange-400/80">
                  <AlertTriangle className="w-2.5 h-2.5" /> {td.pendingDeploy}
                </span>
              )}
            </div>
            {/* BottomProtectionVault (30 %) */}
            <div className="p-3 rounded-lg bg-purple-950/40 border border-teal-500/20" data-testid="vault-bottom-protection">
              <div className="text-xs text-purple-300/50 mb-1 uppercase tracking-wide">{td.bottomProtectionVaultLabel}</div>
              <div className="text-xs text-purple-400/50 mb-1.5">30 %</div>
              {VAULT_CONTRACT_CONFIG.bottomProtectionVault ? (
                <>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border border-teal-500/30 bg-teal-500/8 text-teal-300">
                    <CheckCircle2 className="w-2.5 h-2.5" /> {td.deployedPhase1}
                  </span>
                  <div className="mt-1 font-mono text-xs text-purple-400/50">{VAULT_CONTRACT_CONFIG.bottomProtectionVault.slice(0,8)}…</div>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border border-orange-500/25 bg-orange-500/5 text-orange-400/80">
                  <AlertTriangle className="w-2.5 h-2.5" /> {td.pendingDeploy}
                </span>
              )}
            </div>
          </div>
          {/* Current tax mechanism */}
          <div className="p-3 rounded-lg border border-purple-500/15 bg-purple-950/20 flex items-center gap-2 text-xs text-purple-400/70">
            <CircleDollarSign className="w-3.5 h-3.5 text-purple-400/60 flex-shrink-0" />
            <span><span className="text-purple-300/70 font-semibold">{td.currentTaxMechanism}:</span> {td.portalFeeInfo}</span>
          </div>
        </div>
      </div>
    </GlowCard>
  );
}

/* ─────────────────────────────────────────────
   BLOCK 3: Your Dividend
───────────────────────────────────────────── */
function fmtDuration(secs: number, td: Record<string, string>): string {
  if (secs < 60) return `${secs}${td.secs}`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}${td.mins}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}${td.hours} ${m % 60}${td.mins}`;
  const d = Math.floor(h / 24);
  return `${d}${td.days} ${h % 24}${td.hours}`;
}

function fmtWeight(wei: bigint): string {
  const n = Number(wei);
  if (n >= 1e21) return `${(n / 1e21).toFixed(2)}Z`;
  if (n >= 1e18) return `${(n / 1e18).toFixed(2)}E`;
  if (n >= 1e15) return `${(n / 1e15).toFixed(2)}P`;
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}G`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
  return n.toFixed(0);
}

function YourDividendSection() {
  const { t } = useLanguage();
  const td = t.tokenDashboard;
  const evm = useEvmWallet();
  const { data: meta } = useOnChainTokenMeta();
  const { data: hd, isLoading: hdLoading } = useHolderDividend();
  const tokenSymbol = meta?.symbol || "CNOVA";
  const contractDeployed = !!VAULT_CONTRACT_CONFIG.dividendContract;

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

  const registered = contractDeployed && hd?.registered;

  return (
    <GlowCard delay={0.2}>
      <div className="p-6 md:p-8">
        <SectionTitle icon={Wallet}>{td.yourDividend}</SectionTitle>

        {/* Wallet row */}
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

        {!evm.isOnBsc && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 mb-4 text-sm text-yellow-300/80">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {td.switchToBsc}
          </div>
        )}

        {/* 7-field grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">

          {/* Field 1: Registered Status */}
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{td.registeredStatus}</div>
            <div data-testid="text-registered-status">
              {!contractDeployed ? (
                <NotConnectedBadge reason={td.contractNotDeployed} />
              ) : hdLoading ? (
                <Skeleton className="h-5 w-20 bg-primary/10" />
              ) : registered ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border border-green-500/40 bg-green-500/10 text-green-300">
                  <CheckCircle2 className="w-3 h-3" /> {td.eligible}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border border-yellow-500/30 bg-yellow-500/5 text-yellow-400/80">
                  <XCircle className="w-3 h-3" /> {td.notRegistered}
                </span>
              )}
            </div>
            {contractDeployed && !registered && !hdLoading && (
              <div className="text-xs text-purple-400/40 mt-1 italic">{td.registerFirst}</div>
            )}
          </div>

          {/* Field 2: Balance (live from wallet) */}
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{td.myBalance}</div>
            <div className="font-mono font-bold text-purple-50 leading-tight" data-testid="text-balance">
              {evm.balanceLoading ? (
                <Skeleton className="h-6 w-20 bg-primary/10" />
              ) : evm.balance != null ? (
                <>
                  <span className="text-base">{formatTokenCount(evm.balance)}</span>
                  <span className="text-xs text-purple-300/60 ml-1">{tokenSymbol}</span>
                  <div className="mt-1">
                    {evm.eligible
                      ? <span className="text-xs text-green-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{td.eligible}</span>
                      : <span className="text-xs text-yellow-300 flex items-center gap-1"><XCircle className="w-3 h-3" />{td.notEligible}</span>
                    }
                  </div>
                </>
              ) : (
                <Placeholder />
              )}
            </div>
            <div className="text-xs text-purple-400/50 mt-1">{td.minRequired}: {TOKEN_CONFIG.holdingThreshold.toLocaleString()}</div>
          </div>

          {/* Field 3: Holding Time */}
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{td.holdingTime}</div>
            <div className="font-mono font-bold text-purple-50" data-testid="text-holding-time">
              {!contractDeployed ? (
                <NotConnectedBadge reason={td.contractNotDeployed} />
              ) : hdLoading ? (
                <Skeleton className="h-5 w-16 bg-primary/10" />
              ) : registered && hd ? (
                <span className="text-base">{fmtDuration(hd.holdingSeconds, td as Record<string,string>)}</span>
              ) : (
                <Placeholder />
              )}
            </div>
            <div className="text-xs text-purple-400/40 mt-1 italic">{td.claimNote}</div>
          </div>

          {/* Field 4: Current Weight */}
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{td.currentWeightLabel}</div>
            <div className="font-mono font-bold text-purple-50" data-testid="text-current-weight">
              {!contractDeployed ? (
                <NotConnectedBadge reason={td.contractNotDeployed} />
              ) : hdLoading ? (
                <Skeleton className="h-5 w-20 bg-primary/10" />
              ) : registered && hd ? (
                <span className="text-base">{fmtWeight(hd.currentWeightWei)}</span>
              ) : (
                <Placeholder />
              )}
            </div>
            <div className="text-xs text-purple-400/40 mt-1 italic">{td.weightFormula}</div>
          </div>

          {/* Field 5: Weight Share */}
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{td.weightShare}</div>
            <div className="font-mono font-bold text-purple-50" data-testid="text-weight-share">
              {!contractDeployed ? (
                <NotConnectedBadge reason={td.contractNotDeployed} />
              ) : hdLoading ? (
                <Skeleton className="h-5 w-16 bg-primary/10" />
              ) : registered && hd ? (
                <span className="text-base">{hd.weightSharePct.toFixed(2)}%</span>
              ) : (
                <Placeholder />
              )}
            </div>
            <div className="text-xs text-purple-400/40 mt-1 italic">{td.topUpNote}</div>
          </div>

          {/* Field 6: Pending Dividend */}
          <div className="p-4 rounded-lg bg-purple-950/40 border border-purple-500/15">
            <div className="text-xs text-purple-300/60 mb-2 uppercase tracking-wide">{td.pendingDividend}</div>
            <div className="font-mono font-bold text-purple-50" data-testid="text-pending-dividend">
              {!contractDeployed ? (
                <NotConnectedBadge reason={td.contractNotDeployed} />
              ) : hdLoading ? (
                <Skeleton className="h-5 w-20 bg-primary/10" />
              ) : registered && hd ? (
                <span className="text-base">{hd.pendingBnb.toFixed(6)} BNB</span>
              ) : (
                <Placeholder />
              )}
            </div>
          </div>
        </div>

        {/* Field 7: Total Claimed */}
        <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-500/15 flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-purple-300/60 uppercase tracking-wide">{td.totalClaimed}</div>
            <div className="text-xs text-red-400/70 mt-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {td.sellInvalidation}
            </div>
          </div>
          <div className="font-mono font-bold text-purple-50" data-testid="text-total-claimed">
            {!contractDeployed ? (
              <NotConnectedBadge reason={td.contractNotDeployed} />
            ) : hdLoading ? (
              <Skeleton className="h-5 w-24 bg-primary/10" />
            ) : registered && hd ? (
              <span>{hd.totalClaimed.toFixed(6)} BNB</span>
            ) : (
              <Placeholder />
            )}
          </div>
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
  const { data: hd, isLoading: hdLoading, refetch: refetchHd } = useHolderDividend();
  const queryClient = useQueryClient();

  const [regPending, setRegPending] = useState(false);
  const [claimPending, setClaimPending] = useState(false);
  const [regTx, setRegTx] = useState<string | null>(null);
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const contractDeployed = !!VAULT_CONTRACT_CONFIG.dividendContract;
  const registered = contractDeployed && !!hd?.registered;
  const pendingBnb = hd?.pendingBnb ?? 0;

  // Conditions for each button
  const canRegister =
    contractDeployed &&
    !!evm.address &&
    evm.isOnBsc &&
    evm.eligible &&
    !registered &&
    !regPending &&
    !hdLoading;

  const canClaim =
    contractDeployed &&
    !!evm.address &&
    evm.isOnBsc &&
    registered &&
    pendingBnb > 0 &&
    !claimPending &&
    !hdLoading;

  const handleRegister = useCallback(async () => {
    if (!evm.address || !VAULT_CONTRACT_CONFIG.dividendContract) return;
    setTxError(null);
    setRegTx(null);
    setRegPending(true);
    try {
      const data = encodeFunctionData({ abi: ABI_REGISTER, functionName: "register" });
      const hash = await sendContractCall(evm.address, VAULT_CONTRACT_CONFIG.dividendContract, data);
      setRegTx(hash);
      // Refresh dividend data after 4 s (give chain time to mine)
      setTimeout(() => { refetchHd(); queryClient.invalidateQueries({ queryKey: ["/holder-dividend"] }); }, 4000);
    } catch (err: any) {
      setTxError(err?.message ?? "Transaction failed");
    } finally {
      setRegPending(false);
    }
  }, [evm.address, refetchHd, queryClient]);

  const handleClaim = useCallback(async () => {
    if (!evm.address || !VAULT_CONTRACT_CONFIG.dividendContract) return;
    setTxError(null);
    setClaimTx(null);
    setClaimPending(true);
    try {
      const data = encodeFunctionData({ abi: ABI_CLAIM, functionName: "claim" });
      const hash = await sendContractCall(evm.address, VAULT_CONTRACT_CONFIG.dividendContract, data);
      setClaimTx(hash);
      setTimeout(() => { refetchHd(); queryClient.invalidateQueries({ queryKey: ["/holder-dividend"] }); }, 4000);
    } catch (err: any) {
      setTxError(err?.message ?? "Transaction failed");
    } finally {
      setClaimPending(false);
    }
  }, [evm.address, refetchHd, queryClient]);

  // Derive hint text for each button
  const registerHint = !contractDeployed
    ? td.contractNotDeployed
    : !evm.address
    ? td.connectToView
    : !evm.isOnBsc
    ? td.switchToBsc
    : !evm.eligible
    ? `${td.notEligible} — ${td.minRequired} ${TOKEN_CONFIG.holdingThreshold.toLocaleString()} CNOVA`
    : registered
    ? td.alreadyRegistered
    : td.registerHint;

  const claimHint = !contractDeployed
    ? td.contractNotDeployed
    : !evm.address
    ? td.connectToView
    : !evm.isOnBsc
    ? td.switchToBsc
    : !registered
    ? td.registerFirst
    : pendingBnb <= 0
    ? td.noPendingRewards
    : td.claimHint;

  return (
    <GlowCard delay={0.25}>
      <div className="p-6 md:p-8">
        <SectionTitle icon={Coins}>{td.registerClaim}</SectionTitle>

        {/* Status banner */}
        {contractDeployed ? (
          <div className="p-4 rounded-lg border border-green-500/20 bg-green-500/5 mb-5 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400/80 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-green-300 mb-1">{td.contractLive}</div>
              <div className="text-xs text-green-300/60 font-mono">{VAULT_CONTRACT_CONFIG.dividendContract}</div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 mb-5 flex items-start gap-3">
            <Lock className="w-5 h-5 text-yellow-400/70 flex-shrink-0 mt-0.5" />
            <div className="text-sm font-semibold text-yellow-300">{td.contractNotDeployed}</div>
          </div>
        )}

        {/* Tx feedback */}
        {txError && (
          <div className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-sm text-red-400 flex items-start gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="break-all">{txError}</span>
          </div>
        )}
        {(regTx || claimTx) && (
          <div className="mb-4 p-3 rounded-lg border border-green-500/20 bg-green-500/5 text-sm text-green-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div>{td.txSentDesc}</div>
              <a
                href={`https://bscscan.com/tx/${regTx ?? claimTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-purple-300/70 hover:text-purple-200 flex items-center gap-1 mt-1"
              >
                {(regTx ?? claimTx)?.slice(0, 20)}… <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Register card */}
          <div className="p-5 rounded-lg border border-purple-500/15 bg-purple-950/40">
            <div className="text-sm font-semibold text-purple-100 mb-1">{td.registerDividend}</div>
            <div className="text-xs text-purple-400/60 mb-4 min-h-[2.5rem]">{registerHint}</div>
            <Button
              onClick={handleRegister}
              disabled={!canRegister}
              size="default"
              className="w-full text-sm font-semibold"
              data-testid="button-register-dividend"
              style={canRegister ? { background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "1px solid rgba(139,92,246,0.4)" } : {}}
            >
              {regPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{td.submitting}</>
              ) : registered ? (
                <><CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />{td.alreadyRegistered}</>
              ) : (
                <><Coins className="w-4 h-4 mr-2" />{td.registerDividend}</>
              )}
            </Button>
          </div>

          {/* Claim card */}
          <div className="p-5 rounded-lg border border-purple-500/15 bg-purple-950/40">
            <div className="text-sm font-semibold text-purple-100 mb-1">{td.claimDividend}</div>
            <div className="text-xs text-purple-400/60 mb-4 min-h-[2.5rem]">
              {registered && pendingBnb > 0
                ? <span className="text-green-300/80">{pendingBnb.toFixed(6)} BNB {td.pendingDividend}</span>
                : claimHint
              }
            </div>
            <Button
              onClick={handleClaim}
              disabled={!canClaim}
              size="default"
              className="w-full text-sm font-semibold"
              data-testid="button-claim-dividend"
              style={canClaim ? { background: "linear-gradient(135deg, #F0B90B, #D4A00A)", border: "1px solid rgba(240,185,11,0.4)", color: "#1a1a2e" } : {}}
            >
              {claimPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{td.submitting}</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" />{td.claimDividend}</>
              )}
            </Button>
          </div>
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
      </div>
    </section>
  );
}
