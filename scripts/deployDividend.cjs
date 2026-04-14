/**
 * CNOVA BSC Mainnet Dividend Deploy Script — v2 (Three-Route Tax)
 *
 * Deploys:
 *   1. HolderDividend.sol         — holder registration + BNB claim accumulator
 *   2. BottomProtectionVault.sol  — buy-in principal return vault (30 % of tax)
 *   3. TaxReceiver.sol v2         — 40 % → HolderDividend, 30 % → BPV, 30 % → studioWallet
 *
 * Wiring:
 *   4. HolderDividend.setTaxReceiver(TaxReceiver)
 *
 * Post-deploy steps:
 *   • Backfill addresses in client/src/config/tokenDashboard.ts
 *   • Set STUDIO_WALLET in token contract as tax receiver once graduated
 *   • Call BottomProtectionVault.setSigner(WATCHER_ADDRESS) after deploying price-signer service
 *
 * Usage:
 *   npx hardhat run scripts/deployDividend.cjs --network bsc
 *
 * Required env vars (.env):
 *   PRIVATE_KEY       — deployer private key (hex, with 0x prefix)
 *   OWNER_ADDRESS     — multisig or EOA that will own all contracts
 *   STUDIO_WALLET     — BNB recipient for 30 % studio route (required)
 *
 * Optional env vars:
 *   MIN_BALANCE_CNOVA — minimum CNOVA to register for HolderDividend (default: 200000)
 *
 * Token address is hardcoded (CNOVA on BSC mainnet):
 *   0x0a9c2e3cda80a828334bfa2577a75a85229f7777
 *
 * Removed from v1:
 *   MARKETING_WALLET  — superseded by STUDIO_WALLET
 *   DIVIDEND_BPS      — ratios are now hard-coded in TaxReceiver (40/30/30)
 *   LPRewardVault     — archived, no longer deployed
 */

const hre = require("hardhat");
require("dotenv/config");

const CNOVA_TOKEN    = process.env.CNOVA_TOKEN || "0x0a9c2e3cda80a828334bfa2577a75a85229f7777";
const CNOVA_DECIMALS = 18n;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network    = await hre.ethers.provider.getNetwork();
  const chainId    = Number(network.chainId);

  if (chainId !== 56) {
    console.warn(`\n⚠️  WARNING: deploying on chain ${chainId}, not BSC mainnet (56).`);
    console.warn("   Pass --network bsc for mainnet, --network bscTestnet for testnet.\n");
  }

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(` CNOVA Three-Route Tax Deploy — chainId ${chainId}`);
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Balance  : ${hre.ethers.formatEther(
    await hre.ethers.provider.getBalance(deployer.address)
  )} BNB`);

  const ownerAddress    = process.env.OWNER_ADDRESS    || deployer.address;
  const studioWallet    = process.env.STUDIO_WALLET    || ownerAddress;
  const minBalanceCnova = BigInt(process.env.MIN_BALANCE_CNOVA ?? 200_000);
  const minimumBalance  = minBalanceCnova * 10n ** CNOVA_DECIMALS;

  if (!process.env.STUDIO_WALLET) {
    console.warn(`\n⚠️  STUDIO_WALLET not set — defaulting to OWNER_ADDRESS (${ownerAddress}).`);
    console.warn("   Set STUDIO_WALLET in .env before mainnet deploy.\n");
  }

  console.log(`\nConfig:`);
  console.log(`  Owner          : ${ownerAddress}`);
  console.log(`  Studio wallet  : ${studioWallet}`);
  console.log(`  Tax split      : 40% HolderDividend / 30% BottomProtection / 30% Studio`);
  console.log(`  Min CNOVA      : ${minBalanceCnova.toString()}`);
  console.log(`  CNOVA token    : ${CNOVA_TOKEN}`);

  // ─────────────────────────────────────────────────
  // Step 1: Deploy HolderDividend
  // ─────────────────────────────────────────────────
  console.log(`\n[1/4] Deploying HolderDividend...`);
  const HolderDividend  = await hre.ethers.getContractFactory("HolderDividend");
  const holderDividend  = await HolderDividend.deploy(CNOVA_TOKEN, minimumBalance, ownerAddress);
  await holderDividend.waitForDeployment();
  const holderDividendAddress = await holderDividend.getAddress();
  console.log(`  ✓ HolderDividend         : ${holderDividendAddress}`);

  // ─────────────────────────────────────────────────
  // Step 2: Deploy BottomProtectionVault
  // ─────────────────────────────────────────────────
  console.log(`\n[2/4] Deploying BottomProtectionVault...`);
  const BottomProtectionVault = await hre.ethers.getContractFactory("BottomProtectionVault");
  const bottomProtectionVault = await BottomProtectionVault.deploy(CNOVA_TOKEN, ownerAddress);
  await bottomProtectionVault.waitForDeployment();
  const bottomProtectionVaultAddress = await bottomProtectionVault.getAddress();
  console.log(`  ✓ BottomProtectionVault  : ${bottomProtectionVaultAddress}`);
  console.log(`    (Call setSigner(watcherAddress) after deploying price-signer service)`);

  // ─────────────────────────────────────────────────
  // Step 3: Deploy TaxReceiver v2 (three-route)
  // ─────────────────────────────────────────────────
  console.log(`\n[3/4] Deploying TaxReceiver v2 (40/30/30)...`);
  const TaxReceiver = await hre.ethers.getContractFactory("TaxReceiver");
  const taxReceiver = await TaxReceiver.deploy(
    holderDividendAddress,
    bottomProtectionVaultAddress,
    studioWallet,
    ownerAddress
  );
  await taxReceiver.waitForDeployment();
  const taxReceiverAddress = await taxReceiver.getAddress();
  console.log(`  ✓ TaxReceiver            : ${taxReceiverAddress}`);
  console.log(`    40% → HolderDividend   : ${holderDividendAddress}`);
  console.log(`    30% → BottomProtection : ${bottomProtectionVaultAddress}`);
  console.log(`    30% → Studio wallet    : ${studioWallet}`);

  // ─────────────────────────────────────────────────
  // Step 4: Wire TaxReceiver into HolderDividend
  // ─────────────────────────────────────────────────
  const isDeployerOwner = deployer.address.toLowerCase() === ownerAddress.toLowerCase();
  if (isDeployerOwner) {
    console.log(`\n[4/4] Setting taxReceiver on HolderDividend...`);
    const hdContract = await hre.ethers.getContractAt("HolderDividend", holderDividendAddress);
    const tx4 = await hdContract.setTaxReceiver(taxReceiverAddress);
    await tx4.wait();
    console.log(`  ✓ setTaxReceiver(${taxReceiverAddress})`);
  } else {
    console.log(`\n[4/4] SKIP — deployer (${deployer.address}) != owner (${ownerAddress}).`);
    console.log(`  ⚠️  Owner must call manually on BSCScan (Write Contract):`);
    console.log(`      Contract : ${holderDividendAddress}`);
    console.log(`      Function : setTaxReceiver`);
    console.log(`      Value    : ${taxReceiverAddress}`);
  }

  // ─────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(` Deployment Complete`);
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`\nBackfill in client/src/config/tokenDashboard.ts:`);
  console.log(`\n  dividendContract        : "${holderDividendAddress}"`);
  console.log(`  masterVault             : "${taxReceiverAddress}"`);
  console.log(`  bottomProtectionVault   : "${bottomProtectionVaultAddress}"`);
  console.log(`\nSet env vars for services:`);
  console.log(`  HOLDER_DIVIDEND_ADDRESS=${holderDividendAddress}`);
  console.log(`  BOTTOM_PROTECTION_ADDRESS=${bottomProtectionVaultAddress}`);
  console.log(`\nBSCScan verify commands:`);
  console.log(`  npx hardhat verify --network bsc ${holderDividendAddress} \\`);
  console.log(`    "${CNOVA_TOKEN}" "${minimumBalance.toString()}" "${ownerAddress}"`);
  console.log(`\n  npx hardhat verify --network bsc ${bottomProtectionVaultAddress} \\`);
  console.log(`    "${CNOVA_TOKEN}" "${ownerAddress}"`);
  console.log(`\n  npx hardhat verify --network bsc ${taxReceiverAddress} \\`);
  console.log(`    "${holderDividendAddress}" "${bottomProtectionVaultAddress}" "${studioWallet}" "${ownerAddress}"`);
  console.log(`\nPost-deploy checklist:`);
  console.log(`  1. Deploy price-signer service, obtain WATCHER_ADDRESS`);
  console.log(`  2. Call BottomProtectionVault.setSigner(WATCHER_ADDRESS)`);
  console.log(`  3. After graduation: set token sell-tax receiver → ${taxReceiverAddress}`);
  console.log(`  4. Call TaxReceiver.flush() periodically (or set up keeper)`);
  console.log(`═══════════════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
