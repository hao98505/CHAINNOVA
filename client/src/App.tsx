import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, ChevronDown, Copy, LogOut } from "lucide-react";
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { WalletConnect } from "@/components/WalletConnect";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { EvmWalletProvider, useEvmWallet } from "@/contexts/EvmWalletContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Marketplace from "@/pages/Marketplace";
import MyAgents from "@/pages/MyAgents";
import Stake from "@/pages/Stake";
import Bridge from "@/pages/Bridge";
import "@solana/wallet-adapter-react-ui/styles.css";

const NETWORK = "devnet";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/marketplace" component={Marketplace} />
      <Route path="/my-agents" component={MyAgents} />
      <Route path="/stake" component={Stake} />
      <Route path="/bridge" component={Bridge} />
      <Route component={NotFound} />
    </Switch>
  );
}

function EvmWalletButton() {
  const { address, chainName, isOnBsc, isConnecting, connect, disconnect } = useEvmWallet();
  const { t } = useLanguage();

  if (!address) {
    return (
      <Button
        variant="default"
        size="sm"
        onClick={connect}
        disabled={isConnecting}
        data-testid="button-connect-evm"
        className="text-xs font-medium tracking-wide uppercase"
        style={{
          background: "linear-gradient(135deg, #F0B90B, #D4A00A)",
          border: "1px solid rgba(240,185,11,0.5)",
          color: "#1a1a2e",
        }}
      >
        <Wallet className="w-3.5 h-3.5 mr-2" />
        {isConnecting ? "..." : t.header.connectBsc}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="button-evm-wallet-menu"
          className="text-xs font-medium tracking-wide uppercase gap-2 border-yellow-500/30 bg-yellow-500/10"
        >
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isOnBsc ? "bg-green-400" : "bg-yellow-400"} status-dot`} />
            <span className="text-foreground">{`${address.slice(0, 6)}...${address.slice(-4)}`}</span>
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 glass-card border-primary/30 p-0 overflow-hidden">
        <div className="px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/20">
          <div className="text-xs text-muted-foreground/80 uppercase tracking-wide mb-1">BSC Wallet</div>
          <div className="font-mono text-xs text-foreground break-all leading-relaxed">{address}</div>
          <div className="text-xs text-muted-foreground/60 mt-1">{chainName || "Unknown"}</div>
        </div>
        <div className="p-1">
          <DropdownMenuItem
            onClick={() => { navigator.clipboard.writeText(address); }}
            className="text-xs tracking-wide uppercase cursor-pointer"
            data-testid="button-copy-evm-address"
          >
            <Copy className="w-3.5 h-3.5 mr-2" />
            {t.header.copyAddress}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={disconnect}
            className="text-xs tracking-wide uppercase cursor-pointer text-destructive"
            data-testid="button-disconnect-evm"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            {t.header.disconnect}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LanguageToggle() {
  const { lang, toggleLang } = useLanguage();
  return (
    <button
      onClick={toggleLang}
      data-testid="button-language-toggle"
      title={lang === "en" ? "切换中文" : "Switch to English"}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/30 bg-primary/10 transition-all text-xs font-medium tracking-wide text-foreground"
      style={{ minWidth: 64 }}
    >
      <span className={lang === "en" ? "text-primary font-bold" : "text-muted-foreground"}>EN</span>
      <span className="text-muted-foreground/40">/</span>
      <span className={lang === "zh" ? "text-primary font-bold" : "text-muted-foreground"}>中文</span>
    </button>
  );
}

function AppLayout() {
  const { t } = useLanguage();
  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3.5rem",
  };

  const [location] = useLocation();
  const isHome = location === "/";

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/30 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center gap-3">
              <SidebarTrigger
                data-testid="button-sidebar-toggle"
                className="text-muted-foreground"
              />
              <div className="hidden md:flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isHome ? "bg-yellow-400" : "bg-green-400"} status-dot`} />
                <span className="font-orbitron text-xs text-muted-foreground tracking-widest uppercase">
                  {isHome ? t.header.networkHome : t.header.network}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LanguageToggle />
              {isHome && <EvmWalletButton />}
              {!isHome && <WalletConnect />}
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppInner() {
  const endpoint = useMemo(() => clusterApiUrl(NETWORK), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <AppLayout />
              <Toaster />
            </TooltipProvider>
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <EvmWalletProvider>
        <AppInner />
      </EvmWalletProvider>
    </LanguageProvider>
  );
}
