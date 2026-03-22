# Bridge v3 · Solana ↔ EVM 跨链桥

## 概述

Custodial MVP 版本。支持 Solana 原生 ForgAI (SPL Token) 与 BSC / Arbitrum / Ethereum 三条 EVM 链上的 wrapped ForgAI 之间的双向桥接。

**Solana Mint**: `6ZcR1KCqVZDLzSoUbiPW8P6XUvrazxMtUZTa9csppump`

## 架构

```
Solana                          BSC / Arbitrum / Ethereum
┌──────────────┐                ┌──────────────┐
│ Vault ATA    │                │ CNovaBridge  │
│ (custodial)  │                │ + wForgAI    │
└──────────────┘                └──────────────┘
       ↑↓                             ↑↓
   Solana Watcher              EVM Bridge Relayer
   (server/solana-watcher.ts)  (server/bridge-relayer.ts)
```

## 流程

### Solana → EVM
1. 用户连接 Phantom/Solflare
2. 用户输入目标 EVM 链和 EVM 地址
3. 前端发起 SPL Token 转账到项目 Vault ATA，memo 带目标链和地址
4. Solana Watcher 检测到 Vault 入账
5. Watcher 解析 memo，向目标 EVM 链 bridge 合约调用 `completeTransfer()` 铸币
6. 用户在目标链收到 wForgAI

### EVM → Solana
1. 用户连接 MetaMask，选择源 EVM 链
2. 用户 approve wrapped token，然后调用 `bridgeOut()`
3. EVM Bridge Relayer 检测到 `BridgeTransferInitiated` 事件
4. Relayer 解析目标 Solana 地址
5. Relayer 从 Vault ATA 向用户 Solana 地址转出 SPL Token
6. 如果用户 ATA 不存在，Relayer 自动创建

## 部署

### 1. 编译合约
```bash
npm run bridge:compile
```

### 2. 部署到各链
```bash
npm run bridge:deploy:bsc
npm run bridge:deploy:arb
# Ethereum 同理
```

### 3. 配置路由
```bash
npm run bridge:config:bsc
npm run bridge:config:arb
```

### 4. 设置环境变量
参考 `.env.example` 设置所有 `VITE_*` 和后端变量。

### 5. 启动服务
```bash
npm run bridge:watch:solana   # Solana → EVM 方向
npm run bridge:relayer        # EVM → Solana / EVM→EVM 方向
```

## 安全风险与当前信任模型

⚠️ **这是 Custodial MVP，不是去中心化桥。**

- Solana → EVM 方向：用户将 SPL Token 转入项目控制的 Vault ATA，依赖 Relayer 诚实铸币
- EVM → Solana 方向：用户 burn wrapped token，依赖 Relayer 诚实从 Vault 转出
- Vault 私钥 = 单点信任，如私钥泄露可导致资金损失
- 无 on-chain 验证，无多签，无时间锁
- **仅用于测试/MVP 阶段，不要桥接大额资金**

未来路线：
- 引入多签 Vault
- Solana on-chain program 做 escrow
- EVM 端增加时间锁和争议机制

## 持久化

Relayer 和 Watcher 使用本地 JSON 文件持久化：
- `bridge-state.json` — Solana Watcher 状态
- `bridge-evm-state.json` — EVM Relayer 状态

包含：
- `processedSolanaSignatures` / `processedEvmTransferIds` — 防重放
- `lastScannedSlot` / `lastScannedBlock` — 断点续扫
- `pendingFailed` — 失败任务记录

## 文件清单

| 文件 | 用途 |
|------|------|
| `client/src/pages/Bridge.tsx` | Bridge v3 双向 UI |
| `client/src/lib/solanaBridge.ts` | Solana SPL 存款逻辑 |
| `client/src/lib/evmBridge.ts` | EVM wrapped token 操作 |
| `client/src/lib/bridgeRouter.ts` | 统一路由层 |
| `contracts/CNovaBridge.sol` | EVM Bridge 合约 |
| `contracts/CNovaWrappedToken.sol` | Wrapped ERC20 token |
| `hardhat.config.cts` | Hardhat 配置 |
| `scripts/deployBridge.ts` | 部署脚本 |
| `scripts/configureRoutes.ts` | 路由配置脚本 |
| `server/solana-watcher.ts` | Solana Vault 入账监听 |
| `server/bridge-relayer.ts` | EVM 事件监听 + 双向 Relayer |
