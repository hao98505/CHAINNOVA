# wFORGAI Bridge Program — Specification

## Program ID
`5EApB5fWMEBzFX4HFePxokLTR3yddHpM1z7VyMuC3GpZ` (placeholder — replace after `anchor build` keygen)

## Token: Wrapped ForgAI (wFORGAI)
- **Decimals**: 9 (Solana u64 constraint)
- **Mint authority**: MintAuthorityPDA (`seeds: ["mint-authority"]`)
- **Bridge amounts**: Must be multiples of 1e9 (1_000_000_000)
- **EVM↔Solana conversion**: EVM 18 decimals ÷ 1e9 = Solana 9 decimals

## Accounts

### BridgeConfig (PDA, seeds: `["bridge-config"]`)
| Field | Type | Description |
|-------|------|-------------|
| admin | Pubkey | Can pause/unpause/update_validator |
| validator_eth_address | [u8; 20] | EVM validator for secp256k1 signature verification |
| wforgai_mint | Pubkey | wFORGAI SPL mint address |
| paused | bool | Emergency pause flag |
| nonce | u64 | Monotonic counter for transfer_id uniqueness |

### TransferRecord (PDA, seeds: `["transfer", transfer_id]`)
| Field | Type | Description |
|-------|------|-------------|
| completed | bool | Replay protection — true after complete_transfer |

### MintAuthorityPDA (PDA, seeds: `["mint-authority"]`)
No data — used only as CPI signer for mint operations.

## Instructions

### `initialize(validator_eth_address: [u8; 20])`
Creates BridgeConfig PDA. Sets admin = caller, nonce = 0, paused = false.

### `complete_transfer(transfer_id, amount, recipient, signature, recovery_id)`
EVM → Solana direction. Mints wFORGAI to recipient's ATA.
1. Check bridge not paused
2. Verify secp256k1 signature against stored validator_eth_address
3. Init TransferRecord PDA (replay protection — fails if already exists)
4. CPI: mint_to recipient ATA via MintAuthorityPDA

### `bridge_out(amount, target_chain_id, recipient_bytes32)`
Solana → EVM direction. Burns wFORGAI from sender's ATA.
1. Check bridge not paused
2. Validate amount > 0 AND amount % 1_000_000_000 == 0
3. Validate target_chain_id ∈ {56, 42161, 1}
4. Check sender balance ≥ amount
5. CPI: burn from sender ATA
6. Compute transfer_id, increment nonce
7. Emit log for relayer pickup

### `pause()` / `unpause()`
Admin-only. Sets BridgeConfig.paused.

### `update_validator(new_eth_address: [u8; 20])`
Admin-only. Updates the validator address for signature verification.

## transfer_id Formula

### Solana side (bridge_out)
```
transfer_id = keccak256(
    sender.key           // 32 bytes — Solana pubkey
    ++ wforgai_mint.key  // 32 bytes — wFORGAI mint address
    ++ amount_le_u64     //  8 bytes — little-endian
    ++ target_chain_id   //  8 bytes — little-endian u64
    ++ recipient_bytes32 // 32 bytes — left-padded EVM address
    ++ nonce_le_u64      //  8 bytes — little-endian u64
)
```
Total: 120 bytes input → 32 bytes keccak256 output.

### EVM side (bridgeOut — already deployed, immutable)
```
transferId = keccak256(abi.encodePacked(
    msg.sender,       // address (20 bytes)
    localToken,       // address (20 bytes)
    amount,           // uint256 (32 bytes)
    targetChainId,    // uint256 (32 bytes)
    recipientBytes32, // bytes32 (32 bytes)
    nonce             // uint256 (32 bytes)
))
```

## recipient_bytes32 Encoding

### EVM → Solana (complete_transfer)
Recipient is a Solana pubkey (32 bytes). No padding needed:
```
recipient_bytes32 = solana_pubkey.to_bytes()  // 32 bytes
```

### Solana → EVM (bridge_out)
Recipient is an EVM address (20 bytes), left-padded to 32 bytes:
```
recipient_bytes32 = 0x000000000000000000000000 ++ evm_address
                    (12 zero bytes)              (20 bytes)
```

### Frontend encoding
- EVM address → bytes32: `viem.pad(address, { size: 32 })`
- Solana pubkey → bytes32: base58 decode → 32 bytes → hex

## Error Codes

| Code | Name | Trigger |
|------|------|---------|
| 6000 | BridgePaused | BridgeConfig.paused == true |
| 6001 | InvalidSignature | secp256k1 recovery doesn't match validator_eth_address |
| 6002 | TransferAlreadyCompleted | TransferRecord PDA already initialized |
| 6003 | InvalidAmount | amount == 0 OR amount % 1e9 != 0 (bridge_out only) |
| 6004 | InvalidTargetChain | target_chain_id not in {56, 42161, 1} |
| 6005 | InsufficientBalance | sender ATA balance < amount |
| 6006 | Unauthorized | non-admin calls pause/unpause/update_validator |

## Failure Semantics

### complete_transfer failures
- **6001 InvalidSignature**: tx rejected, no state change. Relayer logs and does not retry.
- **6002 TransferAlreadyCompleted**: TransferRecord PDA init fails (account exists). Relayer skips.
- **6000 BridgePaused**: tx rejected. Relayer enters wait loop (60s interval).

### bridge_out failures
- **6003 InvalidAmount**: tx rejected. Frontend should validate before submission.
- **6004 InvalidTargetChain**: tx rejected. Frontend only shows valid chains.
- **6005 InsufficientBalance**: tx rejected. Frontend shows balance error.
- **6000 BridgePaused**: tx rejected. Frontend shows maintenance message.

## Signature Verification (complete_transfer)
1. Build message: `transfer_id ++ amount_le_u64 ++ recipient_pubkey ++ mint_pubkey` (104 bytes)
2. Hash: `keccak256(message)` → 32 bytes
3. Recover: `secp256k1_recover(hash, recovery_id, signature)` → 64-byte public key
4. Derive ETH address: `keccak256(recovered_pubkey)[12..32]` → 20 bytes
5. Compare with `BridgeConfig.validator_eth_address`

## Supported Chains
| Chain | ID | Direction |
|-------|----|-----------|
| BSC | 56 | bridge_out target |
| Arbitrum | 42161 | bridge_out target |
| Ethereum | 1 | bridge_out target |
