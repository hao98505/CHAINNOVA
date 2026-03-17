import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Home,
  Store,
  Bot,
  Coins,
  ArrowLeftRight,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function AppSidebar() {
  const [location] = useLocation();
  const { t } = useLanguage();

  const navItems = [
    { titleKey: "home" as const, url: "/", icon: Home, descKey: "Overview & stats" },
    { titleKey: "marketplace" as const, url: "/marketplace", icon: Store, descKey: "Buy & rent agents" },
    { titleKey: "myAgents" as const, url: "/my-agents", icon: Bot, descKey: "Your NFT agents" },
    { titleKey: "stake" as const, url: "/stake", icon: Coins, descKey: "$CNOVA staking" },
    { titleKey: "bridge" as const, url: "/bridge", icon: ArrowLeftRight, descKey: "Cross-chain bridge" },
  ] as const;


  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 flex-shrink-0">
              <div className="absolute inset-0 rounded-md bg-primary/20 border border-primary/40" />
              <div className="absolute inset-1 rounded-sm bg-gradient-to-br from-primary/80 to-purple-900/80 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-orbitron text-xs font-bold tracking-wider text-foreground uppercase leading-tight">
                ChainNova
              </div>
              <div className="font-orbitron text-[9px] text-primary/80 tracking-widest uppercase">
                Agents V2
              </div>
            </div>
          </div>
          <div className="mt-2 h-px bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-orbitron text-[9px] tracking-widest text-muted-foreground/60 uppercase px-3 mb-1">
            {t.nav.navigation}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.titleKey.toLowerCase().replace(/([A-Z])/g, "-$1").toLowerCase()}`}
                    >
                      <Link href={item.url}>
                        <item.icon
                          className={`w-4 h-4 flex-shrink-0 ${
                            isActive ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                        <div className="flex flex-col min-w-0">
                          <span
                            className={`font-orbitron text-[10px] font-semibold tracking-wider truncate ${
                              isActive ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {t.nav[item.titleKey]}
                          </span>
                        </div>
                        {isActive && (
                          <div className="ml-auto w-1 h-4 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Resources section hidden — Docs, Explorer, Governance pages not yet implemented */}
      </SidebarContent>

      <SidebarFooter className="px-4 py-3">
        <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent mb-3" />
        <div className="glass-card rounded-md p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 status-dot flex-shrink-0" />
            <span className="font-orbitron text-[9px] text-green-400 tracking-widest uppercase">
              {t.nav.networkOnline}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[9px]">
            <div>
              <div className="text-muted-foreground/60 uppercase tracking-wider mb-0.5">{t.nav.networkTPS}</div>
              <div className="text-foreground font-orbitron font-semibold">65,234</div>
            </div>
            <div>
              <div className="text-muted-foreground/60 uppercase tracking-wider mb-0.5">{t.nav.networkAgents}</div>
              <div className="text-foreground font-orbitron font-semibold">1,842</div>
            </div>
          </div>
        </div>
        <div className="mt-3 text-center">
          <span className="font-orbitron text-[8px] text-muted-foreground/40 tracking-widest">
            v2.0.1 — DEVNET
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
