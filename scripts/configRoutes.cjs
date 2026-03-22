const hre = require("hardhat");
require("dotenv/config");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log(`\n=== Configuring Routes on ${network.name} (chainId: ${chainId}) ===`);

  const FORGAI_BSC = "0x3e9fc4f2acf5d6f7815cb9f38b2c69576088ffff";

  let bridgeAddress, localToken, remoteToken, wrapped;

  if (chainId === 56 || chainId === 97) {
    bridgeAddress = process.env.VITE_BRIDGE_BSC || process.env.BSC_BRIDGE || "";
    localToken = FORGAI_BSC;
    remoteToken = FORGAI_BSC;
    wrapped = false;
    console.log(`  BSC source chain config`);
  } else if (chainId === 42161) {
    bridgeAddress = process.env.VITE_BRIDGE_ARBITRUM || process.env.ARBITRUM_BRIDGE || "";
    localToken = process.env.VITE_WRAPPED_FORGAI_ARBITRUM || process.env.WRAPPED_FORGAI_ARBITRUM || "";
    remoteToken = FORGAI_BSC;
    wrapped = true;
    console.log(`  Arbitrum target chain config`);
  } else if (chainId === 1) {
    bridgeAddress = process.env.VITE_BRIDGE_ETHEREUM || process.env.ETHEREUM_BRIDGE || "";
    localToken = process.env.VITE_WRAPPED_FORGAI_ETHEREUM || process.env.WRAPPED_FORGAI_ETHEREUM || "";
    remoteToken = FORGAI_BSC;
    wrapped = true;
    console.log(`  Ethereum target chain config`);
  } else {
    throw new Error(`Unknown chainId: ${chainId}`);
  }

  if (!bridgeAddress) throw new Error("Bridge address not configured in env");
  if (!localToken) throw new Error("Local token not configured");
  if (!remoteToken) throw new Error("Remote token not configured");

  console.log(`  Bridge: ${bridgeAddress}`);
  console.log(`  Local Token: ${localToken}`);
  console.log(`  Remote Token: ${remoteToken}`);
  console.log(`  Wrapped: ${wrapped}`);

  const bridge = await hre.ethers.getContractAt("CNovaBridge", bridgeAddress);
  const tx = await bridge.configureRoute(localToken, remoteToken, wrapped);
  await tx.wait();

  console.log(`\n  Route configured ✓`);
  console.log(`  Tx: ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
