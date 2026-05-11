import { describe, expect, it } from "vitest";
import {
  buildSpendEvent,
  buildX402PaymentPayload,
  parseCsvList,
  serializeDemoState,
  updatePolicyFromForm
} from "./demo-state";
import { policy } from "./demo-data";

const configuredPolicy = {
  ...policy,
  id: "policy_test",
  agentId: "agent_test",
  tokenMint: "USDC",
  maxPerPaymentUsd: 40,
  dailyBudgetUsd: 200,
  approvalThresholdUsd: 25,
  allowedVendors: ["vendor_allowed"],
  allowedCategories: ["data"],
  allowedRecipients: ["recipient_allowed"]
};

const paymentRequests = [
  {
    id: "pay_allowed",
    agentId: "agent_test",
    vendorId: "vendor_allowed",
    vendorName: "Allowed Vendor",
    category: "data",
    recipient: "recipient_allowed",
    tokenMint: "USDC",
    amountUsd: 12,
    requestedAt: "2026-05-08T18:00:00.000Z"
  },
  {
    id: "pay_denied",
    agentId: "agent_test",
    vendorId: "vendor_unknown",
    vendorName: "Unknown Vendor",
    category: "data",
    recipient: "recipient_allowed",
    tokenMint: "USDC",
    amountUsd: 12,
    requestedAt: "2026-05-08T18:12:00.000Z"
  }
];

describe("demo-state helpers", () => {
  it("normalizes comma-separated policy lists", () => {
    expect(parseCsvList(" helius, jupiter,, exa ")).toEqual([
      "helius",
      "jupiter",
      "exa"
    ]);
  });

  it("updates owner-managed policy fields from editable form values", () => {
    const updated = updatePolicyFromForm(policy, {
      maxPerPaymentUsd: "55",
      dailyBudgetUsd: "300",
      approvalThresholdUsd: "35",
      allowedVendors: "helius, exa",
      allowedCategories: "data, inference",
      allowedRecipients: "vendor_helius_wallet, vendor_exa_wallet"
    });

    expect(updated.maxPerPaymentUsd).toBe(55);
    expect(updated.dailyBudgetUsd).toBe(300);
    expect(updated.approvalThresholdUsd).toBe(35);
    expect(updated.allowedVendors).toEqual(["helius", "exa"]);
    expect(updated.allowedCategories).toEqual(["data", "inference"]);
    expect(updated.allowedRecipients).toEqual([
      "vendor_helius_wallet",
      "vendor_exa_wallet"
    ]);
  });

  it("builds an audit event from the active policy evaluation", () => {
    const deniedRequest = paymentRequests[1];
    expect(deniedRequest).toBeDefined();

    const event = buildSpendEvent(configuredPolicy, deniedRequest!);

    expect(event.decision).toBe("denied");
    expect(event.reasons).toContain("Vendor is not allowlisted.");
    expect(event.policyId).toBe(configuredPolicy.id);
  });

  it("serializes demo state for browser persistence", () => {
    const serialized = serializeDemoState({
      policy: configuredPolicy,
      requests: paymentRequests,
      events: []
    });

    expect(JSON.parse(serialized)).toMatchObject({
      policy: { id: configuredPolicy.id },
      requests: expect.any(Array),
      events: []
    });
  });

  it("builds an x402-style payment payload for agent calls", () => {
    const payload = buildX402PaymentPayload(configuredPolicy, paymentRequests[0]!);

    expect(payload).toMatchObject({
      x402Version: "0.1-demo",
      network: "solana-localnet",
      asset: "USDC",
      agentId: configuredPolicy.agentId,
      payment: {
        amountUsd: paymentRequests[0]!.amountUsd,
        recipient: paymentRequests[0]!.recipient
      },
      policy: {
        policyId: configuredPolicy.id,
        approvalThresholdUsd: configuredPolicy.approvalThresholdUsd
      }
    });
  });
});
