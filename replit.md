# ChainNova Agents V2

## Overview
A decentralized AI agent marketplace built on Solana blockchain. Users can mint, buy, rent, and stake AI agents as NFTs, plus bridge ForgAI tokens cross-chain. EVM↔EVM bridge (BSC / Arbitrum / Ethereum) is operational; Solana direction is disabled pending wrapped SPL (wFORGAI) rewrite.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with cyberpunk/glassmorphism theme
- **Animations**: Framer Motion
- **State**: TanStack React Query
- **Routing**: Wouter
- **Web3 (Solana)**: @solana/web3.js, @solana/spl-token, @coral-xyz/anchor, @solana/wallet-adapter-react
- **Web3 (EVM)**: viem (for cross-chain bridge)
- **Smart Contracts**: Solidity 0.8.28, Hardhat v2, OpenZeppelin v5
- **Supported Wallets**: Phantom, Solflare (Solana); MetaMask/injected (EVM bridge)

## Architecture

### Frontend Pages
- `/` — Home: Hero section with particle background + hot agents + stats
- `/marketplace` — Agent Marketplace: Grid of AI agent NFTs with filters/search
- `/my-agents` — My Agents: Personal NFT collection with portfolio stats
- `/stake` — Staking: $CNOVA staking with APY tiers and position tracking
- `/bridge` — Cross-Chain Bridge: EVM↔EVM (BSC / Arbitrum / Ethereum); Solana direction disabled (upgrading)

### Key Components
- `WalletConnect` — Phantom/Solflare wallet connection with balance display
- `AgentCard` — NFT card with buy/rent functionality + rent modal
- `CreateAgentModal` — Multi-step modal for minting new AI agents
- `ParticleBackground` — Canvas-based particle network animation
- `AppSidebar` — Navigation sidebar with network stats

### Hooks & Libraries
- `useChainNova.ts` — Custom hook for all contract interactions (mint, stake, rent, buy, bridge)
- `lib/evmBridge.ts` — EVM bridge service using viem (BSC / Arbitrum / Ethereum) + `bridgeEvmToEvm()` for EVM↔EVM transfers
- `lib/solanaBridge.ts` — Solana bridge functions (disabled — guard throw on all entry points)
- `lib/bridgeRouter.ts` — Unified bridge routing: EVM↔EVM active, Solana directions disabled with guard throws
- `lib/i18n.ts` — EN/ZH translation strings (32+ bridge-specific keys)
- `contexts/LanguageContext.tsx` — Language toggle provider

### Cross-Chain Bridge

#### Current Status
- **EVM↔EVM**: Operational (BSC ↔ Arbitrum ↔ Ethereum)
- **Solana**: Disabled — pending Phase 1 wrapped SPL (wFORGAI) rewrite
- **PRD**: `docs/solana-bridge-prd.md`

#### EVM↔EVM Bridge (Operational)
BSC ↔ Arbitrum / Ethereum three-chain bridge, deployed and verified on-chain:
- **Bridge Contract** (all 3 chains): `0x49daa7A1109d061BF67b56676def0Bc439289Cb8`
- **ARB/ETH Wrapped Token**: `0x1452280dDa6Fa4C815f95B06cc15d429aEb0d917`
- **BSC ForgAI (native)**: `0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff`
- **Deployer/Owner/Validator**: `0x31bF8708f2E7Bd9eefa57557be8100057132f3eC`
- **Contracts**: `contracts/CNovaBridge.sol`, `contracts/CNovaWrappedToken.sol`
- **Relayer**: `server/evm-evm-relayer.ts` — polling-based (10s interval), publicnode RPCs
- **Scripts**: `npm run bridge:watch:evm-evm` (relayer), `scripts/acceptance-test-evm.cjs` (tests)
- **Workflow**: "EVM Bridge Relayer" — Replit-managed (`npx tsx server/evm-evm-relayer.ts`)
- **Frontend**: `bridgeEvmToEvm()` in `evmBridge.ts`; Bridge UI defaults to BSC source
- **Compilation**: `npm run bridge:compile`

#### Solana Bridge (Disabled — Phase 0 Complete)
Solana SPL ForgAI (`6ZcR1KCqVZDLzSoUbiPW8P6XUvrazxMtUZTa9csppump`) mint authority destroyed. Previous vault model is not viable.
- Bridge UI: SOL button greyed out + "Solana Bridge Upgrading" banner
- Code guards: `initiateSolanaDeposit()`, `executeSolanaBridge()`, `executeEvmToSolanaBridge()`, `bridgeToSolana()` all throw
- **Next**: Phase 1 — Solana Anchor bridge program + wFORGAI wrapped SPL mint

#### Bridge Environment Variables
Frontend (Vite):
```
VITE_BRIDGE_BSC=0x49daa7A1109d061BF67b56676def0Bc439289Cb8
VITE_BRIDGE_ARBITRUM=0x49daa7A1109d061BF67b56676def0Bc439289Cb8
VITE_BRIDGE_ETHEREUM=0x49daa7A1109d061BF67b56676def0Bc439289Cb8
VITE_BSC_TOKEN=0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff
VITE_WRAPPED_FORGAI_ARBITRUM=0x1452280dDa6Fa4C815f95B06cc15d429aEb0d917
VITE_WRAPPED_FORGAI_ETHEREUM=0x1452280dDa6Fa4C815f95B06cc15d429aEb0d917
```

Backend:
```
BSC_RPC_URL=
BSC_LOGS_RPC_URL=https://bsc-rpc.publicnode.com
ARBITRUM_RPC_URL=
ETHEREUM_RPC_URL=https://ethereum-rpc.publicnode.com
RELAYER_PRIVATE_KEY=
VALIDATOR_PRIVATE_KEY=
```

### i18n (Chinese/English)
- Toggle button in header (EN / 中文)
- All pages, components, sidebar fully translated
- Language persisted to localStorage key `chainnova_lang`

### Production Hardening
- OG + Twitter Card meta tags in `index.html` with 1200×630 og-banner.png
- `/assets/` route with long-term cache headers (`max-age=31536000, immutable`)
- API 404 handler returning `{"error":"API endpoint not found"}`
- Detailed error messages for all transaction failures
- Skeleton loading states for marketplace cards
- Buffer polyfill in main.tsx for Solana libraries

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
Current agent/staking data is mocked for demo purposes. Replace mock data in `useChainNova.ts` with real Anchor contract calls using the program ID and IDL from your deployed Solana program.
