# ChainNova Agents V2

## Overview
A decentralized AI agent marketplace built on Solana blockchain. Users can mint, buy, rent, and stake AI agents as NFTs, plus bridge FORGAI tokens cross-chain via an EVM bridge.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with cyberpunk/glassmorphism theme
- **Animations**: Framer Motion
- **State**: TanStack React Query
- **Routing**: Wouter
- **Web3 (Solana)**: @solana/web3.js, @coral-xyz/anchor, @solana/wallet-adapter-react
- **Web3 (EVM)**: viem (for cross-chain bridge)
- **Smart Contracts**: Solidity 0.8.28, Hardhat v2, OpenZeppelin v5
- **Supported Wallets**: Phantom, Solflare (Solana); MetaMask/injected (EVM bridge)

## Architecture

### Frontend Pages
- `/` — Home: Hero section with particle background + hot agents + stats
- `/marketplace` — Agent Marketplace: Grid of AI agent NFTs with filters/search
- `/my-agents` — My Agents: Personal NFT collection with portfolio stats
- `/stake` — Staking: $CNOVA staking with APY tiers and position tracking
- `/bridge` — Bridge: EVM cross-chain bridge (BSC → opBNB / Arbitrum) for FORGAI token

### Key Components
- `WalletConnect` — Phantom/Solflare wallet connection with balance display
- `AgentCard` — NFT card with buy/rent functionality + rent modal
- `CreateAgentModal` — Multi-step modal for minting new AI agents
- `ParticleBackground` — Canvas-based particle network animation
- `AppSidebar` — Navigation sidebar with network stats

### Hooks & Libraries
- `useChainNova.ts` — Custom hook for all contract interactions (mint, stake, rent, buy, bridge)
- `useAgents()` — Fetch marketplace agents (currently mock data)
- `useMyAgents()` — Fetch user's owned agents
- `useStakeInfo()` — Fetch staking position
- `useSolBalance()` — Live SOL balance from RPC
- `lib/anchor.ts` — Anchor provider setup + placeholder IDL
- `lib/evmBridge.ts` — EVM bridge service using viem (BSC lock/mint model)
- `lib/i18n.ts` — EN/ZH translation strings (32+ bridge-specific keys)
- `contexts/LanguageContext.tsx` — Language toggle provider

### Cross-Chain Bridge (EVM — Bridge V2)
The bridge uses a lock/mint model for EVM cross-chain transfers of the FORGAI token.
- **Source Chain**: BSC (BNB Smart Chain, chainId 56)
- **Target Chains**: opBNB (chainId 204), Arbitrum (chainId 42161)
- **Token**: FORGAI (`0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff`) on BSC
- **Contracts**: `contracts/CNovaBridge.sol` (lock/release on BSC, mint/burn on targets), `contracts/CNovaWrappedToken.sol` (wrapped FORGAI on target chains)
- **Frontend**: `client/src/pages/Bridge.tsx`, `client/src/lib/evmBridge.ts`
- **Relayer**: `server/bridge-relayer.ts` — watches Lock events on BSC, submits mint txs on target chains
- **Deploy Scripts**: `scripts/deployBridge.ts`, `scripts/configureRoutes.ts`
- **Compilation**: `TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat compile`
- **Docs**: `docs/bridge-v2.md`

#### Bridge Deployment Steps
1. Set `PRIVATE_KEY` in env
2. Compile: `TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat compile`
3. Deploy to BSC: `TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/deployBridge.ts --network bsc`
4. Deploy to opBNB/Arbitrum: same command with `--network opbnb` or `--network arbitrum`
5. Configure routes: `TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/configureRoutes.ts --network bsc`
6. Set `VITE_BRIDGE_BSC`, `VITE_BRIDGE_OPBNB`, `VITE_WRAPPED_FORGAI_OPBNB` etc. in env
7. Run relayer: `npx tsx server/bridge-relayer.ts`

### i18n (Chinese/English)
- Toggle button in header (EN / 中文)
- All pages, components, sidebar fully translated
- Language persisted to localStorage key `chainnova_lang`

### Production Hardening
- OG + Twitter Card meta tags in `index.html` with 1200×630 og-banner.png
- `/assets/` route with long-term cache headers (`max-age=31536000, immutable`)
- API 404 handler returning `{"error":"API endpoint not found"}`
- Detailed error messages for all transaction failures (insufficient balance, user rejected, timeout, contract failed)
- Skeleton loading states for marketplace cards

## Configuration

### Replacing Program ID
In `client/src/lib/anchor.ts`:
```ts
export const PROGRAM_ID_STRING = "YOUR_ACTUAL_PROGRAM_ID_HERE";
```

### Switching to Mainnet
In `client/src/App.tsx`:
```ts
const NETWORK = "mainnet-beta"; // change from "devnet"
```

### Custom RPC Endpoint
Set environment variable:
```
VITE_RPC_ENDPOINT=https://your-rpc-endpoint.com
```

### Bridge Environment Variables
```
PRIVATE_KEY=0x...                           # Deployer/relayer private key
BSC_RPC_URL=https://bsc-dataseed1.binance.org
OPBNB_RPC_URL=https://opbnb-mainnet-rpc.bnbchain.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
VITE_BRIDGE_BSC=0x...                       # Bridge contract on BSC
VITE_BRIDGE_OPBNB=0x...                     # Bridge contract on opBNB
VITE_BRIDGE_ARBITRUM=0x...                  # Bridge contract on Arbitrum
VITE_WRAPPED_FORGAI_OPBNB=0x...             # Wrapped FORGAI on opBNB
VITE_WRAPPED_FORGAI_ARBITRUM=0x...          # Wrapped FORGAI on Arbitrum
```

## Design System
- **Primary Color**: #6B46C1 (purple)
- **Secondary**: #A78BFA (light purple)
- **Background**: #0F0F1A (deep dark)
- **Text**: #E9D8FD (light purple-white)
- **Fonts**: Orbitron (headings) + Inter (body)
- **Style**: Cyberpunk glassmorphism with neon glow effects

## Development
```bash
npm install
npm run dev
```

## Note
Current agent/staking data is mocked for demo purposes. Replace mock data in `useChainNova.ts` with real Anchor contract calls using the program ID and IDL from your deployed Solana program. The old `lib/wormhole.ts` file is unused (replaced by Bridge V2).
