import { evaluatePayment } from "@agentspend/shared";
import type { AgentPolicy, PaymentRequest, SpendEvent } from "@agentspend/shared";

export const policy: AgentPolicy = {
  id: "policy_research",
  ownerId: "owner_acme",
  agentId: "agent_research_01",
  status: "active",
  tokenMint: "USDC",
  maxPerPaymentUsd: 40,
  dailyBudgetUsd: 200,
  approvalThresholdUsd: 25,
  spentTodayUsd: 72,
  allowedVendors: [
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
  ],
  allowedCategories: ["data", "trading", "inference"],
  allowedRecipients: [
    "vendor_helius_wallet",
    "vendor_jupiter_wallet",
    "vendor_exa_wallet"
  ],
  resetAt: "2026-05-09T00:00:00.000Z"
};

export const paymentRequests: PaymentRequest[] = [
  {
    id: "pay_001",
    agentId: "agent_research_01",
    vendorId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    vendorName: "SPL Token Program",
    category: "data",
    recipient: "vendor_helius_wallet",
    tokenMint: "USDC",
    amountUsd: 12,
    requestedAt: "2026-05-08T18:00:00.000Z"
  },
  {
    id: "pay_002",
    agentId: "agent_research_01",
    vendorId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    vendorName: "Jupiter",
    category: "trading",
    recipient: "vendor_jupiter_wallet",
    tokenMint: "USDC",
    amountUsd: 32,
    requestedAt: "2026-05-08T18:06:00.000Z"
  },
  {
    id: "pay_003",
    agentId: "agent_research_01",
    vendorId: "unknown",
    vendorName: "Unknown MCP Server",
    category: "data",
    recipient: "unknown_wallet",
    tokenMint: "USDC",
    amountUsd: 18,
    requestedAt: "2026-05-08T18:12:00.000Z"
  }
];

export const spendEvents: SpendEvent[] = paymentRequests.map((request) => {
  const evaluation = evaluatePayment(policy, request);

  return {
    id: `event_${request.id}`,
    policyId: policy.id,
    paymentId: request.id,
    decision: evaluation.decision,
    amountUsd: request.amountUsd,
    vendorName: request.vendorName,
    category: request.category,
    createdAt: request.requestedAt,
    reasons: evaluation.reasons
  };
});
