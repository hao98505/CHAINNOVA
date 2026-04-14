/**
 * Phase B — Deploy HolderDividend + BottomProtectionVault, wire into TaxReceiver
 *
 * Run AFTER your token is live and you have its contract address.
 * This script is one-click: deploy → wire → flush → done.
 *
 * Usage:
 *   TAX_RECEIVER_ADDRESS=0x...  \
 *   CNOVA_TOKEN=0x...           \
 *   npx hardhat run scripts/deployDownstream.cjs --network bsc
 *
 * Required env vars:
 *   PRIVATE_KEY            — deployer wallet (must have enough BNB for ~2 deploys + 3 txs)
 *   OWNER_ADDRESS          — owner of TaxReceiver (MUST match TaxReceiver.owner())
 *                            If deployer != owner, setHolderDividend/setBottomProtectionVault
 *                            will be skipped and printed as manual BSCScan steps.
 *   TAX_RECEIVER_ADDRESS   — address from Phase A
 *   CNOVA_TOKEN            — new token contract address
 *
 * Optional:
 *   MIN_BALANCE_CNOVA      — minimum CNOVA to register for dividends (default: 200000)
 *   WATCHER_ADDRESS        — public key of off-chain price signer; if set,
 *                            BottomProtectionVault.setSigner() is called automatically
 *
 * What this script does (atomically, fail-fast):
 *   [1] Deploy HolderDividend(token, minBalance, owner)
 *   [2] Deploy BottomProtectionVault(token, owner)
 *   [3] TaxReceiver.setHolderDividend(HD)           → owner tx
 *   [4] TaxReceiver.setBottomProtectionVault(BPV)   → owner tx (triggers wired=true)
 *   [5] TaxReceiver.flush()                          → distributes any accumulated BNB
 *   [6] HolderDividend.setTaxReceiver(TaxReceiver)  → owner tx
 *   [7] BottomProtectionVault.setSigner(watcher)    → owner tx [optional]
 */

"use strict";
const hre = require("hardhat");
require("dotenv/config");

const TAX_RECEIVER_ABI = [
  "function setHolderDividend(address) external",
  "function setBottomProtectionVault(address) external",
  "function flush() external",
  "function wired() external view returns (bool)",
  "function pendingBalance() external view returns (uint256)",
  "function owner() external view returns (address)",
];

const HOLDER_DIVIDEND_ABI = [
  "function setTaxReceiver(address) external",
  "function owner() external view returns (address)",
];

const BPV_ABI = [
  "function setSigner(address) external",
  "function owner() external view returns (address)",
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network    = await hre.ethers.provider.getNetwork();
  const chainId    = Number(network.chainId);

  // ── Validate env vars ─────────────────────────────────────────────────────
  const taxReceiverAddress = process.env.TAX_RECEIVER_ADDRESS;
  const cnovaToken         = process.env.CNOVA_TOKEN;
  const watcherAddress     = process.env.WATCHER_ADDRESS;

  if (!taxReceiverAddress) {
    console.error("[FATAL] TAX_RECEIVER_ADDRESS is required. Run Phase A first.");
    process.exitCode = 1; return;
  }
  if (!cnovaToken) {
    console.error("[FATAL] CNOVA_TOKEN is required. Obtain the new token address from Flap Portal.");
    process.exitCode = 1; return;
  }

  const ownerAddress    = process.env.OWNER_ADDRESS || deployer.address;
  const minBalanceCnova = BigInt(process.env.MIN_BALANCE_CNOVA ?? 200_000);
  const minimumBalance  = minBalanceCnova * 10n ** 18n;
  const isDeployerOwner = deployer.address.toLowerCase() === ownerAddress.toLowerCase();

  const deployerBal = await hre.ethers.provider.getBalance(deployer.address);

  console.log(`\n╔═══════════════════════════════════════════════════════╗`);
  console.log(` Phase B — Downstream Deploy + Wire`);
  console.log(` Chain    : ${chainId} ${chainId === 56 ? "(BSC Mainnet)" : chainId === 97 ? "(BSC Testnet)" : "(unknown)"}`);
  console.log(` Deployer : ${deployer.address}`);
  console.log(` Balance  : ${hre.ethers.formatEther(deployerBal)} BNB`);
  console.log(` Owner    : ${ownerAddress}${isDeployerOwner ? " (= deployer ✓)" : " (≠ deployer — manual steps needed)"}`);
  console.log(`╚═══════════════════════════════════════════════════════╝\n`);

  console.log(`Config:`);
  console.log(`  TaxReceiver   : ${taxReceiverAddress}`);
  console.log(`  CNOVA token   : ${cnovaToken}`);
  console.log(`  Min balance   : ${minBalanceCnova.toString()} CNOVA`);
  if (watcherAddress) console.log(`  Watcher       : ${watcherAddress}`);
  console.log();

  // ── Step 1: Deploy HolderDividend ─────────────────────────────────────────
  console.log(`[1/6] Deploying HolderDividend...`);
  const HolderDividend = await hre.ethers.getContractFactory("HolderDividend");
  const holderDividend = await HolderDividend.deploy(cnovaToken, minimumBalance, ownerAddress);
  await holderDividend.waitForDeployment();
  const hdAddress = await holderDividend.getAddress();
  const hdTx      = holderDividend.deploymentTransaction();
  console.log(`  ✓ HolderDividend        : ${hdAddress}`);
  console.log(`    Tx                    : ${hdTx?.hash}`);

  // ── Step 2: Deploy BottomProtectionVault ──────────────────────────────────
  console.log(`\n[2/6] Deploying BottomProtectionVault...`);
  const BottomProtectionVault = await hre.ethers.getContractFactory("BottomProtectionVault");
  const bottomProtectionVault = await BottomProtectionVault.deploy(cnovaToken, ownerAddress);
  await bottomProtectionVault.waitForDeployment();
  const bpvAddress = await bottomProtectionVault.getAddress();
  const bpvTx      = bottomProtectionVault.deploymentTransaction();
  console.log(`  ✓ BottomProtectionVault : ${bpvAddress}`);
  console.log(`    Tx                    : ${bpvTx?.hash}`);

  // ── Steps 3–6 require owner wallet ────────────────────────────────────────
  const manualSteps = [];

  if (isDeployerOwner) {
    const taxReceiverContract = new hre.ethers.Contract(taxReceiverAddress, TAX_RECEIVER_ABI, deployer);

    // Step 3: setHolderDividend
    console.log(`\n[3/6] TaxReceiver.setHolderDividend...`);
    const tx3 = await taxReceiverContract.setHolderDividend(hdAddress);
    await tx3.wait();
    console.log(`  ✓ setHolderDividend(${hdAddress})`);
    console.log(`    Tx : ${tx3.hash}`);

    // Step 4: setBottomProtectionVault → triggers wired=true
    console.log(`\n[4/6] TaxReceiver.setBottomProtectionVault...`);
    const tx4 = await taxReceiverContract.setBottomProtectionVault(bpvAddress);
    await tx4.wait();
    const isWired = await taxReceiverContract.wired();
    console.log(`  ✓ setBottomProtectionVault(${bpvAddress})`);
    console.log(`    Tx     : ${tx4.hash}`);
    console.log(`    wired  : ${isWired}`);

    // Step 5: flush (distribute any accumulated BNB)
    const pending = await taxReceiverContract.pendingBalance();
    if (pending > 0n) {
      console.log(`\n[5/6] TaxReceiver.flush() — clearing ${hre.ethers.formatEther(pending)} BNB...`);
      const tx5 = await taxReceiverContract.flush();
      await tx5.wait();
      console.log(`  ✓ flush()`);
      console.log(`    Tx : ${tx5.hash}`);
    } else {
      console.log(`\n[5/6] TaxReceiver.flush() — no pending BNB, skipped.`);
    }

    // Step 6: HolderDividend.setTaxReceiver
    console.log(`\n[6/6] HolderDividend.setTaxReceiver...`);
    const hdContract = new hre.ethers.Contract(hdAddress, HOLDER_DIVIDEND_ABI, deployer);
    const tx6 = await hdContract.setTaxReceiver(taxReceiverAddress);
    await tx6.wait();
    console.log(`  ✓ setTaxReceiver(${taxReceiverAddress})`);
    console.log(`    Tx : ${tx6.hash}`);

    // Step 7 (optional): BPV.setSigner
    if (watcherAddress) {
      console.log(`\n[7/7] BottomProtectionVault.setSigner...`);
      const bpvContract = new hre.ethers.Contract(bpvAddress, BPV_ABI, deployer);
      const tx7 = await bpvContract.setSigner(watcherAddress);
      await tx7.wait();
      console.log(`  ✓ setSigner(${watcherAddress})`);
      console.log(`    Tx : ${tx7.hash}`);
    }

  } else {
    console.log(`\n[3–6] SKIP — deployer (${deployer.address}) ≠ owner (${ownerAddress})`);
    console.log(`  Owner must execute the following on BSCScan (Write Contract → Connect Wallet):\n`);

    manualSteps.push(
      `3. TaxReceiver (${taxReceiverAddress})`,
      `     setHolderDividend("${hdAddress}")`,
      ``,
      `4. TaxReceiver (${taxReceiverAddress})`,
      `     setBottomProtectionVault("${bpvAddress}")`,
      ``,
      `5. TaxReceiver (${taxReceiverAddress})`,
      `     flush()`,
      ``,
      `6. HolderDividend (${hdAddress})`,
      `     setTaxReceiver("${taxReceiverAddress}")`,
    );

    if (watcherAddress) {
      manualSteps.push(
        ``,
        `7. BottomProtectionVault (${bpvAddress})`,
        `     setSigner("${watcherAddress}")`,
      );
    } else {
      manualSteps.push(
        ``,
        `7. BottomProtectionVault (${bpvAddress})`,
        `     setSigner("<WATCHER_ADDRESS>")   ← set WATCHER_ADDRESS env var to automate this`,
      );
    }

    manualSteps.forEach(l => console.log(`  ${l}`));
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n╔═══════════════════════════════════════════════════════╗`);
  console.log(` Deployment Complete`);
  console.log(`╚═══════════════════════════════════════════════════════╝`);
  console.log(`\nAddresses:`);
  console.log(`  TaxReceiver             : ${taxReceiverAddress}`);
  console.log(`  HolderDividend          : ${hdAddress}`);
  console.log(`  BottomProtectionVault   : ${bpvAddress}`);
  console.log(`  CNOVA token             : ${cnovaToken}`);

  const networkName = chainId === 56 ? "bsc" : "bscTestnet";
  console.log(`\nUpdate env vars / chainConfig.ts:`);
  console.log(`  CNOVA_TOKEN=${cnovaToken}`);
  console.log(`  HOLDER_DIVIDEND_ADDRESS=${hdAddress}`);
  console.log(`  BOTTOM_PROTECTION_ADDRESS=${bpvAddress}`);
  console.log(`  TAX_RECEIVER_ADDRESS=${taxReceiverAddress}`);

  console.log(`\nBSCScan verify:`);
  console.log(`  npx hardhat verify --network ${networkName} ${hdAddress} \\`);
  console.log(`    "${cnovaToken}" "${minimumBalance.toString()}" "${ownerAddress}"`);
  console.log(`\n  npx hardhat verify --network ${networkName} ${bpvAddress} \\`);
  console.log(`    "${cnovaToken}" "${ownerAddress}"`);
}

main().catch((err) => {
  console.error("\n[FATAL]", err);
  process.exitCode = 1;
});
