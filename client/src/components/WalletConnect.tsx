import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSolBalance } from "@/hooks/useChainNova";
import { Wallet, ChevronDown, Copy, LogOut, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletConnect() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { toast } = useToast();
  const { t } = useLanguage();
  const address = publicKey?.toBase58();
  const { data: solBalance, isLoading: balanceLoading } = useSolBalance(address);
  const [cnovaBalance] = useState<number>(12_500);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast({ title: t.header.copyAddress, description: address.slice(0, 20) + "..." });
    }
  };

  if (!connected || !publicKey) {
    return (
      <Button
        variant="default"
        size="sm"
        onClick={() => setVisible(true)}
        data-testid="button-connect-wallet"
        className="font-orbitron text-[10px] tracking-wider uppercase"
        style={{
          background: "linear-gradient(135deg, #6B46C1, #4C1D95)",
          border: "1px solid rgba(167,139,250,0.4)",
        }}
      >
        <Wallet className="w-3.5 h-3.5 mr-2" />
        {t.header.connectWallet}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="button-wallet-menu"
          className="font-orbitron text-[9px] tracking-wider uppercase gap-2 border-primary/30 bg-primary/10"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 status-dot" />
            <span className="text-foreground">{truncateAddress(address!)}</span>
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 glass-card border-primary/30 p-0 overflow-hidden"
      >
        <div className="px-4 py-3 bg-primary/10 border-b border-primary/20">
          <div className="font-orbitron text-[9px] tracking-widest text-muted-foreground/70 uppercase mb-2">
            Wallet
          </div>
          <div className="font-mono text-xs text-foreground break-all leading-relaxed">
            {address}
          </div>
        </div>

        <div className="px-4 py-3 border-b border-border/50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-widest mb-1">
                {t.header.solBalance}
              </div>
              <div className="font-orbitron text-sm font-bold text-foreground">
                {balanceLoading ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                ) : (
                  `${(solBalance ?? 2.47).toFixed(3)}`
                )}
              </div>
              <div className="font-orbitron text-[8px] text-muted-foreground/60">SOL</div>
            </div>
            <div>
              <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-widest mb-1">
                {t.header.cnovaBalance}
              </div>
              <div className="font-orbitron text-sm font-bold text-primary">
                {cnovaBalance.toLocaleString()}
              </div>
              <div className="font-orbitron text-[8px] text-muted-foreground/60">CNOVA</div>
            </div>
          </div>
        </div>

        <div className="p-1">
          <DropdownMenuItem
            onClick={copyAddress}
            className="font-orbitron text-[10px] tracking-wider uppercase cursor-pointer"
            data-testid="button-copy-address"
          >
            <Copy className="w-3.5 h-3.5 mr-2" />
            {t.header.copyAddress}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={disconnect}
            className="font-orbitron text-[10px] tracking-wider uppercase cursor-pointer text-destructive"
            data-testid="button-disconnect-wallet"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            {t.header.disconnect}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
