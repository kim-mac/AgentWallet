import { describe, expect, it } from "vitest";
import { evaluatePayment } from "./policy";
import type { AgentPolicy, PaymentRequest } from "./types";

const basePolicy: AgentPolicy = {
  id: "policy_research",
  ownerId: "owner_acme",
  agentId: "agent_research_01",
  status: "active",
  tokenMint: "USDC",
  maxPerPaymentUsd: 40,
  dailyBudgetUsd: 200,
  approvalThresholdUsd: 25,
  spentTodayUsd: 60,
  allowedVendors: ["helius", "jupiter"],
  allowedCategories: ["data", "trading"],
  allowedRecipients: ["vendor_helius_wallet", "vendor_jupiter_wallet"],
  resetAt: "2026-05-09T00:00:00.000Z"
};

const basePayment: PaymentRequest = {
  id: "pay_001",
  agentId: "agent_research_01",
  vendorId: "helius",
  vendorName: "Helius",
  category: "data",
  recipient: "vendor_helius_wallet",
  tokenMint: "USDC",
  amountUsd: 12,
  requestedAt: "2026-05-08T18:00:00.000Z"
};

describe("evaluatePayment", () => {
  it("approves a payment inside the active owner policy", () => {
    const result = evaluatePayment(basePolicy, basePayment);

    expect(result.decision).toBe("approved");
    expect(result.reasons).toEqual(["Payment is within policy."]);
    expect(result.remainingDailyBudgetUsd).toBe(128);
  });

  it("denies a payment to an unknown recipient instead of trusting agent code", () => {
    const result = evaluatePayment(basePolicy, {
      ...basePayment,
      recipient: "unknown_wallet"
    });

    expect(result.decision).toBe("denied");
    expect(result.reasons).toContain("Recipient is not allowlisted.");
  });

  it("requires owner approval above the threshold while still below hard caps", () => {
    const result = evaluatePayment(basePolicy, {
      ...basePayment,
      amountUsd: 30
    });

    expect(result.decision).toBe("requires_approval");
    expect(result.reasons).toEqual(["Amount exceeds approval threshold."]);
  });

  it("denies split-spend exhaustion when the daily budget is exceeded", () => {
    const result = evaluatePayment(
      { ...basePolicy, spentTodayUsd: 190 },
      { ...basePayment, amountUsd: 20 }
    );

    expect(result.decision).toBe("denied");
    expect(result.reasons).toContain("Daily budget would be exceeded.");
  });
});
