const { ethers } = require("ethers");

async function main() {
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) { console.error("缺少 PRIVATE_KEY"); process.exit(1); }

  const BSC_RPC = process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org";
  const BRIDGE = process.env.BSC_BRIDGE;
  const TOKEN = process.env.SOURCE_TOKEN_BSC || "0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff";
  const TARGET_CHAIN_ID = 42161;
  const AMOUNT = ethers.parseUnits("1", 18);

  if (!BRIDGE) { console.error("缺少 BSC_BRIDGE"); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const recipient = wallet.address;

  console.log("=== BSC → Arbitrum 测试 ===");
  console.log("发送方:", recipient);
  console.log("Bridge:", BRIDGE);
  console.log("Token:", TOKEN);
  console.log("数量: 1 ForgAI");
  console.log("目标链: Arbitrum (42161)");
  console.log("接收方:", recipient);

  const erc20 = new ethers.Contract(TOKEN, [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function decimals() view returns (uint8)",
  ], wallet);

  const balBefore = await erc20.balanceOf(recipient);
  console.log("\nBSC ForgAI 余额（前）:", ethers.formatUnits(balBefore, 18));

  const allowance = await erc20.allowance(recipient, BRIDGE);
  if (allowance < AMOUNT) {
    console.log("\n[1/3] approve bridge...");
    const approveTx = await erc20.approve(BRIDGE, ethers.MaxUint256);
    console.log("  approve tx:", approveTx.hash);
    await approveTx.wait();
    console.log("  approve confirmed ✓");
  } else {
    console.log("\n[1/3] approve: 已有足够授权 ✓");
  }

  const recipientBytes32 = ethers.zeroPadValue(recipient, 32);

  const bridgeContract = new ethers.Contract(BRIDGE, [
    "function bridgeOut(address localToken, uint256 amount, uint256 targetChainId, bytes32 recipientBytes32) payable returns (bytes32)",
  ], wallet);

  console.log("\n[2/3] bridgeOut...");
  const bridgeTx = await bridgeContract.bridgeOut(
    TOKEN,
    AMOUNT,
    TARGET_CHAIN_ID,
    recipientBytes32,
    { value: 0 }
  );
  console.log("  bridgeOut tx:", bridgeTx.hash);
  const receipt = await bridgeTx.wait();
  console.log("  bridgeOut confirmed ✓");
  console.log("  block:", receipt.blockNumber);

  const transferInitiatedTopic = ethers.id("BridgeTransferInitiated(bytes32,address,address,uint256,uint256,bytes32)");
  const eventLog = receipt.logs.find(l => l.topics[0] === transferInitiatedTopic);
  if (eventLog) {
    console.log("  transferId:", eventLog.topics[1]);
  }

  const balAfter = await erc20.balanceOf(recipient);
  console.log("\nBSC ForgAI 余额（后）:", ethers.formatUnits(balAfter, 18));
  console.log("差额:", ethers.formatUnits(balBefore - balAfter, 18));

  console.log("\n[3/3] 等待 EVM relayer 在 Arbitrum 侧 completeTransfer...");
  console.log("  请查看 evm-evm-relayer 日志");

  const arbProvider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc");
  const wrappedToken = new ethers.Contract(
    process.env.WRAPPED_FORGAI_ARBITRUM,
    ["function balanceOf(address) view returns (uint256)"],
    arbProvider,
  );

  console.log("\n  ARB Wrapped ForgAI 余额（前）:", ethers.formatUnits(await wrappedToken.balanceOf(recipient), 18));
  console.log("\n  30 秒后再查一次...");
  await new Promise(r => setTimeout(r, 30000));
  console.log("  ARB Wrapped ForgAI 余额（后）:", ethers.formatUnits(await wrappedToken.balanceOf(recipient), 18));

  console.log("\n=== 测试完成 ===");
}

main().catch(e => { console.error("错误:", e.message); process.exit(1); });
