import { evaluatePayment } from "@agentspend/shared";
import type { AgentPolicy, PaymentRequest, SpendEvent } from "@agentspend/shared";

export type DemoStateSnapshot = {
  policy: AgentPolicy;
  requests: PaymentRequest[];
  events: SpendEvent[];
};

export type PolicyFormValues = {
  maxPerPaymentUsd: string;
  dailyBudgetUsd: string;
  approvalThresholdUsd: string;
  allowedVendors: string;
  allowedCategories: string;
  allowedRecipients: string;
};

export function policyToFormValues(policy: AgentPolicy): PolicyFormValues {
  return {
    maxPerPaymentUsd: String(policy.maxPerPaymentUsd),
    dailyBudgetUsd: String(policy.dailyBudgetUsd),
    approvalThresholdUsd: String(policy.approvalThresholdUsd),
    allowedVendors: policy.allowedVendors.join(", "),
    allowedCategories: policy.allowedCategories.join(", "),
    allowedRecipients: policy.allowedRecipients.join(", ")
  };
}

export function updatePolicyFromForm(
  policy: AgentPolicy,
  values: PolicyFormValues
): AgentPolicy {
  return {
    ...policy,
    maxPerPaymentUsd: parsePositiveNumber(
      values.maxPerPaymentUsd,
      policy.maxPerPaymentUsd
    ),
    dailyBudgetUsd: parsePositiveNumber(
      values.dailyBudgetUsd,
      policy.dailyBudgetUsd
    ),
    approvalThresholdUsd: parsePositiveNumber(
      values.approvalThresholdUsd,
      policy.approvalThresholdUsd
    ),
    allowedVendors: parseCsvList(values.allowedVendors),
    allowedCategories: parseCsvList(values.allowedCategories),
    allowedRecipients: parseCsvList(values.allowedRecipients)
  };
}

export function parseCsvList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildSpendEvent(
  policy: AgentPolicy,
  payment: PaymentRequest
): SpendEvent {
  const evaluation = evaluatePayment(policy, payment);

  return {
    id: `event_${payment.id}_${Date.now()}`,
    policyId: policy.id,
    paymentId: payment.id,
    decision: evaluation.decision,
    amountUsd: payment.amountUsd,
    vendorName: payment.vendorName,
    category: payment.category,
    createdAt: payment.requestedAt,
    reasons: evaluation.reasons
  };
}

export function serializeDemoState(snapshot: DemoStateSnapshot): string {
  return JSON.stringify(snapshot);
}

export function parseDemoState(value: string | null): DemoStateSnapshot | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as DemoStateSnapshot;
    if (!parsed.policy || !Array.isArray(parsed.requests) || !Array.isArray(parsed.events)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildX402PaymentPayload(
  policy: AgentPolicy,
  payment: PaymentRequest
) {
  return {
    x402Version: "0.1-demo",
    network: "solana-localnet",
    asset: payment.tokenMint,
    agentId: payment.agentId,
    payment: {
      requestId: payment.id,
      vendorId: payment.vendorId,
      vendorName: payment.vendorName,
      category: payment.category,
      recipient: payment.recipient,
      amountUsd: payment.amountUsd,
      requestedAt: payment.requestedAt
    },
    policy: {
      policyId: policy.id,
      ownerId: policy.ownerId,
      maxPerPaymentUsd: policy.maxPerPaymentUsd,
      dailyBudgetUsd: policy.dailyBudgetUsd,
      approvalThresholdUsd: policy.approvalThresholdUsd
    }
  };
}

function parsePositiveNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
