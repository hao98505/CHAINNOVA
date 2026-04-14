/**
 * Phase A — Deploy TaxReceiver (standalone, no downstream required)
 *
 * Run BEFORE launching your token on Flap Portal.
 * The printed TaxReceiver address is what you paste into the Flap launch page.
 *
 * Usage:
 *   npx hardhat run scripts/deployTaxReceiver.cjs --network bsc
 *
 * Required env vars:
 *   PRIVATE_KEY     — deployer wallet (hex, 0x-prefixed); needs BNB for gas
 *   OWNER_ADDRESS   — wallet that will call setHolderDividend / setBottomProtectionVault
 *                     in Phase B (can be same as deployer)
 *
 * studioWallet is hard-coded to STUDIO_WALLET below.
 * It receives 30 % of every flush and is immutable after deploy.
 *
 * What happens after this script:
 *   → Go to Flap Portal → Create Token → Tax Wallet = printed TaxReceiver address.
 *   → Once you have the new token's contract address, run deployDownstream.cjs.
 */

"use strict";
const hre = require("hardhat");
require("dotenv/config");

const STUDIO_WALLET = "0x73c68029c2b66c8495c4d2943d39586e2a10c24e";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network    = await hre.ethers.provider.getNetwork();
  const chainId    = Number(network.chainId);

  const deployerBal = await hre.ethers.provider.getBalance(deployer.address);

  console.log(`\n╔═══════════════════════════════════════════════════════╗`);
  console.log(` Phase A — TaxReceiver Standalone Deploy`);
  console.log(` Chain    : ${chainId} ${chainId === 56 ? "(BSC Mainnet)" : chainId === 97 ? "(BSC Testnet)" : "(unknown)"}`);
  console.log(` Deployer : ${deployer.address}`);
  console.log(` Balance  : ${hre.ethers.formatEther(deployerBal)} BNB`);
  console.log(`╚═══════════════════════════════════════════════════════╝\n`);

  if (chainId !== 56 && chainId !== 97) {
    console.warn(`⚠️  WARNING: not BSC mainnet or testnet (chainId=${chainId}). Proceeding anyway.\n`);
  }

  const ownerAddress = process.env.OWNER_ADDRESS || deployer.address;
  if (!process.env.OWNER_ADDRESS) {
    console.warn(`⚠️  OWNER_ADDRESS not set — defaulting to deployer (${deployer.address}).\n`);
  }

  console.log(`Config:`);
  console.log(`  Owner         : ${ownerAddress}`);
  console.log(`  Studio wallet : ${STUDIO_WALLET}  (immutable, 30 % of flush)`);
  console.log(`  HD / BPV      : (none — will be set in Phase B)\n`);

  console.log(`[1/1] Deploying TaxReceiver v3...`);
  const TaxReceiver = await hre.ethers.getContractFactory("TaxReceiver");
  const taxReceiver = await TaxReceiver.deploy(STUDIO_WALLET, ownerAddress);
  await taxReceiver.waitForDeployment();
  const taxReceiverAddress = await taxReceiver.getAddress();

  const deployTx = taxReceiver.deploymentTransaction();
  console.log(`  ✓ TaxReceiver : ${taxReceiverAddress}`);
  console.log(`    Tx hash     : ${deployTx?.hash}`);

  console.log(`\n╔═══════════════════════════════════════════════════════╗`);
  console.log(` NEXT STEP — paste this into Flap Portal "Tax Wallet":  `);
  console.log(``);
  console.log(`   ${taxReceiverAddress}`);
  console.log(``);
  console.log(` After you get your new token address, run:             `);
  console.log(`   TAX_RECEIVER_ADDRESS=${taxReceiverAddress} \\`);
  console.log(`   CNOVA_TOKEN=<your_new_token_address> \\`);
  console.log(`   npx hardhat run scripts/deployDownstream.cjs --network bsc`);
  console.log(`╚═══════════════════════════════════════════════════════╝\n`);

  console.log(`BSCScan verify:`);
  console.log(`  npx hardhat verify --network ${chainId === 56 ? "bsc" : "bscTestnet"} \\`);
  console.log(`    ${taxReceiverAddress} "${STUDIO_WALLET}" "${ownerAddress}"\n`);

  return taxReceiverAddress;
}

main().catch((err) => {
  console.error("\n[FATAL]", err);
  process.exitCode = 1;
});
