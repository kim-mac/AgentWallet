import { describe, expect, it } from "vitest";
import {
  buildSpendEvent,
  buildX402PaymentPayload,
  parseCsvList,
  serializeDemoState,
  updatePolicyFromForm
} from "./demo-state";
import { policy, paymentRequests } from "./demo-data";

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
    const deniedRequest = paymentRequests[2];
    expect(deniedRequest).toBeDefined();

    const event = buildSpendEvent(policy, deniedRequest!);

    expect(event.decision).toBe("denied");
    expect(event.reasons).toContain("Vendor is not allowlisted.");
    expect(event.policyId).toBe(policy.id);
  });

  it("serializes demo state for browser persistence", () => {
    const serialized = serializeDemoState({
      policy,
      requests: paymentRequests,
      events: []
    });

    expect(JSON.parse(serialized)).toMatchObject({
      policy: { id: policy.id },
      requests: expect.any(Array),
      events: []
    });
  });

  it("builds an x402-style payment payload for agent calls", () => {
    const payload = buildX402PaymentPayload(policy, paymentRequests[0]!);

    expect(payload).toMatchObject({
      x402Version: "0.1-demo",
      network: "solana-localnet",
      asset: "USDC",
      agentId: policy.agentId,
      payment: {
        amountUsd: paymentRequests[0]!.amountUsd,
        recipient: paymentRequests[0]!.recipient
      },
      policy: {
        policyId: policy.id,
        approvalThresholdUsd: policy.approvalThresholdUsd
      }
    });
  });
});
