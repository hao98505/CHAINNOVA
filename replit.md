# ChainNova Agents V2

## Overview
Decentralized AI agent marketplace on Solana. Mint, buy, rent, and stake AI agents as NFTs. Bridge ForgAI tokens cross-chain.

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
- `/` — Home (hero + particle background + stats)
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
- **Tests**: `tests/wforgai-bridge.test.ts` (13 cases: init constraints, pause/unpause, bridge_out validation, complete_transfer sig verify + replay)
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
