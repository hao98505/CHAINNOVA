const { createPublicClient, createWalletClient, http, parseAbiItem, encodeAbiParameters, keccak256, parseUnits, formatUnits, padHex } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { bsc, arbitrum, mainnet } = require("viem/chains");

const BRIDGE = "0x49daa7A1109d061BF67b56676def0Bc439289Cb8";
const BSC_TOKEN = "0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff";
const WRAPPED_TOKEN = "0x1452280dDa6Fa4C815f95B06cc15d429aEb0d917";
const RECIPIENT = "0x31bF8708f2E7Bd9eefa57557be8100057132f3eC";

const APPROVE_ABI = [{ type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" }];
const BRIDGE_OUT_ABI = [{ type: "function", name: "bridgeOut", inputs: [{ name: "localToken", type: "address" }, { name: "amount", type: "uint256" }, { name: "targetChainId", type: "uint256" }, { name: "recipientBytes32", type: "bytes32" }], outputs: [{ type: "bytes32" }], stateMutability: "payable" }];
const COMPLETE_ABI = [{ type: "function", name: "completeTransfer", inputs: [{ name: "message", type: "bytes" }, { name: "validatorSignature", type: "bytes" }], outputs: [], stateMutability: "nonpayable" }];
const BALANCE_ABI = [{ type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" }];

const account = privateKeyToAccount(process.env.PRIVATE_KEY);

const chainDefs = {
  BSC: { chain: bsc, rpc: "https://bsc-rpc.publicnode.com", token: BSC_TOKEN },
  ARB: { chain: arbitrum, rpc: "https://arb1.arbitrum.io/rpc", token: WRAPPED_TOKEN },
  ETH: { chain: mainnet, rpc: "https://ethereum-rpc.publicnode.com", token: WRAPPED_TOKEN },
};

function pub(name) { return createPublicClient({ chain: chainDefs[name].chain, transport: http(chainDefs[name].rpc) }); }
function wal(name) { return createWalletClient({ account, chain: chainDefs[name].chain, transport: http(chainDefs[name].rpc) }); }

async function getBalance(chainName) {
  const b = await pub(chainName).readContract({ address: chainDefs[chainName].token, abi: BALANCE_ABI, functionName: "balanceOf", args: [RECIPIENT] });
  return formatUnits(b, 18);
}

async function bridgeOut(srcChain, targetChainId) {
  const p = pub(srcChain); const w = wal(srcChain);
  const token = chainDefs[srcChain].token;
  const amount = parseUnits("1", 18);
  const recipientBytes32 = padHex(RECIPIENT, { size: 32 });

  const appHash = await w.writeContract({ address: token, abi: APPROVE_ABI, functionName: "approve", args: [BRIDGE, amount] });
  await p.waitForTransactionReceipt({ hash: appHash });
  console.log("  approve tx:", appHash);

  const boHash = await w.writeContract({ address: BRIDGE, abi: BRIDGE_OUT_ABI, functionName: "bridgeOut", args: [token, amount, BigInt(targetChainId), recipientBytes32], value: 0n });
  const receipt = await p.waitForTransactionReceipt({ hash: boHash });
  console.log("  bridgeOut tx:", boHash);
  console.log("  block:", receipt.blockNumber.toString());

  const evLog = receipt.logs.find(l => l.topics[0] === "0x3af028e05d8683a7429fca9e87ecfe92a505ec3f5824ecf6bc242dfb31abecc7");
  const transferId = evLog ? evLog.topics[1] : null;
  console.log("  transferId:", transferId);
  return transferId;
}

async function completeTransfer(targetChain, transferId) {
  const p = pub(targetChain); const w = wal(targetChain);
  const targetToken = chainDefs[targetChain].token;
  const amount = parseUnits("1", 18);

  const message = encodeAbiParameters(
    [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }, { type: "address" }],
    [transferId, targetToken, amount, RECIPIENT]
  );
  const messageHash = keccak256(message);
  const sig = await account.signMessage({ message: { raw: messageHash } });

  const hash = await w.writeContract({ address: BRIDGE, abi: COMPLETE_ABI, functionName: "completeTransfer", args: [message, sig] });
  const receipt = await p.waitForTransactionReceipt({ hash });
  console.log("  completeTransfer tx:", hash);
  console.log("  status:", receipt.status, "block:", receipt.blockNumber.toString());
}

async function runTest(testNum, label, srcChain, targetChain, targetChainId) {
  console.log("\n" + "=".repeat(50));
  console.log("验收 " + testNum + "/3: " + label);
  console.log("=".repeat(50));

  const srcBefore = await getBalance(srcChain);
  const dstBefore = await getBalance(targetChain);
  console.log("\n源链 " + srcChain + " 余额（前）:", srcBefore);
  console.log("目标链 " + targetChain + " 余额（前）:", dstBefore);

  console.log("\n--- 源链 bridgeOut ---");
  const transferId = await bridgeOut(srcChain, targetChainId);

  console.log("\n--- 目标链 completeTransfer ---");
  await completeTransfer(targetChain, transferId);

  const srcAfter = await getBalance(srcChain);
  const dstAfter = await getBalance(targetChain);
  console.log("\n源链 " + srcChain + " 余额（后）:", srcAfter);
  console.log("目标链 " + targetChain + " 余额（后）:", dstAfter);
  console.log("源链差额:", (parseFloat(srcBefore) - parseFloat(srcAfter)).toFixed(1));
  console.log("目标链差额:", (parseFloat(dstAfter) - parseFloat(dstBefore)).toFixed(1));
}

async function main() {
  console.log("Validator/Relayer:", account.address);

  await runTest("1", "ARB → BSC", "ARB", "BSC", 56);
  await runTest("2", "BSC → ETH", "BSC", "ETH", 1);
  await runTest("3", "ETH → BSC", "ETH", "BSC", 56);

  console.log("\n" + "=".repeat(50));
  console.log("全部 3 组验收测试完成");
  console.log("=".repeat(50));
}

main().catch(e => { console.error("FATAL:", e.message || e); process.exit(1); });
