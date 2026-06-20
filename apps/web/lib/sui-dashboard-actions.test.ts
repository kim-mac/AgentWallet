import { describe, expect, it } from "vitest";
import {
  buildSuiAutonomousDemoSteps,
  buildSuiDashboardActionPlan,
  buildSuiOverBudgetConfig,
  describeSuiBudgetProofRejection,
  parseSuiAgentMandate,
  mergeSuiActionResultIntoConfig
} from "./sui-dashboard-actions";
import { normalizeSuiDashboardConfig } from "./sui-dashboard";

const baseConfig = normalizeSuiDashboardConfig({
  packageId: "0xpackage",
  policyId: "0xpolicy",
  vaultId: "0xvault",
  agentAddress: "0xagent",
  allowedPoolId: "0xpool",
  coinType: "0xcoin::usdc::USDC",
  tokenTypeLabel: "USDC",
  deepbookBaseType: "0xbase::coin::BASE",
  deepbookQuoteType: "0xquote::coin::QUOTE",
  budgetMist: "500000000",
  expiresAtMs: "1770000000000",
  orderQuantity: "12345"
});

describe("Sui dashboard actions", () => {
  it("parses the owner natural-language mandate into policy controls", () => {
    expect(parseSuiAgentMandate("max 500 USDC, Deepbook only, expires 24h")).toEqual({
      budgetLabel: "500 USDC",
      maxBudget: "500000000",
      allowedProtocol: "DeepBook",
      expiresAtMs: "86400000",
      durationLabel: "24 hours"
    });
  });

  it.each([
    ["max 0.5 SUI, DeepBook only, expires 5m", "300000", "5 minutes"],
    ["max 0.5 SUI, DeepBook only, expires 1 minute", "60000", "1 minute"],
    ["max 0.5 SUI, DeepBook only, expires 2 hours", "7200000", "2 hours"]
  ])("parses minute and hour expiry in %s", (input, expiresAtMs, durationLabel) => {
    expect(parseSuiAgentMandate(input)).toMatchObject({ expiresAtMs, durationLabel });
  });

  it("builds a create-policy action signed by the owner", () => {
    const action = buildSuiDashboardActionPlan("create-policy", baseConfig);

    expect(action.signerRole).toBe("owner");
    expect(action.label).toBe("Create Sui policy");
    expect(action.plan.commands).toEqual([
      {
        kind: "moveCall",
        target: "0xpackage::policy::create_policy",
        arguments: ["0xagent", "500000000", "0xpool", "1770000000000"]
      }
    ]);
  });

  it("builds a create-vault action signed by the owner", () => {
    const action = buildSuiDashboardActionPlan("create-vault", baseConfig);

    expect(action.signerRole).toBe("owner");
    expect(action.plan.commands[0]).toMatchObject({
      kind: "moveCall",
      target: "0xpackage::policy::create_vault",
      typeArguments: ["0xcoin::usdc::USDC"],
      arguments: ["0xpolicy", "USDC"]
    });
  });

  it("builds a fund-vault action signed by the owner", () => {
    const action = buildSuiDashboardActionPlan("fund-vault", baseConfig);

    expect(action.signerRole).toBe("owner");
    expect(action.plan.commands[0]).toMatchObject({
      kind: "splitCoins",
      coin: "$gas",
      amounts: ["500000000"],
      resultName: "depositCoin"
    });
  });

  it("builds a revoke-policy action signed by the owner", () => {
    const action = buildSuiDashboardActionPlan("revoke-policy", baseConfig);

    expect(action.signerRole).toBe("owner");
    expect(action.plan.commands[0]).toMatchObject({
      kind: "moveCall",
      target: "0xpackage::policy::revoke",
      arguments: ["0xpolicy"]
    });
  });

  it("builds a create-balance-manager action signed by the agent", () => {
    const action = buildSuiDashboardActionPlan("create-balance-manager", {
      ...baseConfig,
      deepbookPackageId: "0xdeepbook"
    });

    expect(action.signerRole).toBe("agent");
    expect(action.plan.commands.map((command) => command.kind === "moveCall" ? command.target : command.kind)).toEqual([
      "0xdeepbook::balance_manager::new",
      "0x2::transfer::public_share_object"
    ]);
  });

  it("builds an autonomous DeepBook strategy signed by the agent", () => {
    const action = buildSuiDashboardActionPlan("run-deepbook-strategy", {
      ...baseConfig,
      deepbookPackageId: "0xdeepbook",
      balanceManagerId: "0xbalance"
    });

    expect(action.signerRole).toBe("agent");
    expect(action.plan.commands[0]).toMatchObject({
      kind: "moveCall",
      typeArguments: ["0xcoin::usdc::USDC"]
    });
    expect(action.plan.commands.filter((command) => command.kind === "moveCall").map((command) => command.target)).toEqual([
      "0xpackage::policy::take_budgeted_coin",
      "0xdeepbook::balance_manager::deposit",
      "0xdeepbook::balance_manager::generate_proof_as_owner",
      "0xdeepbook::pool::place_limit_order"
    ]);
    expect(action.plan.commands[3]).toMatchObject({
      kind: "moveCall",
      typeArguments: ["0xbase::coin::BASE", "0xquote::coin::QUOTE"]
    });
  });

  it("builds a sell strategy as a DeepBook ask", () => {
    const action = buildSuiDashboardActionPlan("run-deepbook-strategy", {
      ...baseConfig,
      deepbookPackageId: "0xdeepbook",
      balanceManagerId: "0xbalance",
      orderSide: "ask"
    });

    expect(action.plan.commands[3]).toMatchObject({
      kind: "moveCall",
      arguments: expect.arrayContaining(["false"])
    });
  });

  it("builds a market strategy as an exact-quote DeepBook swap that returns output", () => {
    const action = buildSuiDashboardActionPlan("run-deepbook-strategy", {
      ...baseConfig,
      deepbookPackageId: "0xdeepbook",
      balanceManagerId: "0xbalance",
      orderExecution: "market"
    });

    const orderCommand = action.plan.commands[2];
    expect(orderCommand).toMatchObject({
      kind: "moveCall",
      target: "0xdeepbook::pool::swap_exact_quote_for_base",
      arguments: ["0xpool", "$agentwalletCoin", "$deepbookFeeCoin", "1", "0x6"],
      resultNames: ["deepbookBaseOut", "deepbookQuoteOut", "deepbookFeeOut"]
    });
    expect(action.plan.commands[3]).toEqual({
      kind: "transferObjects",
      objects: ["$deepbookBaseOut", "$deepbookQuoteOut", "$deepbookFeeOut"],
      recipient: "0xagent"
    });
  });

  it("merges policy and vault object ids from successful transaction results", () => {
    const nextConfig = mergeSuiActionResultIntoConfig(baseConfig, {
      ok: true,
      digest: "abc",
      status: "success",
      explorerUrl: "https://example.com",
      raw: {
        digest: "abc",
        objectChanges: [
          {
            type: "created",
            objectId: "0xnewpolicy",
            objectType: "0xpackage::policy::AgentPolicy"
          },
          {
            type: "created",
            objectId: "0xnewvault",
            objectType: "0xpackage::policy::AgentVault<0x2::sui::SUI>"
          }
        ]
      }
    });

    expect(nextConfig.policyId).toBe("0xnewpolicy");
    expect(nextConfig.vaultId).toBe("0xnewvault");
  });

  it("merges the DeepBook balance manager id from agent-created events", () => {
    const nextConfig = mergeSuiActionResultIntoConfig(baseConfig, {
      ok: true,
      digest: "abc",
      status: "success",
      explorerUrl: "https://example.com",
      raw: {
        digest: "abc",
        events: [
          {
            type: "0xdeepbook::balance_manager::BalanceManagerEvent",
            parsedJson: {
              balance_manager_id: "0xbalance"
            }
          }
        ]
      }
    });

    expect(nextConfig.balanceManagerId).toBe("0xbalance");
  });

  it("merges object ids and event fields from Sui gRPC transaction responses", () => {
    const nextConfig = mergeSuiActionResultIntoConfig(baseConfig, {
      ok: true,
      digest: "grpc-digest",
      status: "success",
      explorerUrl: "https://example.com",
      raw: {
        digest: "grpc-digest",
        effects: {
          changedObjects: [
            { objectId: "0xgrpcpolicy", idOperation: "Created" },
            { objectId: "0xgrpcvault", idOperation: "Created" }
          ]
        },
        objectTypes: {
          "0xgrpcpolicy": "0xpackage::policy::AgentPolicy",
          "0xgrpcvault": "0xpackage::policy::AgentVault<0x2::sui::SUI>"
        },
        events: [
          {
            eventType: "0xdeepbook::balance_manager::BalanceManagerEvent",
            json: { balance_manager_id: "0xgrpcmanager" }
          }
        ]
      }
    });

    expect(nextConfig.policyId).toBe("0xgrpcpolicy");
    expect(nextConfig.vaultId).toBe("0xgrpcvault");
    expect(nextConfig.balanceManagerId).toBe("0xgrpcmanager");
  });

  it("builds a fresh setup-only launch flow", () => {
    expect(
      buildSuiAutonomousDemoSteps({
        ...baseConfig,
        policyId: "",
        vaultId: "",
        balanceManagerId: ""
      })
    ).toEqual([
      "create-policy",
      "create-vault",
      "fund-vault",
      "create-balance-manager"
    ]);
  });

  it("has no launch transactions after all setup objects exist", () => {
    expect(
      buildSuiAutonomousDemoSteps({
        ...baseConfig,
        balanceManagerId: "0xbalance"
      })
    ).toEqual([]);
  });

  it("retries vault funding after a partial launch created an unfunded vault", () => {
    expect(
      buildSuiAutonomousDemoSteps(
        {
          ...baseConfig,
          balanceManagerId: ""
        },
        { vaultFunded: false }
      )
    ).toEqual(["fund-vault", "create-balance-manager"]);
  });

  it("builds an amount that must exceed the configured policy ceiling", () => {
    expect(buildSuiOverBudgetConfig({ ...baseConfig, budgetMist: "500000000" }).spendAmount).toBe("500000001");
  });

  it("describes the expected budget ceiling rejection without presenting it as a broken transaction", () => {
    expect(
      describeSuiBudgetProofRejection(
        "Transaction resolution failed: MoveAbort in 1st command, abort code: 6, in '0xpackage::policy::record_budget_use' (instruction 51)"
      )
    ).toBe("Budget ceiling verified: the Move policy blocked the deliberate over-budget action.");
  });
});
