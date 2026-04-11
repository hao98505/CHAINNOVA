import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { TOKEN_CONFIG } from "@/config/tokenDashboard";
import { readTokenBalance } from "@/lib/tokenDashboard/contracts";
import { formatTokenAmount } from "@/lib/tokenDashboard/formatters";

const EVM_CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  56: "BNB Smart Chain",
  137: "Polygon",
  42161: "Arbitrum One",
  10: "Optimism",
  43114: "Avalanche",
  250: "Fantom",
  8453: "Base",
};

interface EvmWalletState {
  address: string | null;
  chainId: number | null;
  chainName: string | null;
  isOnBsc: boolean;
  isConnecting: boolean;
  balance: number | null;
  balanceLoading: boolean;
  eligible: boolean | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

const EvmWalletContext = createContext<EvmWalletState | null>(null);

export function EvmWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const chainName = chainId ? (EVM_CHAIN_NAMES[chainId] || `Chain ${chainId}`) : null;
  const isOnBsc = chainId === TOKEN_CONFIG.chainId;
  const eligible = balance != null ? balance >= TOKEN_CONFIG.holdingThreshold : null;

  const updateChainId = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      const rawChainId = await window.ethereum.request({ method: "eth_chainId" }) as string;
      setChainId(parseInt(rawChainId, 16));
    } catch {}
  }, []);

  const fetchBalance = useCallback(async (addr: string) => {
    if (!addr) return;
    setBalanceLoading(true);
    try {
      const raw = await readTokenBalance(addr);
      setBalance(formatTokenAmount(raw, TOKEN_CONFIG.decimals));
    } catch {
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (address && isOnBsc) {
      await fetchBalance(address);
    }
  }, [address, isOnBsc, fetchBalance]);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        await updateChainId();
      }
    } catch {
    } finally {
      setIsConnecting(false);
    }
  }, [updateChainId]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setBalance(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAddress(accounts[0]);
      }
    };

    const handleChainChanged = (_chainId: string) => {
      setChainId(parseInt(_chainId, 16));
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    (async () => {
      try {
        const accounts = await window.ethereum!.request({ method: "eth_accounts" }) as string[];
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
          await updateChainId();
        }
      } catch {}
    })();

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [updateChainId, disconnect]);

  useEffect(() => {
    if (address && isOnBsc) {
      fetchBalance(address);
    } else {
      setBalance(null);
    }
  }, [address, isOnBsc, fetchBalance]);

  return (
    <EvmWalletContext.Provider
      value={{
        address,
        chainId,
        chainName,
        isOnBsc,
        isConnecting,
        balance,
        balanceLoading,
        eligible,
        connect,
        disconnect,
        refreshBalance,
      }}
    >
      {children}
    </EvmWalletContext.Provider>
  );
}

export function useEvmWallet() {
  const ctx = useContext(EvmWalletContext);
  if (!ctx) throw new Error("useEvmWallet must be used within EvmWalletProvider");
  return ctx;
}
