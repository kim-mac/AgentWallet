import { createId } from "./provisioning-crypto";
import { getProvisioningStore, type AuditEventRecord } from "./provisioning-store";

export type AuditEventInput = {
  owner: string;
  agentId?: string | null;
  type:
    | "agent_created"
    | "api_key_rotated"
    | "policy_initialized"
    | "policy_updated"
    | "policy_paused"
    | "policy_resumed"
    | "faucet_minted"
    | "payment_approved"
    | "payment_rejected"
    | "x402_challenge"
    | "x402_settled";
  message: string;
  status: "approved" | "rejected" | "info";
  signature?: string;
  explorerUrl?: string;
  metadata?: Record<string, unknown>;
};

export async function appendAuditEvent(input: AuditEventInput) {
  const event: AuditEventRecord = {
    id: createId("audit"),
    owner: input.owner,
    agentId: input.agentId ?? null,
    type: input.type,
    message: input.message,
    status: input.status,
    signature: input.signature,
    explorerUrl: input.explorerUrl,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString()
  };

  await getProvisioningStore().appendAuditEvent(event);
  return event;
}

export async function listAuditEvents(input: { owner: string; agentId?: string | null }) {
  return getProvisioningStore().listAuditEvents(input.owner, input.agentId ?? undefined);
}
