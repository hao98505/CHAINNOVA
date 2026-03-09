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
  ExternalLink,
  Globe,
  BookOpen,
} from "lucide-react";

const navItems = [
  { title: "HOME", url: "/", icon: Home, description: "Overview & stats" },
  { title: "MARKETPLACE", url: "/marketplace", icon: Store, description: "Buy & rent agents" },
  { title: "MY AGENTS", url: "/my-agents", icon: Bot, description: "Your NFT agents" },
  { title: "STAKE", url: "/stake", icon: Coins, description: "$CNOVA staking" },
  { title: "BRIDGE", url: "/bridge", icon: ArrowLeftRight, description: "Cross-chain bridge" },
];

const externalLinks = [
  { title: "DOCS", url: "#", icon: BookOpen },
  { title: "EXPLORER", url: "#", icon: ExternalLink },
  { title: "GOVERNANCE", url: "#", icon: Globe },
];

export function AppSidebar() {
  const [location] = useLocation();

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
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(" ", "-")}`}
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
                            {item.title}
                          </span>
                          <span className="text-[9px] text-muted-foreground/60 truncate leading-tight">
                            {item.description}
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

        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="font-orbitron text-[9px] tracking-widest text-muted-foreground/60 uppercase px-3 mb-1">
            Resources
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {externalLinks.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-orbitron text-[10px] tracking-wider text-muted-foreground">
                        {item.title}
                      </span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3">
        <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent mb-3" />
        <div className="glass-card rounded-md p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 status-dot flex-shrink-0" />
            <span className="font-orbitron text-[9px] text-green-400 tracking-widest uppercase">
              Network Online
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[9px]">
            <div>
              <div className="text-muted-foreground/60 uppercase tracking-wider mb-0.5">TPS</div>
              <div className="text-foreground font-orbitron font-semibold">65,234</div>
            </div>
            <div>
              <div className="text-muted-foreground/60 uppercase tracking-wider mb-0.5">Agents</div>
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
