import { beforeEach, describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import {
  buildWalletChallengeMessage,
  createOwnerSession,
  verifyWalletChallenge
} from "./wallet-auth";
import { getProvisioningStore, resetMemoryProvisioningStore } from "./provisioning-store";

describe("wallet auth", () => {
  beforeEach(() => {
    process.env.AGENTSPEND_STORAGE_DRIVER = "memory";
    process.env.AGENTSPEND_ENCRYPTION_KEY = "test-encryption-key";
    resetMemoryProvisioningStore();
  });

  it("verifies a signed owner challenge", async () => {
    const owner = Keypair.generate();
    const challenge = buildWalletChallengeMessage(owner.publicKey.toBase58(), "nonce_test");
    await getProvisioningStore().saveChallenge(challenge);
    const signature = ed25519.sign(
      new TextEncoder().encode(challenge.message),
      owner.secretKey.slice(0, 32)
    );

    await expect(
      verifyWalletChallenge({
        owner: owner.publicKey.toBase58(),
        message: challenge.message,
        signature: [...signature]
      })
    ).resolves.toContain(".");
  });

  it("rejects a challenge signed by the wrong wallet", async () => {
    const owner = Keypair.generate();
    const attacker = Keypair.generate();
    const challenge = buildWalletChallengeMessage(owner.publicKey.toBase58(), "nonce_test");
    await getProvisioningStore().saveChallenge(challenge);
    const signature = ed25519.sign(
      new TextEncoder().encode(challenge.message),
      attacker.secretKey.slice(0, 32)
    );

    await expect(
      verifyWalletChallenge({
        owner: owner.publicKey.toBase58(),
        message: challenge.message,
        signature: [...signature]
      })
    ).rejects.toThrow("Wallet signature is invalid");
  });

  it("creates signed session payloads", () => {
    expect(createOwnerSession(Keypair.generate().publicKey.toBase58())).toContain(".");
  });
});
