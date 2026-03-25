# Solana Wrapped SPL Bridge — PRD (Final)

## Status
- EVM 部分：阶段性通过（BSC ↔ Arbitrum / Ethereum）
- Solana 部分：blocked → 重构中

---

## 补充细节

### 1. transfer_id 生成公式

#### EVM 侧（已部署合约，不可修改）
EVM 合约的 `bridgeOut` 函数生成 transferId：
```
transferId = keccak256(abi.encodePacked(
    msg.sender,       // address — 发起人
    localToken,       // address — 源链 token 地址
    amount,           // uint256 — 金额（18 decimals）
    targetChainId,    // uint256 — 目标链 ID
    recipientBytes32, // bytes32 — 接收方地址
    nonce             // uint256 — 合约内部递增 nonce
))
```

#### Solana 侧（bridge program 新实现）
bridge_out 指令生成 transfer_id：
```
transfer_id = keccak256(
    sender.key           // 32 bytes — Solana 发起人 pubkey
    ++ wforgai_mint.key  // 32 bytes — wFORGAI mint address
    ++ amount_le_u64     // 8 bytes  — 金额（9 decimals, little-endian）
    ++ target_chain_id   // 8 bytes  — 目标链 ID（little-endian u64）
    ++ recipient_bytes32 // 32 bytes — 接收方 EVM 地址（左填充到 32 bytes）
    ++ nonce_le_u64      // 8 bytes  — BridgeConfig.nonce（little-endian u64）
)
```
使用 `solana_program::keccak::hash` 或 `anchor_lang::solana_program::keccak` 计算。
与 EVM 侧使用相同的哈希算法（keccak256），便于 relayer 统一验证。

### 2. recipient_bytes32 编码规则

#### EVM → Solana（complete_transfer）
recipient 为 Solana pubkey（32 bytes），直接作为 bytes32 传递：
```
recipient_bytes32 = solana_pubkey.to_bytes()  // 32 bytes, 无需填充
```

#### Solana → EVM（bridge_out）
recipient 为 EVM address（20 bytes），左填充到 32 bytes：
```
recipient_bytes32 = 0x000000000000000000000000 ++ evm_address  // 12 bytes zero + 20 bytes address
```
与 EVM 合约 `evmAddressToBytes32` 行为一致（`abi.encodePacked(address)` padded to 32 bytes）。

#### 前端编码
- EVM 地址 → bytes32: `viem.pad(address, { size: 32 })`
- Solana pubkey → bytes32: Base58 解码为 32 bytes → hex

### 3. complete_transfer / bridge_out 错误码与失败语义

#### Solana bridge program 错误码

| 错误码 | 名称 | 含义 | 触发条件 |
|--------|------|------|----------|
| 6000 | BridgePaused | 桥已暂停 | BridgeConfig.paused == true |
| 6001 | InvalidSignature | 签名验证失败 | secp256k1 恢复出的 eth address 不匹配 validator |
| 6002 | TransferAlreadyCompleted | 防重放 | TransferRecord.completed == true |
| 6003 | InvalidAmount | 金额无效 | amount == 0 或不是 1e9 整数倍（bridge_out 时 Solana 侧不需要此检查，因为 Solana 精度就是 9 decimals；但 relayer 在构造 complete_transfer 前要校验） |
| 6004 | InvalidTargetChain | 目标链不支持 | target_chain_id 不在白名单 |
| 6005 | InsufficientBalance | 余额不足 | 用户 ATA 余额 < amount（burn 时自然会失败，此为显式检查） |
| 6006 | Unauthorized | 权限不足 | 非 admin 调用 pause/update_validator |

#### 失败语义

**complete_transfer 失败处理**：
- 签名无效 / 已完成：tx 被 Solana runtime 拒绝，不消耗 lamports（除 tx fee）
- relayer 在日志中记录失败原因，不重试已知的 6001/6002 错误
- 对于 6000（暂停），relayer 进入等待状态，每 60s 重试

**bridge_out 失败处理**：
- 余额不足 / 暂停：tx 被拒绝，用户在前端看到错误提示
- 金额校验失败：前端在提交前拦截（精度校验），program 侧做兜底校验

---

## 架构设计

### Token 设计
- **名称**: Wrapped ForgAI (wFORGAI)
- **Decimals**: 9（Solana u64 限制；EVM 18 decimals → 桥接金额必须是 1e9 整数倍）
- **Mint authority**: Bridge Program PDA (`seeds: ["mint-authority"]`)
- **Freeze authority**: Admin keypair（紧急暂停）

### 签名验证
使用 secp256k1，兼容现有 EVM validator 私钥。
Solana 使用 `Secp256k1Program.createInstructionWithEthAddress` 预编译指令验证。

### 权限矩阵

| 权限 | 持有者 | 说明 |
|------|--------|------|
| wFORGAI mint authority | MintAuthorityPDA | 仅 bridge program 可 mint |
| wFORGAI freeze authority | Admin keypair | 紧急冻结 |
| Program upgrade authority | Deployer keypair | 可后续转为 multisig 或销毁 |
| BridgeConfig.admin | Deployer keypair | pause / unpause / update_validator |
| BridgeConfig.validator_eth_address | 0x31bF8708f2E7Bd9eefa57557be8100057132f3eC | 与 EVM 侧共用 |

### Program 账户

```
BridgeConfig (PDA, seeds: ["bridge-config"])
  admin: Pubkey
  validator_eth_address: [u8; 20]
  wforgai_mint: Pubkey
  paused: bool
  nonce: u64

TransferRecord (PDA, seeds: ["transfer", transfer_id])
  completed: bool

MintAuthorityPDA (PDA, seeds: ["mint-authority"])
  (无数据，仅作为签名者)
```

### Program 指令

```
initialize(validator_eth_address, wforgai_mint)
complete_transfer(transfer_id, amount, recipient, validator_signature, recovery_id)
bridge_out(amount, target_chain_id, recipient_bytes32)
pause()
unpause()
update_validator(new_eth_address)
```

术语对齐 EVM 合约：`bridgeOut` + `completeTransfer`。

---

## 实施顺序

```
Phase 0: 禁用旧 Vault Solana 入口（当前步骤）
Phase 1: Solana Anchor bridge program
Phase 2: 后端 watcher / relayer 改造
Phase 3: 前端 + 文档收口
```
