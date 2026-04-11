# ChainNova Agents V2

## Overview
Decentralized AI agent marketplace on Solana. Mint, buy, rent, and stake AI agents as NFTs. Cross-chain token bridge.

## Bridge Status
- **EVM↔EVM**: Operational (BSC / Arbitrum / Ethereum) — Phase 0 complete
- **Solana**: Phase 1 in progress — Anchor bridge program + wFORGAI mint
- **PRD**: `docs/solana-bridge-prd.md`

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion
- **State/Routing**: TanStack React Query + Wouter
- **Web3 (Solana)**: @solana/web3.js, @solana/spl-token, @coral-xyz/anchor, wallet-adapter-react
- **Web3 (EVM)**: viem
- **Smart Contracts**: Solidity 0.8.28 + Hardhat v2 + OpenZeppelin v5
- **Wallets**: Phantom, Solflare (Solana); MetaMask/injected (EVM)

## Architecture

### Pages
- `/` — Home (hero + Token Dashboard + particle background + stats)
- `/marketplace` — AI agent NFT grid
- `/my-agents` — Personal NFT collection
- `/stake` — $CNOVA staking
- `/bridge` — EVM↔EVM bridge (Solana greyed out with upgrading banner)

### Key Libraries
- `lib/evmBridge.ts` — `bridgeEvmToEvm()` for BSC ↔ Arbitrum ↔ Ethereum
- `lib/solanaBridge.ts` — All entry points throw (disabled)
- `lib/bridgeRouter.ts` — EVM↔EVM active; Solana directions throw
- `useChainNova.ts` — Contract interactions hook

### EVM Bridge (Operational)
- **Bridge Contract** (BSC/ARB/ETH): `0x49daa7A1109d061BF67b56676def0Bc439289Cb8`
- **ARB/ETH Wrapped Token**: `0x1452280dDa6Fa4C815f95B06cc15d429aEb0d917`
- **BSC ForgAI (native)**: `0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff`
- **Owner/Validator**: `0x31bF8708f2E7Bd9eefa57557be8100057132f3eC`
- **Relayer**: `server/evm-evm-relayer.ts` (Replit Workflow, 10s polling)
- **Scripts**: `npm run bridge:watch:evm-evm`, `scripts/acceptance-test-evm.cjs`

### Solana Bridge (Phase 1 — In Progress)
Anchor program: `programs/wforgai-bridge/`
- **Program ID**: `5EApB5fWMEBzFX4HFePxokLTR3yddHpM1z7VyMuC3GpZ` (placeholder, replace after `anchor build` keygen)
- **wFORGAI**: 9 decimals, mint authority = PDA (`seeds: ["mint-authority"]`)
- **Instructions**: `initialize`, `complete_transfer` (mint), `bridge_out` (burn), `pause`, `unpause`, `update_validator`
- **State**: `BridgeConfig` PDA, `TransferRecord` PDA per transfer_id
- **Signature**: secp256k1 (same EVM validator key)
- **Initialize constraints**: `wforgai_mint.decimals == 9` (6007), `mint_authority == PDA` (6008)
- **Error codes**: 6000–6008 (see `SPEC.md`)
- **Supported chains**: BSC (56), Arbitrum (42161), Ethereum (1)
- **Spec**: `programs/wforgai-bridge/SPEC.md`
- **Tests**: `tests/wforgai-bridge.test.ts` (18 cases: init constraints, pause/unpause, bridge_out validation+burn+nonce, complete_transfer sig verify+replay+balance, update_validator admin/sig)
- **Bidirectional Relayer**: `server/solana-evm-relayer.ts` — Solana→EVM (BridgeOut log→completeTransfer), EVM→Solana stub; dedup by transfer_id, paginated scanning, 12-block EVM finality

### Token Dashboard (Homepage)
- **Token**: ChainNovaAI (CNOVA), `0x0a9c2e3cda80a828334bfa2577a75a85229f7777` (BSC), 18 decimals, 1B supply
- **Trading**: Flap Portal bonding curve at `0xe2ce6ab80874fa9fa2aae65d277dd6b8e65c9de0` — NOT on PancakeSwap/DexScreener
- **Data Source**: `portalAdapter.ts` calls `getTokenV8Safe()` on-chain → derives price, marketCap, liquidity from reserve/supply. BNB/USD from CoinGecko.
- **Buy/Chart**: GMGN (`https://gmgn.ai/bsc/token/...`)
- **Tax**: 3% buy (300 bps) / 6% sell (600 bps) — on-chain via Portal
- **Wallet**: EVM wallet (MetaMask/injected) via `EvmWalletContext` — header shows BSC connect button on homepage
- **Config**: `client/src/config/tokenDashboard.ts` — token address, vault addresses (all empty = not deployed), Portal address, buy/chart URLs
- **Adapters**: `portalAdapter.ts` (primary) → `adapters.ts` (fallback chain: Portal → DexScreener for post-graduation)
- **On-Chain Meta**: `useOnChainTokenMeta()` reads name/symbol/decimals from contract; falls back to config
- **EVM Wallet Context**: `client/src/contexts/EvmWalletContext.tsx` — connect/disconnect, chain detection, balance reading, eligibility check
- **Hooks**: `client/src/hooks/useTokenDashboard.ts` — overview/vaults/myDashboard/referral queries (uses EvmWalletContext)
- **Component**: `client/src/components/home/TokenDashboard.tsx` — 6 sections with glassmorphism, i18n, error handling
- **i18n**: `tokenDashboard` namespace in `client/src/lib/i18n.ts` (EN + ZH) — includes notDeployed, vaultsNotDeployed, buyNow, viewChart keys
- **Vault Status**: All 4 vaults show "Not Deployed" badges; vault section shows banner explaining tax flows through Portal bonding curve
- **My Dashboard**: holdingWeight, timeMultiplier, pendingBnb/Lp/Referral marked with "Not Deployed" badge, Claim buttons disabled

### On-Chain Reward Vault Architecture (Draft — Not Deployed)
- **Architecture Doc**: `docs/architecture/reward-vault-architecture.md`
- **Layer 1**: Holder dividend via Flap Tax Token V2 (minimumShareBalance = 200,000)
- **Layer 2**: `MasterVault.sol` → splits BNB to LP (4286 bps) / Referral (4286 bps) / Marketing (1428 bps)
- **Contracts**: `contracts/MasterVault.sol`, `LPRewardVault.sol`, `ReferralVault.sol`, `MarketingVault.sol`
- **Frontend Prep**: `VAULT_CONTRACT_CONFIG` in config, `RewardContractAddresses` / `OnChainTokenMeta` types, `claimableHolderReward` / `earnedLP` / `pendingReferral` fields in `MyDashboardData`
- **CI**: `.github/workflows/anchor-build.yml` — `anchor build --no-idl` on push to main (GREEN)
- **CI strategy**: Rust 1.85 system cargo patched into solana toolchain (rustc 1.79), 9 dep pins for MSRV compat, IDL gen skipped (proc_macro2 incompatibility)
- **Build**: Cannot build in Replit (Solana SDK exceeds container memory). Use GitHub Actions or local `anchor build`.
- **Build output**: `wforgai_bridge.so` — 261KB eBPF binary, uploaded as CI artifact
- **Old SPL**: `6ZcR1KCqVZDLzSoUbiPW8P6XUvrazxMtUZTa9csppump` — mint authority destroyed, not used

## Environment Variables
```
BSC_RPC_URL=
BSC_LOGS_RPC_URL=https://bsc-rpc.publicnode.com
ARBITRUM_RPC_URL=
ETHEREUM_RPC_URL=https://ethereum-rpc.publicnode.com
RELAYER_PRIVATE_KEY=
VALIDATOR_PRIVATE_KEY=
```

## Design System
- Primary: #6B46C1 · Background: #0F0F1A · Text: #E9D8FD
- Fonts: Orbitron (headings) + Inter (body)
- Style: Cyberpunk glassmorphism

## Development
```bash
npm install && npm run dev
```
