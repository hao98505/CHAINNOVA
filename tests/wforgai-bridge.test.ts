import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { WforgaiBridge } from "../target/types/wforgai_bridge";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";
import { keccak256 } from "ethereum-cryptography/keccak";
import { secp256k1 } from "ethereum-cryptography/secp256k1";

const MINT_AUTHORITY_SEED = Buffer.from("mint-authority");
const BRIDGE_CONFIG_SEED = Buffer.from("bridge-config");
const TRANSFER_SEED = Buffer.from("transfer");

function ethAddressFromPrivateKey(privKey: Uint8Array): Uint8Array {
  const pubKey = secp256k1.getPublicKey(privKey, false).slice(1);
  const hash = keccak256(pubKey);
  return hash.slice(12, 32);
}

describe("wforgai-bridge", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.WforgaiBridge as Program<WforgaiBridge>;

  const admin = provider.wallet as anchor.Wallet;
  const validatorPrivKey = Keypair.generate().secretKey.slice(0, 32);
  const validatorEthAddress = ethAddressFromPrivateKey(
    new Uint8Array(validatorPrivKey)
  );

  let wforgaiMint: PublicKey;
  let mintAuthorityPda: PublicKey;
  let mintAuthorityBump: number;
  let bridgeConfigPda: PublicKey;

  before(async () => {
    [mintAuthorityPda, mintAuthorityBump] = PublicKey.findProgramAddressSync(
      [MINT_AUTHORITY_SEED],
      program.programId
    );
    [bridgeConfigPda] = PublicKey.findProgramAddressSync(
      [BRIDGE_CONFIG_SEED],
      program.programId
    );

    wforgaiMint = await createMint(
      provider.connection,
      admin.payer,
      mintAuthorityPda,
      null,
      9
    );
  });

  describe("initialize", () => {
    it("succeeds with valid mint (decimals=9, authority=PDA)", async () => {
      await program.methods
        .initialize(Array.from(validatorEthAddress) as any)
        .accounts({
          admin: admin.publicKey,
          bridgeConfig: bridgeConfigPda,
          wforgaiMint: wforgaiMint,
          mintAuthority: mintAuthorityPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const config = await program.account.bridgeConfig.fetch(bridgeConfigPda);
      expect(config.admin.toBase58()).to.equal(admin.publicKey.toBase58());
      expect(config.paused).to.equal(false);
      expect(config.nonce.toNumber()).to.equal(0);
      expect(Buffer.from(config.validatorEthAddress)).to.deep.equal(
        Buffer.from(validatorEthAddress)
      );
    });

    it("rejects mint with wrong decimals", async () => {
      const wrongMint = await createMint(
        provider.connection,
        admin.payer,
        mintAuthorityPda,
        null,
        6
      );
      try {
        await program.methods
          .initialize(Array.from(validatorEthAddress) as any)
          .accounts({
            admin: admin.publicKey,
            bridgeConfig: bridgeConfigPda,
            wforgaiMint: wrongMint,
            mintAuthority: mintAuthorityPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have thrown InvalidMintDecimals");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidMintDecimals");
      }
    });

    it("rejects mint with wrong authority", async () => {
      const wrongAuthority = Keypair.generate();
      const wrongMint = await createMint(
        provider.connection,
        admin.payer,
        wrongAuthority.publicKey,
        null,
        9
      );
      try {
        await program.methods
          .initialize(Array.from(validatorEthAddress) as any)
          .accounts({
            admin: admin.publicKey,
            bridgeConfig: bridgeConfigPda,
            wforgaiMint: wrongMint,
            mintAuthority: mintAuthorityPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have thrown InvalidMintAuthority");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidMintAuthority");
      }
    });
  });

  describe("pause / unpause", () => {
    it("admin can pause", async () => {
      await program.methods
        .pause()
        .accounts({
          admin: admin.publicKey,
          bridgeConfig: bridgeConfigPda,
        })
        .rpc();
      const config = await program.account.bridgeConfig.fetch(bridgeConfigPda);
      expect(config.paused).to.equal(true);
    });

    it("admin can unpause", async () => {
      await program.methods
        .unpause()
        .accounts({
          admin: admin.publicKey,
          bridgeConfig: bridgeConfigPda,
        })
        .rpc();
      const config = await program.account.bridgeConfig.fetch(bridgeConfigPda);
      expect(config.paused).to.equal(false);
    });

    it("non-admin cannot pause", async () => {
      const attacker = Keypair.generate();
      const airdropSig = await provider.connection.requestAirdrop(
        attacker.publicKey,
        LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      try {
        await program.methods
          .pause()
          .accounts({
            admin: attacker.publicKey,
            bridgeConfig: bridgeConfigPda,
          })
          .signers([attacker])
          .rpc();
        expect.fail("Should have thrown Unauthorized");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("Unauthorized");
      }
    });
  });

  describe("bridge_out", () => {
    let senderAta: PublicKey;
    const recipient = Buffer.alloc(32);
    recipient.set(
      Buffer.from("31bF8708f2E7Bd9eefa57557be8100057132f3eC", "hex"),
      12
    );

    before(async () => {
      const ata = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        wforgaiMint,
        admin.publicKey
      );
      senderAta = ata.address;
    });

    it("rejects amount not divisible by 1e9", async () => {
      try {
        await program.methods
          .bridgeOut(
            new anchor.BN(1_500_000_000),
            new anchor.BN(56),
            Array.from(recipient) as any
          )
          .accounts({
            sender: admin.publicKey,
            bridgeConfig: bridgeConfigPda,
            wforgaiMint: wforgaiMint,
            senderAta: senderAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have thrown InvalidAmount");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidAmount");
      }
    });

    it("rejects zero amount", async () => {
      try {
        await program.methods
          .bridgeOut(
            new anchor.BN(0),
            new anchor.BN(56),
            Array.from(recipient) as any
          )
          .accounts({
            sender: admin.publicKey,
            bridgeConfig: bridgeConfigPda,
            wforgaiMint: wforgaiMint,
            senderAta: senderAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have thrown InvalidAmount");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidAmount");
      }
    });

    it("rejects unsupported target chain", async () => {
      try {
        await program.methods
          .bridgeOut(
            new anchor.BN(1_000_000_000),
            new anchor.BN(137),
            Array.from(recipient) as any
          )
          .accounts({
            sender: admin.publicKey,
            bridgeConfig: bridgeConfigPda,
            wforgaiMint: wforgaiMint,
            senderAta: senderAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have thrown InvalidTargetChain");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidTargetChain");
      }
    });

    it("rejects when bridge is paused", async () => {
      await program.methods
        .pause()
        .accounts({ admin: admin.publicKey, bridgeConfig: bridgeConfigPda })
        .rpc();

      try {
        await program.methods
          .bridgeOut(
            new anchor.BN(1_000_000_000),
            new anchor.BN(56),
            Array.from(recipient) as any
          )
          .accounts({
            sender: admin.publicKey,
            bridgeConfig: bridgeConfigPda,
            wforgaiMint: wforgaiMint,
            senderAta: senderAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have thrown BridgePaused");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("BridgePaused");
      }

      await program.methods
        .unpause()
        .accounts({ admin: admin.publicKey, bridgeConfig: bridgeConfigPda })
        .rpc();
    });
  });

  describe("complete_transfer", () => {
    it("rejects invalid signature", async () => {
      const transferId = Buffer.alloc(32, 0xaa);
      const amount = new anchor.BN(1_000_000_000);
      const recipient = admin.publicKey;

      const [transferRecordPda] = PublicKey.findProgramAddressSync(
        [TRANSFER_SEED, transferId],
        program.programId
      );

      const recipientAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        wforgaiMint,
        recipient
      );

      const fakeSig = new Uint8Array(64).fill(0x01);
      const fakeRecoveryId = 0;

      try {
        await program.methods
          .completeTransfer(
            Array.from(transferId) as any,
            amount,
            recipient,
            Array.from(fakeSig) as any,
            fakeRecoveryId
          )
          .accounts({
            payer: admin.publicKey,
            bridgeConfig: bridgeConfigPda,
            transferRecord: transferRecordPda,
            wforgaiMint: wforgaiMint,
            mintAuthority: mintAuthorityPda,
            recipientAta: recipientAta.address,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have thrown InvalidSignature");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidSignature");
      }
    });

    it("succeeds with valid validator signature", async () => {
      const transferId = Buffer.alloc(32, 0xbb);
      const amount = new anchor.BN(2_000_000_000);
      const recipient = admin.publicKey;

      const [transferRecordPda] = PublicKey.findProgramAddressSync(
        [TRANSFER_SEED, transferId],
        program.programId
      );

      const recipientAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        wforgaiMint,
        recipient
      );

      let message = Buffer.alloc(104);
      transferId.copy(message, 0);
      message.writeBigUInt64LE(BigInt(amount.toString()), 32);
      recipient.toBuffer().copy(message, 40);
      wforgaiMint.toBuffer().copy(message, 72);

      const msgHash = keccak256(message);
      const sigObj = secp256k1.sign(msgHash, new Uint8Array(validatorPrivKey));
      const signature = sigObj.toCompactRawBytes();
      const recoveryId = sigObj.recovery;

      await program.methods
        .completeTransfer(
          Array.from(transferId) as any,
          amount,
          recipient,
          Array.from(signature) as any,
          recoveryId
        )
        .accounts({
          payer: admin.publicKey,
          bridgeConfig: bridgeConfigPda,
          transferRecord: transferRecordPda,
          wforgaiMint: wforgaiMint,
          mintAuthority: mintAuthorityPda,
          recipientAta: recipientAta.address,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      const record = await program.account.transferRecord.fetch(
        transferRecordPda
      );
      expect(record.completed).to.equal(true);
    });

    it("rejects replay (same transfer_id)", async () => {
      const transferId = Buffer.alloc(32, 0xbb);
      const amount = new anchor.BN(2_000_000_000);
      const recipient = admin.publicKey;

      const [transferRecordPda] = PublicKey.findProgramAddressSync(
        [TRANSFER_SEED, transferId],
        program.programId
      );

      const recipientAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        admin.payer,
        wforgaiMint,
        recipient
      );

      let message = Buffer.alloc(104);
      transferId.copy(message, 0);
      message.writeBigUInt64LE(BigInt(amount.toString()), 32);
      recipient.toBuffer().copy(message, 40);
      wforgaiMint.toBuffer().copy(message, 72);

      const msgHash = keccak256(message);
      const sigObj = secp256k1.sign(msgHash, new Uint8Array(validatorPrivKey));

      try {
        await program.methods
          .completeTransfer(
            Array.from(transferId) as any,
            amount,
            recipient,
            Array.from(sigObj.toCompactRawBytes()) as any,
            sigObj.recovery
          )
          .accounts({
            payer: admin.publicKey,
            bridgeConfig: bridgeConfigPda,
            transferRecord: transferRecordPda,
            wforgaiMint: wforgaiMint,
            mintAuthority: mintAuthorityPda,
            recipientAta: recipientAta.address,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        expect.fail("Should have failed — replay");
      } catch (err: any) {
        expect(err.message).to.include("already in use");
      }
    });
  });
});
