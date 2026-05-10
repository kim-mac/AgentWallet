import { describe, expect, it } from "vitest";
import { simulatePolicyAttacks } from "./simulator";
import type { AgentPolicy } from "@agentspend/shared";

const policy: AgentPolicy = {
  id: "policy_research",
  ownerId: "owner_acme",
  agentId: "agent_research_01",
  status: "active",
  tokenMint: "USDC",
  maxPerPaymentUsd: 40,
  dailyBudgetUsd: 200,
  approvalThresholdUsd: 25,
  spentTodayUsd: 0,
  allowedVendors: ["helius"],
  allowedCategories: ["data"],
  allowedRecipients: ["vendor_helius_wallet"],
  resetAt: "2026-05-09T00:00:00.000Z"
};

describe("simulatePolicyAttacks", () => {
  it("flags repeated micropayments that can exhaust the daily budget", () => {
    const findings = simulatePolicyAttacks(policy);

    expect(findings).toContainEqual(
      expect.objectContaining({
        id: "split-spend",
        severity: "high",
        status: "failed"
      })
    );
  });

  it("confirms unknown vendors are blocked by the policy", () => {
    const findings = simulatePolicyAttacks(policy);

    expect(findings).toContainEqual(
      expect.objectContaining({
        id: "unknown-vendor",
        status: "passed"
      })
    );
  });
});
