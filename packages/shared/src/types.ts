export type PolicyStatus = "active" | "paused";

export type PaymentDecision = "approved" | "denied" | "requires_approval";

export type AgentPolicy = {
  id: string;
  ownerId: string;
  agentId: string;
  status: PolicyStatus;
  tokenMint: string;
  maxPerPaymentUsd: number;
  dailyBudgetUsd: number;
  approvalThresholdUsd: number;
  spentTodayUsd: number;
  allowedVendors: string[];
  allowedCategories: string[];
  allowedRecipients: string[];
  resetAt: string;
};

export type PaymentRequest = {
  id: string;
  agentId: string;
  vendorId: string;
  vendorName: string;
  category: string;
  recipient: string;
  tokenMint: string;
  amountUsd: number;
  requestedAt: string;
};

export type PolicyEvaluation = {
  decision: PaymentDecision;
  reasons: string[];
  remainingDailyBudgetUsd: number;
};

export type SpendEvent = {
  id: string;
  policyId: string;
  paymentId: string;
  decision: PaymentDecision;
  amountUsd: number;
  vendorName: string;
  category: string;
  createdAt: string;
  reasons: string[];
};
