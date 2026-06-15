import { describe, expect, it } from "vitest";
import {
  decryptSuiLocalWalletBundle,
  encryptSuiLocalWalletBundle,
  generateSuiLocalWalletBundle
} from "./sui-local-wallets";

describe("Sui local wallet vault", () => {
  it("generates separate owner and agent wallets", () => {
    const bundle = generateSuiLocalWalletBundle(new Date("2026-06-06T00:00:00.000Z"));

    expect(bundle.owner.address).toMatch(/^0x[0-9a-f]{64}$/);
    expect(bundle.agent.address).toMatch(/^0x[0-9a-f]{64}$/);
    expect(bundle.owner.address).not.toBe(bundle.agent.address);
    expect(bundle.owner.privateKey).toMatch(/^suiprivkey/);
    expect(bundle.agent.privateKey).toMatch(/^suiprivkey/);
  });

  it("encrypts the wallet bundle and decrypts it with the owner password", async () => {
    const bundle = generateSuiLocalWalletBundle(new Date("2026-06-06T00:00:00.000Z"));
    const encrypted = await encryptSuiLocalWalletBundle(bundle, "correct horse battery staple");

    expect(encrypted.ownerAddress).toBe(bundle.owner.address);
    expect(encrypted.agentAddress).toBe(bundle.agent.address);
    expect(JSON.stringify(encrypted)).not.toContain(bundle.owner.privateKey);
    expect(JSON.stringify(encrypted)).not.toContain(bundle.agent.privateKey);

    const decrypted = await decryptSuiLocalWalletBundle(encrypted, "correct horse battery staple");

    expect(decrypted).toEqual(bundle);
  });

  it("rejects the wrong owner password", async () => {
    const bundle = generateSuiLocalWalletBundle(new Date("2026-06-06T00:00:00.000Z"));
    const encrypted = await encryptSuiLocalWalletBundle(bundle, "correct horse battery staple");

    await expect(decryptSuiLocalWalletBundle(encrypted, "wrong password")).rejects.toThrow(
      "Unable to unlock Sui wallets"
    );
  });
});
