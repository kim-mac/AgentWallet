import { evaluatePayment } from "@agentspend/shared";
import type { AgentPolicy, PaymentRequest } from "@agentspend/shared";

export type SimulatorFinding = {
  id: string;
  title: string;
  severity: "low" | "medium" | "high";
  status: "passed" | "failed";
  detail: string;
};

export function simulatePolicyAttacks(policy: AgentPolicy): SimulatorFinding[] {
  return [
    simulateSplitSpend(policy),
    simulateUnknownVendor(policy),
    simulatePausedPolicy(policy)
  ];
}

function simulateSplitSpend(policy: AgentPolicy): SimulatorFinding {
  const unapprovedPaymentSize = Math.min(
    policy.maxPerPaymentUsd,
    policy.approvalThresholdUsd
  );
  const requestsToDrainBudget = Math.ceil(
    policy.dailyBudgetUsd / unapprovedPaymentSize
  );
  const canDrainBudgetWithoutApproval =
    unapprovedPaymentSize > 0 && requestsToDrainBudget > 1;

  return {
    id: "split-spend",
    title: "Repeated micropayment budget exhaustion",
    severity: "high",
    status: canDrainBudgetWithoutApproval ? "failed" : "passed",
    detail: canDrainBudgetWithoutApproval
      ? `An agent can drain the daily budget through ${requestsToDrainBudget} sub-threshold payments; add burst limits or approval rules for repeated spend.`
      : "The configured payment caps do not expose an obvious split-spend exhaustion path."
  };
}

function simulateUnknownVendor(policy: AgentPolicy): SimulatorFinding {
  const request = baseRequest(policy, {
    vendorId: "unknown-vendor",
    vendorName: "Unknown Vendor",
    recipient: "unknown-recipient"
  });
  const evaluation = evaluatePayment(policy, request);

  return {
    id: "unknown-vendor",
    title: "Unknown vendor payment",
    severity: "medium",
    status: evaluation.decision === "denied" ? "passed" : "failed",
    detail:
      evaluation.decision === "denied"
        ? "Unknown vendor and recipient payments are blocked."
        : "Unknown vendor payment was not denied."
  };
}

function simulatePausedPolicy(policy: AgentPolicy): SimulatorFinding {
  const evaluation = evaluatePayment(
    { ...policy, status: "paused" },
    baseRequest(policy)
  );

  return {
    id: "paused-policy",
    title: "Emergency pause enforcement",
    severity: "high",
    status: evaluation.decision === "denied" ? "passed" : "failed",
    detail:
      evaluation.decision === "denied"
        ? "Paused policies deny payment attempts."
        : "Paused policy did not block payment."
  };
}

function baseRequest(
  policy: AgentPolicy,
  overrides: Partial<PaymentRequest> = {}
): PaymentRequest {
  return {
    id: "simulated_payment",
    agentId: policy.agentId,
    vendorId: policy.allowedVendors[0] ?? "vendor",
    vendorName: "Allowed Vendor",
    category: policy.allowedCategories[0] ?? "data",
    recipient: policy.allowedRecipients[0] ?? "recipient",
    tokenMint: policy.tokenMint,
    amountUsd: Math.min(policy.maxPerPaymentUsd, policy.approvalThresholdUsd),
    requestedAt: new Date().toISOString(),
    ...overrides
  };
}
