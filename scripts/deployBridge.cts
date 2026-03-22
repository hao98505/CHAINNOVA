const { ethers } = require("hardhat");
require("dotenv/config");

const CHAIN_LABELS: Record<number, string> = {
  56: "BSC",
  97: "BSC_TESTNET",
  42161: "ARBITRUM",
  1: "ETHEREUM",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const label = CHAIN_LABELS[chainId] || `CHAIN_${chainId}`;

  console.log(`\n=== Deploying to ${label} (chainId: ${chainId}) ===`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} native`);

  const ownerAddress = process.env.OWNER_ADDRESS || deployer.address;
  const validatorAddress = process.env.VALIDATOR_ADDRESS || deployer.address;
  const flatFeeWei = process.env.FLAT_FEE_WEI || "0";

  console.log(`\nConfig:`);
  console.log(`  Owner: ${ownerAddress}`);
  console.log(`  Validator: ${validatorAddress}`);
  console.log(`  Flat Fee: ${flatFeeWei} wei`);

  console.log(`\nDeploying CNovaBridge...`);
  const Bridge = await ethers.getContractFactory("CNovaBridge");
  const bridge = await Bridge.deploy(ownerAddress, validatorAddress, flatFeeWei);
  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();
  console.log(`  CNovaBridge deployed at: ${bridgeAddress}`);

  const isTargetChain = chainId !== 56 && chainId !== 97;

  if (isTargetChain) {
    console.log(`\nDeploying CNovaWrappedToken (target chain)...`);
    const WrappedToken = await ethers.getContractFactory("CNovaWrappedToken");
    const wrapped = await WrappedToken.deploy(
      "Wrapped FORGAI",
      "wFORGAI",
      18,
      ownerAddress
    );
    await wrapped.waitForDeployment();
    const wrappedAddress = await wrapped.getAddress();
    console.log(`  CNovaWrappedToken deployed at: ${wrappedAddress}`);

    console.log(`\nSetting bridge on wrapped token...`);
    const wrappedContract = await ethers.getContractAt("CNovaWrappedToken", wrappedAddress);
    const tx = await wrappedContract.setBridge(bridgeAddress);
    await tx.wait();
    console.log(`  Bridge set on wrapped token ✓`);

    console.log(`\n=== Deployment Complete ===`);
    console.log(`Add to .env:`);
    console.log(`  VITE_BRIDGE_${label}=${bridgeAddress}`);
    console.log(`  VITE_WRAPPED_FORGAI_${label}=${wrappedAddress}`);
  } else {
    console.log(`\n=== Deployment Complete ===`);
    console.log(`Add to .env:`);
    console.log(`  VITE_BRIDGE_${label}=${bridgeAddress}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
