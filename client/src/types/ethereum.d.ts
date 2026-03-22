interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isOKExWallet?: boolean;
  selectedAddress: string | null;
  chainId: string;
}

interface Window {
  ethereum?: EthereumProvider;
}
