import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  buildAnchorPolicyArgs,
  buildApprovePaymentIntentInstruction,
  buildInitializePolicyInstruction,
  buildPolicyAnchorPayload,
  defaultAgentSpendProgramId,
  defaultDevnetUsdcMint,
  derivePaymentIntentPda,
  derivePolicyPda,
  getExplorerAddressUrl,
  getExplorerTransactionUrl,
  getPhantomProvider
} from "./solana-devnet";
import { policy } from "./demo-data";

describe("solana devnet helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores non-Phantom window.solana providers", () => {
    const injectedProvider = {
      isPhantom: false,
      publicKey: new PublicKey("11111111111111111111111111111112"),
      connect: vi.fn(),
      signAndSendTransaction: vi.fn()
    };

    vi.stubGlobal("window", { solana: injectedProvider });

    expect(getPhantomProvider()).toBeNull();
  });

  it("ignores MetaMask even if it exposes Phantom-like Solana fields", () => {
    const injectedProvider = {
      isPhantom: true,
      isMetaMask: true,
      _metamask: {},
      publicKey: new PublicKey("11111111111111111111111111111112"),
      connect: vi.fn(),
      signAndSendTransaction: vi.fn()
    };

    vi.stubGlobal("window", {
      solana: injectedProvider,
      phantom: { solana: injectedProvider }
    });

    expect(getPhantomProvider()).toBeNull();
  });

  it("returns Phantom from the nested Phantom namespace", () => {
    const phantomProvider = {
      isPhantom: true,
      publicKey: new PublicKey("11111111111111111111111111111112"),
      connect: vi.fn(),
      signAndSendTransaction: vi.fn()
    };

    vi.stubGlobal("window", {
      solana: { ...phantomProvider, isPhantom: false },
      phantom: { solana: phantomProvider }
    });

    expect(getPhantomProvider()).toBe(phantomProvider);
  });

  it("builds a policy payload that can be anchored by the owner wallet", () => {
    const payload = buildPolicyAnchorPayload(
      policy,
      "9xQeWvG816bUx9EPjHmaT23yvVM2ZW3ovSDHy7Ud5x5L",
      "2026-05-08T20:00:00.000Z"
    );

    expect(payload).toMatchObject({
      type: "agentspend.policy.v1",
      cluster: "devnet",
      policyId: policy.id,
      owner: "9xQeWvG816bUx9EPjHmaT23yvVM2ZW3ovSDHy7Ud5x5L",
      maxPerPaymentUsd: policy.maxPerPaymentUsd,
      allowedRecipients: policy.allowedRecipients
    });
  });

  it("builds an Anchor approve_payment_intent instruction", () => {
    const programId = new PublicKey(defaultAgentSpendProgramId);
    const owner = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZW3ovSDHy7Ud5x5L");
    const agent = new PublicKey("11111111111111111111111111111112");
    const recipient = owner;
    const [policyPda] = derivePolicyPda(programId, owner, agent);
    const [paymentIntentPda] = derivePaymentIntentPda(
      programId,
      policyPda,
      recipient,
      5_000_000n,
      1_800_000_000n
    );
    const instruction = buildApprovePaymentIntentInstruction(
      programId,
      owner,
      policyPda,
      recipient,
      paymentIntentPda,
      5_000_000n,
      1_800_000_000n
    );

    expect(instruction.keys).toHaveLength(5);
    expect(instruction.keys[3]?.pubkey.toBase58()).toBe(paymentIntentPda.toBase58());
    expect([...instruction.data.subarray(0, 8)]).toEqual([
      203, 166, 97, 54, 229, 54, 111, 200
    ]);
    expect(instruction.data.length).toBe(24);
  });

  it("creates a devnet explorer URL for a submitted transaction", () => {
    expect(getExplorerTransactionUrl("abc123")).toBe(
      "https://explorer.solana.com/tx/abc123?cluster=devnet"
    );
  });

  it("derives the Anchor policy PDA from owner and agent", () => {
    const programId = new PublicKey(defaultAgentSpendProgramId);
    const owner = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZW3ovSDHy7Ud5x5L");
    const agent = new PublicKey("11111111111111111111111111111112");
    const [pda, bump] = derivePolicyPda(programId, owner, agent);

    expect(pda.toBase58()).toBeTruthy();
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(getExplorerAddressUrl(pda.toBase58())).toContain("?cluster=devnet");
  });

  it("builds Anchor initialize_policy instruction data", () => {
    const programId = new PublicKey(defaultAgentSpendProgramId);
    const owner = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZW3ovSDHy7Ud5x5L");
    const agent = new PublicKey("11111111111111111111111111111112");
    const [policyPda] = derivePolicyPda(programId, owner, agent);
    const args = buildAnchorPolicyArgs(policy, {
      programId: defaultAgentSpendProgramId,
      agent: agent.toBase58(),
      tokenMint: defaultDevnetUsdcMint,
      allowedTokenMints: `${defaultDevnetUsdcMint}, 11111111111111111111111111111112`,
      allowedRecipients: owner.toBase58(),
      periodSeconds: "86400"
    });
    const instruction = buildInitializePolicyInstruction(programId, owner, policyPda, args);

    expect(instruction.programId.toBase58()).toBe(defaultAgentSpendProgramId);
    expect(instruction.keys).toHaveLength(3);
    expect([...instruction.data.subarray(0, 8)]).toEqual([
      9, 186, 86, 225, 129, 162, 231, 56
    ]);
    expect(args.allowedTokenMints).toHaveLength(2);
    expect(instruction.data.length).toBe(8 + 32 + 32 + 8 + 8 + 8 + 8 + 4 + 32 + 4 + 64);
  });

  it("defaults the on-chain token allowlist to the primary token mint", () => {
    const agent = new PublicKey("11111111111111111111111111111112");
    const args = buildAnchorPolicyArgs(policy, {
      programId: defaultAgentSpendProgramId,
      agent: agent.toBase58(),
      tokenMint: defaultDevnetUsdcMint,
      allowedRecipients: "9xQeWvG816bUx9EPjHmaT23yvVM2ZW3ovSDHy7Ud5x5L",
      periodSeconds: "86400"
    });

    expect(args.allowedTokenMints.map((mint) => mint.toBase58())).toEqual([
      defaultDevnetUsdcMint
    ]);
  });
});
