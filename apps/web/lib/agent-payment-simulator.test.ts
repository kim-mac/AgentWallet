import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import {
  simulatePaymentAgainstPolicy,
  type DecodedAgentPolicyAccount
} from "./agent-payment-simulator";
import type { ProvisionedAgentRecord } from "./provisioning-store";

const owner = Keypair.generate().publicKey.toBase58();
const agent = Keypair.generate().publicKey.toBase58();
const recipient = Keypair.generate().publicKey.toBase58();
const blockedRecipient = Keypair.generate().publicKey.toBase58();
const tokenMint = Keypair.generate().publicKey.toBase58();

const agentRecord: ProvisionedAgentRecord = {
  id: "agent_123",
  owner,
  name: "Research agent",
  publicKey: agent,
  encryptedSecretKey: "encrypted",
  apiKeyHash: "hash",
  apiKeyPrefix: "agw_live_1",
  programId: Keypair.generate().publicKey.toBase58(),
  policyPda: Keypair.generate().publicKey.toBase58(),
  tokenMint,
  decimals: 6,
  telegramChatId: null,
  createdAt: "2026-05-29T00:00:00.000Z",
  updatedAt: "2026-05-29T00:00:00.000Z"
};

const policy: DecodedAgentPolicyAccount = {
  owner,
  agent,
  tokenMint,
  maxPerPayment: 3_000_000n,
  dailyBudget: 10_000_000n,
  approvalThreshold: 2_000_000n,
  spentInPeriod: 1_000_000n,
  periodStartedAt: 0n,
  periodSeconds: 86_400n,
  allowedRecipients: [recipient],
  allowedTokenMints: [tokenMint],
  paused: false,
  bump: 255
};

describe("simulatePaymentAgainstPolicy", () => {
  it("approves an in-policy payment without sending a transaction", () => {
    expect(
      simulatePaymentAgainstPolicy(agentRecord, policy, {
        recipient,
        amount: "1"
      })
    ).toMatchObject({
      ok: true,
      decision: "approved",
      code: "PAYMENT_ALLOWED",
      amount: "1",
      tokenMint
    });
  });

  it("returns structured rejection details for blocked recipients", () => {
    expect(
      simulatePaymentAgainstPolicy(agentRecord, policy, {
        recipient: blockedRecipient,
        amount: "1"
      })
    ).toMatchObject({
      ok: true,
      decision: "rejected",
      code: "RECIPIENT_NOT_ALLOWED",
      suggestedAction: "request_owner_policy_update"
    });
  });

  it("returns owner approval when amount is above threshold but below hard caps", () => {
    expect(
      simulatePaymentAgainstPolicy(agentRecord, policy, {
        recipient,
        amount: "2.5"
      })
    ).toMatchObject({
      ok: true,
      decision: "requires_approval",
      code: "OWNER_APPROVAL_REQUIRED",
      suggestedAction: "request_owner_approval"
    });
  });
});
