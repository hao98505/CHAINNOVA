# ChainNova Agents V2

## Overview
A decentralized AI agent marketplace built on Solana blockchain. Users can mint, buy, rent, and stake AI agents as NFTs, plus bridge $CNOVA tokens cross-chain.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with cyberpunk/glassmorphism theme
- **Animations**: Framer Motion
- **State**: TanStack React Query
- **Routing**: Wouter
- **Web3**: @solana/web3.js, @coral-xyz/anchor, @solana/wallet-adapter-react
- **Supported Wallets**: Phantom, Solflare

## Architecture

### Frontend Pages
- `/` — Home: Hero section with particle background + hot agents + stats
- `/marketplace` — Agent Marketplace: Grid of AI agent NFTs with filters/search
- `/my-agents` — My Agents: Personal NFT collection with portfolio stats
- `/stake` — Staking: $CNOVA staking with APY tiers and position tracking
- `/bridge` — Bridge: Cross-chain token transfers (Solana → BSC/Arbitrum/Ethereum)

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
- `lib/wormhole.ts` — Wormhole cross-chain bridge service (Token Bridge protocol)
- `lib/i18n.ts` — EN/ZH translation strings
- `contexts/LanguageContext.tsx` — Language toggle provider

### Cross-Chain Bridge (Wormhole)
The bridge uses the Wormhole Token Bridge protocol for Solana → EVM cross-chain transfers.
- **Service**: `client/src/lib/wormhole.ts` — WormholeBridgeService class
- **Chains**: Solana (devnet), BNB Chain, Arbitrum, Ethereum (all testnet)
- **Flow**: Approve → Transfer (lock on Solana) → Confirm → VAA generation → Redeem on target
- **Current mode**: Simulation (falls back gracefully until $CNOVA SPL token is deployed)
- **To activate real bridging**: Deploy $CNOVA SPL token, attest via Wormhole, update CNOVA_MINT_DEVNET in wormhole.ts
- **Dependencies**: @wormhole-foundation/sdk, @wormhole-foundation/sdk-solana, @wormhole-foundation/sdk-evm, @wormhole-foundation/sdk-solana-tokenbridge, @wormhole-foundation/sdk-evm-tokenbridge

### i18n (Chinese/English)
- Toggle button in header (EN / 中文)
- All pages, components, sidebar fully translated
- Language persisted to localStorage key `chainnova_lang`

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
Current data is mocked for demo purposes. Replace mock data in `useChainNova.ts` with real Anchor contract calls using the program ID and IDL from your deployed Solana program.
