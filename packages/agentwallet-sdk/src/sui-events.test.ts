import { describe, expect, it } from "vitest";
import {
  extractSuiAgentWalletObjectIds,
  parseSuiAgentWalletEvents,
  summarizeSuiAgentWalletActivity
} from "./sui-events";

describe("Sui AgentWallet event parsing", () => {
  const packageId = `0x${"1".repeat(64)}`;
  const policyId = `0x${"2".repeat(64)}`;
  const vaultId = `0x${"3".repeat(64)}`;
  const owner = `0x${"4".repeat(64)}`;
  const agent = `0x${"5".repeat(64)}`;
  const poolId = `0x${"6".repeat(64)}`;

  it("normalizes AgentWallet Move events into activity records", () => {
    const events = parseSuiAgentWalletEvents([
      {
        type: `${packageId}::policy::PolicyCreated`,
        parsedJson: {
          policy_id: policyId,
          owner,
          agent,
          max_budget: "500000000",
          expires_at_ms: "1770000000000"
        }
      },
      {
        type: `${packageId}::policy::AgentVaultCreated`,
        parsedJson: {
          policy_id: policyId,
          vault_id: vaultId,
          token_type: [83, 85, 73]
        }
      },
      {
        type: `${packageId}::policy::AgentBudgetUsed`,
        parsedJson: {
          policy_id: policyId,
          vault_id: vaultId,
          owner,
          agent,
          pool_id: poolId,
          amount: "1000000",
          remaining_budget: "499000000",
          action: [100, 101, 101, 112, 98, 111, 111, 107],
          action_count: "1",
          timestamp_ms: "1770000000000"
        }
      },
      {
        type: `${packageId}::policy::PolicyRevoked`,
        parsedJson: {
          policy_id: policyId,
          owner
        }
      },
      {
        type: `${packageId}::unrelated::Ignored`,
        parsedJson: {}
      }
    ]);

    expect(events).toEqual([
      {
        kind: "policy_created",
        packageId,
        policyId,
        owner,
        agent,
        maxBudget: "500000000",
        expiresAtMs: "1770000000000"
      },
      {
        kind: "vault_created",
        packageId,
        policyId,
        vaultId,
        tokenType: "SUI"
      },
      {
        kind: "budget_used",
        packageId,
        policyId,
        vaultId,
        owner,
        agent,
        poolId,
        amount: "1000000",
        remainingBudget: "499000000",
        action: "deepbook",
        actionCount: "1",
        timestampMs: "1770000000000"
      },
      {
        kind: "policy_revoked",
        packageId,
        policyId,
        owner
      }
    ]);
  });

  it("extracts created policy and vault object ids from object changes", () => {
    const ids = extractSuiAgentWalletObjectIds({
      objectChanges: [
        {
          type: "created",
          objectId: policyId,
          objectType: `${packageId}::policy::AgentPolicy`
        },
        {
          type: "created",
          objectId: vaultId,
          objectType: `${packageId}::policy::AgentVault<0x2::sui::SUI>`
        },
        {
          type: "created",
          objectId: `0x${"7".repeat(64)}`,
          objectType: `${packageId}::other::Thing`
        }
      ]
    });

    expect(ids).toEqual({
      policyIds: [policyId],
      vaultIds: [vaultId]
    });
  });

  it("summarizes transaction output into ids and events", () => {
    const summary = summarizeSuiAgentWalletActivity({
      digest: "Digest",
      events: [
        {
          type: `${packageId}::policy::AgentVaultFunded`,
          parsedJson: {
            policy_id: policyId,
            vault_id: vaultId,
            amount: "2000000"
          }
        }
      ],
      objectChanges: [
        {
          type: "created",
          objectId: vaultId,
          objectType: `${packageId}::policy::AgentVault<0x2::sui::SUI>`
        }
      ]
    });

    expect(summary).toEqual({
      digest: "Digest",
      objectIds: {
        policyIds: [],
        vaultIds: [vaultId]
      },
      events: [
        {
          kind: "vault_funded",
          packageId,
          policyId,
          vaultId,
          amount: "2000000"
        }
      ]
    });
  });
});
