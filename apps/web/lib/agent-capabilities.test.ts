import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { buildAgentCapabilities } from "./agent-capabilities";
import type { DecodedAgentPolicyAccount } from "./agent-payment-simulator";
import type { ProvisionedAgentRecord } from "./provisioning-store";

const owner = Keypair.generate().publicKey.toBase58();
const agent = Keypair.generate().publicKey.toBase58();
const allowedRecipient = Keypair.generate().publicKey.toBase58();
const tokenMint = Keypair.generate().publicKey.toBase58();
const secondaryTokenMint = Keypair.generate().publicKey.toBase58();
const policyPda = Keypair.generate().publicKey.toBase58();

const agentRecord: ProvisionedAgentRecord = {
  id: "agent_123",
  owner,
  name: "Research agent",
  publicKey: agent,
  encryptedSecretKey: "encrypted",
  apiKeyHash: "hash",
  apiKeyPrefix: "agw_live_1",
  programId: Keypair.generate().publicKey.toBase58(),
  policyPda,
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
  spentInPeriod: 4_000_000n,
  periodStartedAt: 1779990000n,
  periodSeconds: 86_400n,
  allowedRecipients: [allowedRecipient],
  allowedTokenMints: [tokenMint, secondaryTokenMint],
  paused: false,
  bump: 255
};

describe("buildAgentCapabilities", () => {
  it("returns agent-readable wallet boundaries from the active policy", () => {
    expect(buildAgentCapabilities(agentRecord, policy)).toMatchObject({
      ok: true,
      agent: {
        id: "agent_123",
        name: "Research agent",
        publicKey: agent
      },
      policy: {
        pda: policyPda,
        status: "active",
        owner
      },
      spend: {
        maxPerPaymentUnits: "3000000",
        dailyBudgetUnits: "10000000",
        spentInPeriodUnits: "4000000",
        remainingBudgetUnits: "6000000",
        approvalThresholdUnits: "2000000"
      },
      allowed: {
        recipients: [allowedRecipient],
        tokenMints: [tokenMint, secondaryTokenMint]
      },
      supportedActions: [
        "get_wallet_status",
        "get_capabilities",
        "simulate_payment",
        "request_payment",
        "get_audit_log"
      ],
      nextAction: "Use simulate_payment before request_payment when planning a spend."
    });
  });

  it("marks a paused policy as unable to spend", () => {
    expect(buildAgentCapabilities(agentRecord, { ...policy, paused: true })).toMatchObject({
      ok: true,
      policy: { status: "paused" },
      canSpendNow: false,
      nextAction: "Ask the owner to resume the policy before spending."
    });
  });
});
