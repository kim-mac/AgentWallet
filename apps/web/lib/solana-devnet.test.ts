import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  buildAnchorPolicyArgs,
  buildInitializePolicyInstruction,
  buildPolicyAnchorPayload,
  defaultAgentSpendProgramId,
  defaultDevnetUsdcMint,
  derivePolicyPda,
  getExplorerAddressUrl,
  getExplorerTransactionUrl
} from "./solana-devnet";
import { policy } from "./demo-data";

describe("solana devnet helpers", () => {
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
      allowedRecipients: owner.toBase58(),
      periodSeconds: "86400"
    });
    const instruction = buildInitializePolicyInstruction(programId, owner, policyPda, args);

    expect(instruction.programId.toBase58()).toBe(defaultAgentSpendProgramId);
    expect(instruction.keys).toHaveLength(3);
    expect([...instruction.data.subarray(0, 8)]).toEqual([
      9, 186, 86, 225, 129, 162, 231, 56
    ]);
    expect(instruction.data.length).toBe(8 + 32 + 32 + 8 + 8 + 8 + 8 + 4 + 32);
  });
});
