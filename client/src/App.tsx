import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

function LanguageToggle() {
  const { lang, toggleLang } = useLanguage();
  return (
    <button
      onClick={toggleLang}
      data-testid="button-language-toggle"
      title={lang === "en" ? "切换中文" : "Switch to English"}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/30 bg-primary/10 transition-all font-orbitron text-[10px] tracking-wider text-foreground"
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
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 status-dot" />
                <span className="font-orbitron text-xs text-muted-foreground tracking-widest uppercase">
                  {t.header.network}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <WalletConnect />
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
      <AppInner />
    </LanguageProvider>
  );
}
