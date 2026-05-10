import type { AgentPolicy, PaymentRequest, PolicyEvaluation } from "./types";

export function evaluatePayment(
  policy: AgentPolicy,
  payment: PaymentRequest
): PolicyEvaluation {
  const reasons: string[] = [];
  const remainingDailyBudgetUsd = roundUsd(
    policy.dailyBudgetUsd - policy.spentTodayUsd - payment.amountUsd
  );

  if (policy.status !== "active") {
    reasons.push("Policy is paused.");
  }

  if (payment.agentId !== policy.agentId) {
    reasons.push("Payment was requested by the wrong agent.");
  }

  if (payment.tokenMint !== policy.tokenMint) {
    reasons.push("Token mint is not allowed.");
  }

  if (!policy.allowedVendors.includes(payment.vendorId)) {
    reasons.push("Vendor is not allowlisted.");
  }

  if (!policy.allowedCategories.includes(payment.category)) {
    reasons.push("Category is not allowlisted.");
  }

  if (!policy.allowedRecipients.includes(payment.recipient)) {
    reasons.push("Recipient is not allowlisted.");
  }

  if (payment.amountUsd > policy.maxPerPaymentUsd) {
    reasons.push("Amount exceeds per-payment cap.");
  }

  if (remainingDailyBudgetUsd < 0) {
    reasons.push("Daily budget would be exceeded.");
  }

  if (reasons.length > 0) {
    return {
      decision: "denied",
      reasons,
      remainingDailyBudgetUsd
    };
  }

  if (payment.amountUsd > policy.approvalThresholdUsd) {
    return {
      decision: "requires_approval",
      reasons: ["Amount exceeds approval threshold."],
      remainingDailyBudgetUsd
    };
  }

  return {
    decision: "approved",
    reasons: ["Payment is within policy."],
    remainingDailyBudgetUsd
  };
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}
