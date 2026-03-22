# Bridge v2 — EVM Cross-Chain Bridge

## Why a New Bridge?

The original bridge used Solana + Wormhole simulation mode. The FORGAI token (`0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff`) lives on BSC as an ERC20, so we need a native EVM bridge that can:
- Lock tokens on BSC and mint wrapped versions on target chains
- Burn wrapped tokens on target chains and release originals on BSC

## Architecture

```
BSC (source)                    opBNB / Arbitrum (target)
┌──────────────┐                ┌──────────────┐
│ CNovaBridge  │ ──(events)──>  │ CNovaBridge  │
│  lock FORGAI │                │  mint wFORGAI│
└──────────────┘                └──────────────┘
       ↑                               ↑
       │                               │
   Frontend                        Relayer
   (viem)                    (signs + submits)
```

### Flow: BSC → Target Chain
1. User approves FORGAI spending by BSC bridge
2. User calls `bridgeOut()` on BSC bridge → tokens locked, event emitted
3. Relayer watches `BridgeTransferInitiated` events on BSC
4. Relayer signs message with validator key
5. Relayer calls `completeTransfer()` on target bridge → wrapped tokens minted

### Flow: Target Chain → BSC (reverse)
1. User calls `bridgeOut()` on target bridge → wrapped tokens burned
2. Relayer signs and calls `completeTransfer()` on BSC bridge → original tokens released

## Deployment Sequence

### 1. Deploy on BSC
```bash
npx hardhat run scripts/deployBridge.ts --network bsc
```
- Deploys CNovaBridge (no wrapped token needed on BSC)
- Note the bridge address → set `VITE_BRIDGE_BSC`

### 2. Deploy on opBNB
```bash
npx hardhat run scripts/deployBridge.ts --network opbnb
```
- Deploys CNovaBridge + CNovaWrappedToken
- Sets bridge as minter on wrapped token
- Note addresses → set `VITE_BRIDGE_OPBNB` and `VITE_WRAPPED_FORGAI_OPBNB`

### 3. Deploy on Arbitrum
```bash
npx hardhat run scripts/deployBridge.ts --network arbitrum
```
- Same as opBNB
- Set `VITE_BRIDGE_ARBITRUM` and `VITE_WRAPPED_FORGAI_ARBITRUM`

### 4. Configure Routes

On BSC:
```bash
TARGET_WRAPPED_TOKEN=<opbnb wrapped addr> npx hardhat run scripts/configureRoutes.ts --network bsc
```

On opBNB:
```bash
npx hardhat run scripts/configureRoutes.ts --network opbnb
```

On Arbitrum:
```bash
npx hardhat run scripts/configureRoutes.ts --network arbitrum
```

## Testing: BSC → opBNB

1. Set env vars in `.env`
2. Start relayer: `npm run bridge:relayer`
3. Open the app and navigate to Bridge
4. Connect MetaMask with BSC network
5. Enter amount, click Approve, then Bridge
6. Relayer picks up the event and mints on opBNB
7. Check opBNB explorer for the wrapped token balance

## Testing: BSC → Arbitrum

Same as above but select Arbitrum as target chain.

## Relayer

```bash
npm run bridge:relayer
```

Required env vars:
- `SOURCE_RPC_URL` — BSC RPC
- `TARGET_RPC_URL` — target chain RPC
- `RELAYER_PRIVATE_KEY` — pays gas on target chain
- `VALIDATOR_PRIVATE_KEY` — signs bridge messages
- `SOURCE_BRIDGE` — bridge contract on BSC
- `TARGET_BRIDGE` — bridge contract on target chain
- `SOURCE_TOKEN` — FORGAI address on BSC
- `TARGET_WRAPPED_TOKEN` — wFORGAI address on target

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `RouteNotActive` | Route not configured | Run `configureRoutes.ts` |
| `InsufficientFee` | Flat fee not paid | Check `flatFeeWei` setting |
| `InvalidSignature` | Wrong validator key | Ensure validator address matches key |
| `TransferAlreadyProcessed` | Duplicate relay | Normal — relayer already processed this |
| `OnlyBridge` | Wrong bridge on wrapped token | Run `setBridge()` on wrapped token |

## Rollback

To revert the bridge page to the original Solana/Wormhole version:
1. Check out the previous commit of `client/src/pages/Bridge.tsx`
2. The old wormhole.ts and bridge history logic is still in the codebase
3. No other pages were modified

## Files Changed

| File | Purpose |
|------|---------|
| `client/src/pages/Bridge.tsx` | EVM bridge UI |
| `client/src/lib/evmBridge.ts` | viem-based bridge library |
| `client/src/types/ethereum.d.ts` | Window.ethereum types |
| `contracts/CNovaBridge.sol` | Bridge contract |
| `contracts/CNovaWrappedToken.sol` | Wrapped ERC20 token |
| `hardhat.config.cts` | Hardhat configuration |
| `scripts/deployBridge.ts` | Deployment script |
| `scripts/configureRoutes.ts` | Route configuration script |
| `server/bridge-relayer.ts` | Event listener + relayer |
