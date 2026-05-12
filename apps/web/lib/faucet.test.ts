import { describe, expect, it } from "vitest";
import { defaultDevnetUsdcMint } from "./solana-devnet";
import { normalizeTokenMint } from "./faucet";

describe("normalizeTokenMint", () => {
  it("falls back to the AgentWallet devnet token when the mint is missing or blank", () => {
    expect(normalizeTokenMint(undefined)).toBe(defaultDevnetUsdcMint);
    expect(normalizeTokenMint("")).toBe(defaultDevnetUsdcMint);
    expect(normalizeTokenMint("   ")).toBe(defaultDevnetUsdcMint);
  });

  it("trims custom token mints", () => {
    expect(normalizeTokenMint("  CustomMint111111111111111111111111111111  ")).toBe(
      "CustomMint111111111111111111111111111111"
    );
  });
});
