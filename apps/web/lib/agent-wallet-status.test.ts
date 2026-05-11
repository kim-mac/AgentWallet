import { describe, expect, it } from "vitest";
import { buildAgentWalletStatus } from "./agent-wallet-status";
import type { ProvisionedAgentRecord } from "./provisioning-store";

const baseAgent: ProvisionedAgentRecord = {
  id: "agent_123",
  owner: "owner_public_key",
  name: "Research agent",
  publicKey: "agent_public_key",
  encryptedSecretKey: "encrypted",
  apiKeyHash: "hash",
  apiKeyPrefix: "agw_live_1",
  programId: "program_public_key",
  policyPda: "policy_public_key",
  tokenMint: "token_mint_public_key",
  decimals: 6,
  telegramChatId: "12345",
  createdAt: "2026-05-11T00:00:00.000Z",
  updatedAt: "2026-05-11T00:00:00.000Z"
};

describe("buildAgentWalletStatus", () => {
  it("marks an agent ready when policy and token are configured", () => {
    expect(buildAgentWalletStatus(baseAgent)).toEqual({
      readyForPayments: true,
      policyConfigured: true,
      tokenMintConfigured: true,
      telegramLinked: true,
      missing: []
    });
  });

  it("lists missing setup needed before an external agent can pay", () => {
    expect(
      buildAgentWalletStatus({
        ...baseAgent,
        policyPda: null,
        tokenMint: "",
        telegramChatId: null
      })
    ).toEqual({
      readyForPayments: false,
      policyConfigured: false,
      tokenMintConfigured: false,
      telegramLinked: false,
      missing: ["policyPda", "tokenMint"]
    });
  });
});
