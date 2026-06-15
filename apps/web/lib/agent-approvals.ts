import { appendAuditEvent } from "./audit-log";
import { createId } from "./provisioning-crypto";
import {
  getProvisioningStore,
  type ApprovalRecord
} from "./provisioning-store";

export type ApprovalPaymentShape = {
  owner: string;
  agentId: string;
  agentPublicKey: string;
  programId: string;
  policyPda: string;
  recipient: string;
  tokenMint: string;
  amount: string;
  decimals: number;
  reason: string;
};

export type ApprovalConfirmation = {
  signature: string;
  paymentIntentPda: string;
};

export type ApprovedPaymentResult = {
  signature: string;
  [key: string]: unknown;
};

const approvalTtlMs = 15 * 60_000;

export async function createPendingApproval(input: ApprovalPaymentShape) {
  const now = new Date().toISOString();
  const record: ApprovalRecord = {
    ...input,
    id: createId("approval"),
    status: "pending",
    paymentIntentPda: null,
    approvalSignature: null,
    executionSignature: null,
    expiresAt: new Date(Date.now() + approvalTtlMs).toISOString(),
    createdAt: now,
    updatedAt: now
  };

  await getProvisioningStore().saveApproval(record);
  await appendAuditEvent({
    owner: record.owner,
    agentId: record.agentId,
    type: "payment_rejected",
    message: `Owner approval requested for ${record.amount} token payment.`,
    status: "info",
    metadata: {
      approvalId: record.id,
      recipient: record.recipient,
      tokenMint: record.tokenMint,
      policyPda: record.policyPda,
      reason: record.reason
    }
  });

  return record;
}

export async function listOwnerApprovals(owner: string, agentId?: string) {
  return getProvisioningStore().listApprovals(owner, agentId);
}

export async function markApprovalOnchainApproved(
  owner: string,
  approvalId: string,
  confirmation: ApprovalConfirmation
) {
  const approval = await requireApproval(approvalId);
  if (approval.owner !== owner) {
    throw new AgentApprovalError("Approval request was not found for this owner.", 404);
  }

  const updated = withUpdatedAt({
    ...approval,
    status: "approved" as const,
    approvalSignature: confirmation.signature,
    paymentIntentPda: confirmation.paymentIntentPda
  });

  await getProvisioningStore().saveApproval(updated);
  await appendAuditEvent({
    owner: updated.owner,
    agentId: updated.agentId,
    type: "policy_updated",
    message: `Owner approved ${updated.amount} token payment intent.`,
    status: "approved",
    signature: confirmation.signature,
    metadata: {
      approvalId: updated.id,
      recipient: updated.recipient,
      tokenMint: updated.tokenMint,
      paymentIntentPda: confirmation.paymentIntentPda
    }
  });

  return updated;
}

export async function markApprovalExecuted(
  agentId: string,
  approvalId: string,
  executionSignature: string
) {
  const approval = await requireApproval(approvalId);
  if (approval.agentId !== agentId) {
    throw new AgentApprovalError("Approval request was not found for this agent.", 404);
  }

  const updated = withUpdatedAt({
    ...approval,
    status: "executed" as const,
    executionSignature
  });

  await getProvisioningStore().saveApproval(updated);
  return updated;
}

export async function markApprovalExecutionFailed(
  agentId: string,
  approvalId: string,
  reason: string
) {
  const approval = await requireApproval(approvalId);
  if (approval.agentId !== agentId) {
    throw new AgentApprovalError("Approval request was not found for this agent.", 404);
  }

  const updated = withUpdatedAt({
    ...approval,
    status: "execution_failed" as const,
    reason
  });

  await getProvisioningStore().saveApproval(updated);
  return updated;
}

export async function markApprovalRejected(owner: string, approvalId: string) {
  const approval = await requireApproval(approvalId);
  if (approval.owner !== owner) {
    throw new AgentApprovalError("Approval request was not found for this owner.", 404);
  }

  const updated = withUpdatedAt({
    ...approval,
    status: "rejected" as const
  });

  await getProvisioningStore().saveApproval(updated);
  await appendAuditEvent({
    owner: updated.owner,
    agentId: updated.agentId,
    type: "payment_rejected",
    message: `Owner rejected ${updated.amount} token payment approval.`,
    status: "rejected",
    metadata: {
      approvalId: updated.id,
      recipient: updated.recipient,
      tokenMint: updated.tokenMint,
      policyPda: updated.policyPda
    }
  });

  return updated;
}

export async function executeApprovedPayment<TPayment extends ApprovedPaymentResult>(
  owner: string,
  approvalId: string,
  confirmation: ApprovalConfirmation,
  executePayment: (approval: ApprovalRecord) => Promise<TPayment>
) {
  const approved = await markApprovalOnchainApproved(owner, approvalId, confirmation);
  let payment: TPayment;
  try {
    payment = await executePayment(approved);
  } catch (error) {
    await markApprovalExecutionFailed(
      approved.agentId,
      approved.id,
      error instanceof Error ? error.message : "Approved payment execution failed."
    );
    throw error;
  }
  const approval = await markApprovalExecuted(
    approved.agentId,
    approved.id,
    payment.signature
  );

  return { approval, payment };
}

export async function findUsableApproval(
  agentId: string,
  payment: ApprovalPaymentShape
) {
  const approvals = await getProvisioningStore().listApprovals(payment.owner, agentId);
  const now = Date.now();

  return approvals.find((approval) =>
    approval.status === "approved" &&
    Boolean(approval.paymentIntentPda) &&
    new Date(approval.expiresAt).getTime() >= now &&
    approval.programId === payment.programId &&
    approval.policyPda === payment.policyPda &&
    approval.recipient === payment.recipient &&
    approval.tokenMint === payment.tokenMint &&
    approval.amount === payment.amount &&
    approval.decimals === payment.decimals
  ) ?? null;
}

async function requireApproval(approvalId: string) {
  const approval = await getProvisioningStore().getApproval(approvalId);
  if (!approval) {
    throw new AgentApprovalError("Approval request was not found.", 404);
  }
  return approval;
}

function withUpdatedAt(record: ApprovalRecord): ApprovalRecord {
  return { ...record, updatedAt: new Date().toISOString() };
}

export class AgentApprovalError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}
