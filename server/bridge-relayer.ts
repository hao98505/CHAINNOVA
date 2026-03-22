import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  encodePacked,
  keccak256,
  encodeAbiParameters,
  getAddress,
  type Address,
  type Hash,
  type Log,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const SOURCE_RPC_URL = process.env.SOURCE_RPC_URL;
const TARGET_RPC_URL = process.env.TARGET_RPC_URL;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;
const VALIDATOR_PRIVATE_KEY = process.env.VALIDATOR_PRIVATE_KEY as `0x${string}`;
const SOURCE_BRIDGE = process.env.SOURCE_BRIDGE as Address;
const TARGET_BRIDGE = process.env.TARGET_BRIDGE as Address;
const SOURCE_CHAIN_ID = parseInt(process.env.SOURCE_CHAIN_ID || "56");
const TARGET_CHAIN_ID = parseInt(process.env.TARGET_CHAIN_ID || "204");
const SOURCE_TOKEN = process.env.SOURCE_TOKEN as Address;
const TARGET_WRAPPED_TOKEN = process.env.TARGET_WRAPPED_TOKEN as Address;

if (!SOURCE_RPC_URL || !TARGET_RPC_URL || !RELAYER_PRIVATE_KEY || !VALIDATOR_PRIVATE_KEY) {
  console.error("Missing required environment variables");
  process.exit(1);
}
if (!SOURCE_BRIDGE || !TARGET_BRIDGE || !SOURCE_TOKEN || !TARGET_WRAPPED_TOKEN) {
  console.error("Missing bridge/token addresses");
  process.exit(1);
}

const validatorAccount = privateKeyToAccount(VALIDATOR_PRIVATE_KEY);
const relayerAccount = privateKeyToAccount(RELAYER_PRIVATE_KEY);

const sourceClient = createPublicClient({
  transport: http(SOURCE_RPC_URL),
});

const targetClient = createPublicClient({
  transport: http(TARGET_RPC_URL),
});

const targetWalletClient = createWalletClient({
  account: relayerAccount,
  transport: http(TARGET_RPC_URL),
});

const BRIDGE_TRANSFER_INITIATED_EVENT = parseAbiItem(
  "event BridgeTransferInitiated(bytes32 indexed transferId, address indexed sender, address localToken, uint256 amount, uint256 targetChainId, bytes32 recipientBytes32)"
);

const BRIDGE_ABI = [
  {
    type: "function",
    name: "completeTransfer",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "validatorSignature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "processedTransfers",
    inputs: [{ name: "transferId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
] as const;

function bytes32ToAddress(bytes32: `0x${string}`): Address {
  return getAddress("0x" + bytes32.slice(26)) as Address;
}

async function processTransferEvent(log: Log) {
  try {
    const args = (log as any).args;
    if (!args) return;

    const { transferId, sender, localToken, amount, targetChainId, recipientBytes32 } = args;

    if (Number(targetChainId) !== TARGET_CHAIN_ID) {
      console.log(`[Skip] Transfer ${transferId} targets chain ${targetChainId}, not ${TARGET_CHAIN_ID}`);
      return;
    }

    if (localToken.toLowerCase() !== SOURCE_TOKEN.toLowerCase()) {
      console.log(`[Skip] Transfer ${transferId} uses token ${localToken}, not ${SOURCE_TOKEN}`);
      return;
    }

    console.log(`\n[Process] Transfer ${transferId}`);
    console.log(`  Sender: ${sender}`);
    console.log(`  Amount: ${amount}`);
    console.log(`  Target Chain: ${targetChainId}`);

    const isProcessed = await targetClient.readContract({
      address: TARGET_BRIDGE,
      abi: BRIDGE_ABI,
      functionName: "processedTransfers",
      args: [transferId],
    });

    if (isProcessed) {
      console.log(`  Already processed, skipping`);
      return;
    }

    const recipient = bytes32ToAddress(recipientBytes32);
    console.log(`  Recipient: ${recipient}`);

    const message = encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
      ],
      [transferId, TARGET_WRAPPED_TOKEN, amount, recipient]
    );

    const messageHash = keccak256(message);
    const signature = await validatorAccount.signMessage({
      message: { raw: messageHash as `0x${string}` },
    });

    console.log(`  Signature generated`);
    console.log(`  Submitting completeTransfer to target bridge...`);

    const hash = await targetWalletClient.writeContract({
      address: TARGET_BRIDGE,
      abi: BRIDGE_ABI,
      functionName: "completeTransfer",
      args: [message, signature],
    });

    console.log(`  Tx submitted: ${hash}`);

    const receipt = await targetClient.waitForTransactionReceipt({ hash });
    console.log(`  Tx confirmed in block ${receipt.blockNumber}`);
    console.log(`  Status: ${receipt.status}`);
    console.log(`  Gas used: ${receipt.gasUsed}`);
  } catch (error: any) {
    console.error(`[Error] Processing transfer:`, error.message);
  }
}

async function main() {
  console.log(`\n=== CNova Bridge Relayer ===`);
  console.log(`Source Chain: ${SOURCE_CHAIN_ID}`);
  console.log(`Target Chain: ${TARGET_CHAIN_ID}`);
  console.log(`Source Bridge: ${SOURCE_BRIDGE}`);
  console.log(`Target Bridge: ${TARGET_BRIDGE}`);
  console.log(`Source Token: ${SOURCE_TOKEN}`);
  console.log(`Target Wrapped: ${TARGET_WRAPPED_TOKEN}`);
  console.log(`Relayer: ${relayerAccount.address}`);
  console.log(`Validator: ${validatorAccount.address}`);
  console.log(`\nListening for BridgeTransferInitiated events...\n`);

  sourceClient.watchEvent({
    address: SOURCE_BRIDGE,
    event: BRIDGE_TRANSFER_INITIATED_EVENT,
    onLogs: (logs) => {
      for (const log of logs) {
        processTransferEvent(log);
      }
    },
    onError: (error) => {
      console.error("[WatchError]", error.message);
    },
  });
}

main().catch((error) => {
  console.error("Relayer failed to start:", error);
  process.exit(1);
});
