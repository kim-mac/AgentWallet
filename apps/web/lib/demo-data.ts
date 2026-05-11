import type { AgentPolicy, PaymentRequest, SpendEvent } from "@agentspend/shared";

export const policy: AgentPolicy = {
  id: "policy",
  ownerId: "",
  agentId: "",
  status: "active",
  tokenMint: "",
  maxPerPaymentUsd: 0,
  dailyBudgetUsd: 0,
  approvalThresholdUsd: 0,
  spentTodayUsd: 0,
  allowedVendors: [],
  allowedCategories: [],
  allowedRecipients: [],
  resetAt: ""
};

export const paymentRequests: PaymentRequest[] = [];

export const spendEvents: SpendEvent[] = [];
