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
- `/bridge` — Bridge v3: Bidirectional Solana ↔ EVM bridge (BSC / Arbitrum / Ethereum) for ForgAI token

### Key Components
- `WalletConnect` — Phantom/Solflare wallet connection with balance display
- `AgentCard` — NFT card with buy/rent functionality + rent modal
- `CreateAgentModal` — Multi-step modal for minting new AI agents
- `ParticleBackground` — Canvas-based particle network animation
- `AppSidebar` — Navigation sidebar with network stats

### Hooks & Libraries
- `useChainNova.ts` — Custom hook for all contract interactions (mint, stake, rent, buy, bridge)
- `lib/evmBridge.ts` — EVM bridge service using viem (BSC / Arbitrum / Ethereum)
- `lib/solanaBridge.ts` — Solana SPL token deposit to vault with memo-based intent
- `lib/bridgeRouter.ts` — Unified bridge routing layer (auto-selects Solana or EVM path)
- `lib/i18n.ts` — EN/ZH translation strings (32+ bridge-specific keys)
- `contexts/LanguageContext.tsx` — Language toggle provider

### Cross-Chain Bridge (Bridge v3 — Solana ↔ EVM)
Bidirectional custodial MVP bridge for ForgAI token between Solana and 3 EVM chains.

**Supported Directions:**
- Solana → BSC / Arbitrum / Ethereum
- BSC / Arbitrum / Ethereum → Solana

**Key Details:**
- **Solana Mint**: `6ZcR1KCqVZDLzSoUbiPW8P6XUvrazxMtUZTa9csppump`
- **EVM Chains**: BSC (56), Arbitrum (42161), Ethereum (1)
- **Solana Chain ID (EVM placeholder)**: 999999999
- **Model**: EVM↔EVM lock/mint bridge (Solana direction disabled — upgrading to wrapped SPL)
- **Contracts**: `contracts/CNovaBridge.sol`, `contracts/CNovaWrappedToken.sol`
- **Frontend**: `client/src/pages/Bridge.tsx`, `client/src/lib/evmBridge.ts`, `client/src/lib/bridgeRouter.ts`
- **Backend**: `server/evm-evm-relayer.ts` (EVM↔EVM auto-relay); `server/solana-watcher.ts` / `server/bridge-relayer.ts` (disabled, pending Phase 1 rewrite)
- **Compilation**: `npm run bridge:compile` or `TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat compile`
- **Docs**: `docs/bridge-v2.md`

#### Bridge Status Summary
- **EVM 部分：阶段性通过** — BSC ↔ Arbitrum / Ethereum 合约路径与 relayer 服务均已验收
- **Solana 部分：blocked** — 需要 wrapped SPL 重构，见下文

#### EVM↔EVM Bridge (EVM 阶段通过)
BSC ↔ Arbitrum / Ethereum 三链桥已部署、代码接入、relayer 常驻验收通过：
- **Bridge Contract** (all 3 chains): `0x49daa7A1109d061BF67b56676def0Bc439289Cb8`
- **ARB/ETH Wrapped Token**: `0x1452280dDa6Fa4C815f95B06cc15d429aEb0d917`
- **BSC ForgAI (native)**: `0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff`
- **Deployer/Owner/Validator**: `0x31bF8708f2E7Bd9eefa57557be8100057132f3eC`
- **Relayer**: `server/evm-evm-relayer.ts` — polling-based (10s interval), publicnode RPCs for BSC/ETH
- **Scripts**: `npm run bridge:watch:evm-evm` (relayer), `scripts/acceptance-test-evm.cjs` (formal tests)
- **Workflow**: "EVM Bridge Relayer" — Replit-managed persistent workflow (`npx tsx server/evm-evm-relayer.ts`)
- **Frontend**: Bridge UI now supports EVM↔EVM only (BSC ↔ ARB ↔ ETH); `bridgeEvmToEvm()` in `evmBridge.ts`

#### BSC↔Solana Bridge (Blocked — Phase 0 完成: 旧入口已禁用)
Solana SPL ForgAI (`6ZcR1KCqVZDLzSoUbiPW8P6XUvrazxMtUZTa9csppump`) mint authority 已销毁。Vault 模型不可用。
**Phase 0 已完成**：
- Bridge UI 中 Solana 方向已禁用（SOL 按钮灰显 + "Upgrading" 横幅）
- `solanaBridge.ts` 的 `initiateSolanaDeposit()` 已设 guard throw
- `bridgeRouter.ts` 的 `executeSolanaBridge()` / `executeEvmToSolanaBridge()` 已设 guard throw
- Bridge UI 默认源链改为 BSC，目标链选项只显示 EVM 链
- 术语已对齐："Custodial MVP" → "On-Chain Verified"，移除所有 Vault 文案
**下一步 Phase 1**：部署 Solana Anchor bridge program + wFORGAI wrapped SPL mint
**PRD**: `docs/solana-bridge-prd.md`

#### Bridge Environment Variables
Frontend (Vite):
```
VITE_SOLANA_RPC_URL=
VITE_SOLANA_MINT=6ZcR1KCqVZDLzSoUbiPW8P6XUvrazxMtUZTa9csppump
VITE_SOLANA_VAULT=
VITE_BRIDGE_BSC=0x...
VITE_BRIDGE_ARBITRUM=0x...
VITE_BRIDGE_ETHEREUM=0x...
VITE_WRAPPED_FORGAI_BSC=0x...
VITE_WRAPPED_FORGAI_ARBITRUM=0x...
VITE_WRAPPED_FORGAI_ETHEREUM=0x...
```

Backend:
```
SOLANA_RPC_URL=
SOLANA_VAULT_KEYPAIR_PATH=
SOLANA_VAULT_ATA=
SOLANA_MINT=6ZcR1KCqVZDLzSoUbiPW8P6XUvrazxMtUZTa9csppump
BSC_RPC_URL=
ARBITRUM_RPC_URL=
ETHEREUM_RPC_URL=
RELAYER_PRIVATE_KEY=
VALIDATOR_PRIVATE_KEY=
BSC_BRIDGE=
ARBITRUM_BRIDGE=
ETHEREUM_BRIDGE=
WRAPPED_FORGAI_BSC=
WRAPPED_FORGAI_ARBITRUM=
WRAPPED_FORGAI_ETHEREUM=
STATE_FILE_PATH=./bridge-state.json
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
Current agent/staking data is mocked for demo purposes. Replace mock data in `useChainNova.ts` with real Anchor contract calls using the program ID and IDL from your deployed Solana program. The old `lib/wormhole.ts` file is unused (replaced by Bridge v3).
