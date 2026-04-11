# On-Chain Reward Vault Architecture

## Overview

Two-layer tax distribution architecture for the BSC token ecosystem.

**Layer 1 — Holder Dividend**  
Handled by Flap Tax Token V2's built-in dividend mechanism (`minimumShareBalance = 200,000`).  
Holders meeting the threshold automatically receive BNB dividends proportional to their share.

**Layer 2 — MasterVault Distribution**  
Remaining tax revenue flows into `MasterVault`, which splits BNB to three purpose-specific vaults.

---

## Tax Flow

```
Buy/Sell Transaction
        │
        ▼
   Tax Collected (BNB)
        │
        ├─► Flap Tax Token V2 Dividend Contract
        │     └─ Holder BNB dividends (minimumShareBalance = 200,000)
        │
        └─► MasterVault.sol
              │
              ├─ 42.86% (4286 bps) ──► LPRewardVault.sol
              ├─ 42.86% (4286 bps) ──► ReferralVault.sol
              └─ 14.28% (1428 bps) ──► MarketingVault.sol
```

---

## Contract Responsibilities

### MasterVault.sol
- Receives BNB from tax collection
- Splits to LP / Referral / Marketing vaults by basis-point ratio
- `distribute()` triggers the split
- Tracks cumulative `totalReceived`, `totalDistributedToLP/Referral/Marketing`
- Owner can update recipient addresses and allocation ratios
- ReentrancyGuard protected

### LPRewardVault.sol
- Accepts a specific LP token for staking
- Distributes BNB rewards proportionally via `accRewardPerShare`
- `stake(amount)` / `unstake(amount)` / `claim()`
- `earned(address)` view for pending reward queries
- ReentrancyGuard protected

### ReferralVault.sol
- `bindReferrer(address)` — one-time referrer binding
- `claim(amount, nonce, deadline, sig)` — EIP-712 signed claim
- Backend signs claim authorizations; nonce prevents replay
- Tracks `claimed[address]` and `totalClaimed`
- No "backend pushes BNB directly" pattern — always user-initiated claim
- ReentrancyGuard protected

### MarketingVault.sol
- `claimApprovedPayment(amount, nonce, deadline, sig)` — EIP-712 signed
- Approved recipients claim their pre-authorized marketing payments
- No arbitrary `owner.withdraw()` — all outflows require valid signatures
- ReentrancyGuard protected

---

## Why Not "Tax → Wallet → Manual Distribution"?

1. **Transparency** — On-chain distribution is verifiable by anyone via explorer
2. **Trust** — No single wallet holder can divert funds arbitrarily
3. **Auditability** — Cumulative flow data is recorded in contract state and events
4. **Automation** — `distribute()` can be called by anyone (keeper/bot/user)
5. **Security** — ReentrancyGuard + EIP-712 signatures prevent common attack vectors

---

## Dashboard Field ↔ Contract Mapping

| Dashboard Field              | Data Source                          | Phase |
|------------------------------|--------------------------------------|-------|
| Token Name / Symbol          | ERC-20 `name()` / `symbol()`         | 1 ✓   |
| Token Balance                | ERC-20 `balanceOf(wallet)`           | 1 ✓   |
| Price / Market Cap / Volume  | DexScreener / GeckoTerminal API      | 1 ✓   |
| Holders                      | GeckoTerminal API                    | 1 ✓   |
| Explorer Links               | Config-driven                        | 1 ✓   |
| Holder Dividend Pending      | Dividend Contract `earned(wallet)`   | 2     |
| LP Reward Earned             | LPRewardVault `earned(wallet)`       | 2     |
| Referral Claimable           | Backend API → signed amount          | 2     |
| Vault Balances (BNB)         | `address(vault).balance`             | 2     |
| Vault Cumulative Inflow      | MasterVault `totalDistributedTo*`    | 2     |
| Referrer Binding Status      | ReferralVault `referrerOf(wallet)`   | 2     |
| Marketing Claim History      | MarketingVault events                | 3     |
| Staking Position (LP)        | LPRewardVault `userInfo(wallet)`     | 2     |

### Phase Definitions

- **Phase 1** — Token metadata, on-chain balances, market data from public APIs. Available now.
- **Phase 2** — Requires deployed vault contracts. Read on-chain state for pending rewards, staking positions, vault balances.
- **Phase 3** — Requires claim transaction integration. Write operations: claim, stake, unstake, bind referrer.

---

## Contract File List

| File                          | Purpose                              |
|-------------------------------|--------------------------------------|
| `contracts/MasterVault.sol`   | Tax BNB split to 3 sub-vaults        |
| `contracts/LPRewardVault.sol` | LP token staking, BNB reward claims  |
| `contracts/ReferralVault.sol` | Referral binding + EIP-712 claims    |
| `contracts/MarketingVault.sol`| Approved marketing payment claims    |

---

## Frontend Data Structure

Config: `client/src/config/tokenDashboard.ts`  
- `TOKEN_CONFIG` — token address, chain, explorer URLs, buy/chart placeholders  
- `VAULT_CONTRACT_CONFIG` — vault contract addresses (empty until deployed)  
- `VAULT_CONFIG` — vault UI metadata  
- `TRANSPARENCY_CONFIG` — includes `vaultContracts` sub-object  

Types: `client/src/lib/tokenDashboard/types.ts`  
- `OnChainTokenMeta` — name, symbol, decimals from chain  
- `RewardContractAddresses` — typed vault address structure  
- `MyDashboardData` — includes `claimableHolderReward`, `earnedLP`, `pendingReferral`  

Hooks: `client/src/hooks/useTokenDashboard.ts`  
- `useOnChainTokenMeta()` — reads name/symbol/decimals from contract  
- `useTokenOverview()` — merges on-chain meta with market data  
- `useMyTokenDashboard()` — returns all reward fields (null until Phase 2)  

Contracts: `client/src/lib/tokenDashboard/contracts.ts`  
- `readOnChainTokenMeta()` — calls name(), symbol(), decimals()  
- `ERC20_ABI` — extended with name/symbol/decimals  
