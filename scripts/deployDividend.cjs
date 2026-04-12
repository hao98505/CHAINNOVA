/**
 * Phase 1 BSC Mainnet Dividend Deploy Script
 *
 * Deploys:
 *   1. HolderDividend.sol  — holder registration + BNB claim accumulator
 *   2. TaxReceiver.sol     — single BNB tax sink that forwards to HolderDividend
 *   3. LPRewardVault.sol   — deployed & accumulating; staking NOT active until graduation
 *
 * Wiring:
 *   4. HolderDividend.setTaxReceiver(TaxReceiver)
 *   5. Optionally adjust TaxReceiver allocation bps
 *
 * After deploy:
 *   • Backfill addresses in client/src/config/tokenDashboard.ts
 *   • Run dividend-keeper.ts with HOLDER_DIVIDEND_ADDRESS env var
 *   • Once token graduates: set TaxReceiver as token tax address, call activate(_lpToken) on LPRewardVault
 *
 * Usage:
 *   npx hardhat run scripts/deployDividend.cjs --network bsc
 *
 * Required env vars (.env):
 *   PRIVATE_KEY          — deployer private key (hex, with 0x prefix)
 *   OWNER_ADDRESS        — multisig or EOA that will own all contracts
 *   MARKETING_WALLET     — optional: BNB marketing recipient (default: OWNER_ADDRESS)
 *   DIVIDEND_BPS         — optional: % of tax BNB going to HolderDividend (default: 10000 = 100%)
 *   MIN_BALANCE_CNOVA    — optional: minimum CNOVA to register (default: 200000)
 *
 * Token address is hardcoded (CNOVA on BSC):
 *   0x0a9c2e3cda80a828334bfa2577a75a85229f7777
 */

const hre = require("hardhat");
require("dotenv/config");

const CNOVA_TOKEN   = "0x0a9c2e3cda80a828334bfa2577a75a85229f7777";
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
  console.log(` Phase 1 Dividend Deploy — chainId ${chainId}`);
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Balance  : ${hre.ethers.formatEther(
    await hre.ethers.provider.getBalance(deployer.address)
  )} BNB`);

  const ownerAddress     = process.env.OWNER_ADDRESS    || deployer.address;
  const marketingWallet  = process.env.MARKETING_WALLET || ownerAddress;
  const dividendBps      = Number(process.env.DIVIDEND_BPS ?? 10000);
  const minBalanceCnova  = BigInt(process.env.MIN_BALANCE_CNOVA ?? 200_000);
  const minimumBalance   = minBalanceCnova * 10n ** CNOVA_DECIMALS;

  console.log(`\nConfig:`);
  console.log(`  Owner            : ${ownerAddress}`);
  console.log(`  Marketing wallet : ${marketingWallet}`);
  console.log(`  Dividend bps     : ${dividendBps} / 10000`);
  console.log(`  Min CNOVA        : ${minBalanceCnova.toString()}`);
  console.log(`  CNOVA token      : ${CNOVA_TOKEN}`);

  // ─────────────────────────────────────────────────
  // Step 1: Deploy HolderDividend
  // ─────────────────────────────────────────────────
  console.log(`\n[1/5] Deploying HolderDividend...`);
  const HolderDividend   = await hre.ethers.getContractFactory("HolderDividend");
  const holderDividend   = await HolderDividend.deploy(
    CNOVA_TOKEN, minimumBalance, ownerAddress
  );
  await holderDividend.waitForDeployment();
  const holderDividendAddress = await holderDividend.getAddress();
  console.log(`  ✓ HolderDividend  : ${holderDividendAddress}`);

  // ─────────────────────────────────────────────────
  // Step 2: Deploy TaxReceiver
  // ─────────────────────────────────────────────────
  console.log(`\n[2/5] Deploying TaxReceiver...`);
  const TaxReceiver  = await hre.ethers.getContractFactory("TaxReceiver");
  const taxReceiver  = await TaxReceiver.deploy(
    holderDividendAddress, marketingWallet, ownerAddress
  );
  await taxReceiver.waitForDeployment();
  const taxReceiverAddress = await taxReceiver.getAddress();
  console.log(`  ✓ TaxReceiver     : ${taxReceiverAddress}`);

  // ─────────────────────────────────────────────────
  // Step 3: Deploy LPRewardVault (pre-graduation stub)
  // ─────────────────────────────────────────────────
  console.log(`\n[3/5] Deploying LPRewardVault (inactive — awaiting graduation)...`);
  const LPRewardVault = await hre.ethers.getContractFactory("LPRewardVault");
  const lpRewardVault = await LPRewardVault.deploy(ownerAddress);
  await lpRewardVault.waitForDeployment();
  const lpRewardVaultAddress = await lpRewardVault.getAddress();
  console.log(`  ✓ LPRewardVault   : ${lpRewardVaultAddress}`);
  console.log(`    (active=false — call activate(_lpToken) after graduation)`);

  // ─────────────────────────────────────────────────
  // Step 4: Wire TaxReceiver into HolderDividend
  // ─────────────────────────────────────────────────
  console.log(`\n[4/5] Setting taxReceiver on HolderDividend...`);
  const hdContract = await hre.ethers.getContractAt("HolderDividend", holderDividendAddress);
  const tx4 = await hdContract.setTaxReceiver(taxReceiverAddress);
  await tx4.wait();
  console.log(`  ✓ setTaxReceiver(${taxReceiverAddress})`);

  // ─────────────────────────────────────────────────
  // Step 5: Set allocation if not 100%
  // ─────────────────────────────────────────────────
  if (dividendBps !== 10000) {
    console.log(`\n[5/5] Setting dividendBps to ${dividendBps}...`);
    const trContract = await hre.ethers.getContractAt("TaxReceiver", taxReceiverAddress);
    const tx5 = await trContract.setAllocation(dividendBps);
    await tx5.wait();
    console.log(`  ✓ setAllocation(${dividendBps})`);
  } else {
    console.log(`\n[5/5] dividendBps = 10000, no allocation change needed.`);
  }

  // ─────────────────────────────────────────────────
  // Done — print addresses to backfill
  // ─────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(` Deployment Complete`);
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`\nBackfill in client/src/config/tokenDashboard.ts:`);
  console.log(`\n  dividendContract : "${holderDividendAddress}"`);
  console.log(`  masterVault      : "${taxReceiverAddress}"`);
  console.log(`  lpRewardVault    : "${lpRewardVaultAddress}"`);
  console.log(`  referralVault    : ""  // Phase 2`);
  console.log(`  marketingVault   : ""  // Phase 2`);
  console.log(`\nSet HOLDER_DIVIDEND_ADDRESS env var for dividend-keeper.ts:`);
  console.log(`  HOLDER_DIVIDEND_ADDRESS=${holderDividendAddress}`);
  console.log(`\nBSCScan verify:`);
  console.log(`  npx hardhat verify --network bsc ${holderDividendAddress} \\`);
  console.log(`    "${CNOVA_TOKEN}" "${minimumBalance.toString()}" "${ownerAddress}"`);
  console.log(`\n  npx hardhat verify --network bsc ${taxReceiverAddress} \\`);
  console.log(`    "${holderDividendAddress}" "${marketingWallet}" "${ownerAddress}"`);
  console.log(`\n  npx hardhat verify --network bsc ${lpRewardVaultAddress} \\`);
  console.log(`    "${ownerAddress}"`);
  console.log(`\nNext steps after graduation:`);
  console.log(`  1. Set token sell tax → ${taxReceiverAddress}`);
  console.log(`  2. Call LPRewardVault.activate(<pancake-lp-token-address>)`);
  console.log(`  3. Call TaxReceiver.flush() periodically (or set up keeper)`);
  console.log(`═══════════════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
