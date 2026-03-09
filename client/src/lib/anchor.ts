import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";

export const PROGRAM_ID_STRING = "CNovAGENT1111111111111111111111111111111111";

export const CNOVA_MINT_STRING = "CNovAMINT11111111111111111111111111111111111";

export const NETWORK = "devnet";

export const RPC_ENDPOINT =
  (import.meta.env.VITE_RPC_ENDPOINT as string) || clusterApiUrl("devnet");

export const PLACEHOLDER_IDL = {
  version: "0.1.0",
  name: "chain_nova",
  instructions: [
    {
      name: "mintAgent",
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "agentMint", writable: true, signer: false },
        { name: "systemProgram", writable: false, signer: false },
      ],
      args: [
        { name: "name", type: "string" },
        { name: "description", type: "string" },
        { name: "tflops", type: "u64" },
        { name: "price", type: "u64" },
      ],
    },
    {
      name: "stake",
      accounts: [
        { name: "staker", writable: true, signer: true },
        { name: "stakeAccount", writable: true, signer: false },
        { name: "systemProgram", writable: false, signer: false },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
    {
      name: "unstake",
      accounts: [
        { name: "staker", writable: true, signer: true },
        { name: "stakeAccount", writable: true, signer: false },
      ],
      args: [],
    },
    {
      name: "rentAgent",
      accounts: [
        { name: "renter", writable: true, signer: true },
        { name: "agentMint", writable: true, signer: false },
        { name: "systemProgram", writable: false, signer: false },
      ],
      args: [{ name: "durationHours", type: "u64" }],
    },
    {
      name: "buyAgent",
      accounts: [
        { name: "buyer", writable: true, signer: true },
        { name: "agentMint", writable: true, signer: false },
        { name: "systemProgram", writable: false, signer: false },
      ],
      args: [],
    },
  ],
  accounts: [],
  errors: [],
  metadata: { address: PROGRAM_ID_STRING },
} as const;

export function getConnection(): Connection {
  return new Connection(RPC_ENDPOINT, "confirmed");
}

export function getProvider(
  connection: Connection,
  wallet: AnchorWallet
): AnchorProvider {
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

export function getProgram(provider: AnchorProvider): Program {
  return new Program(PLACEHOLDER_IDL as any, provider);
}
