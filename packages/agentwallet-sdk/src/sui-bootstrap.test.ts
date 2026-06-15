import { describe, expect, it, vi } from "vitest";
import {
  buildSuiPolicyBootstrapPlan,
  buildSuiPolicyRevokePlan,
  buildSuiVaultDepositPlan,
  buildSuiVaultBootstrapPlan,
  formatSuiBootstrapResult,
  parseSuiPolicyBootstrapConfig,
  parseSuiPolicyRevokeConfig,
  parseSuiVaultDepositConfig,
  parseSuiVaultBootstrapConfig,
  runSuiPlan
} from "./sui-bootstrap";

describe("Sui bootstrap and revoke scripts", () => {
  const packageId = `0x${"1".repeat(64)}`;
  const agent = `0x${"2".repeat(64)}`;
  const poolId = `0x${"3".repeat(64)}`;
  const policyId = `0x${"4".repeat(64)}`;
  const vaultId = `0x${"5".repeat(64)}`;

  it("parses owner policy bootstrap env", () => {
    expect(
      parseSuiPolicyBootstrapConfig({
        SUI_PACKAGE_ID: packageId,
        SUI_AGENT_ADDRESS: agent,
        SUI_MAX_BUDGET: "500000000",
        SUI_ALLOWED_POOL_ID: poolId,
        SUI_EXPIRES_AT_MS: "1770000000000",
        SUI_NETWORK: "testnet"
      })
    ).toMatchObject({
      packageId,
      agent,
      maxBudget: "500000000",
      allowedPoolId: poolId,
      network: "testnet"
    });
  });

  it("fails fast when required policy bootstrap env is missing", () => {
    expect(() =>
      parseSuiPolicyBootstrapConfig({
        SUI_PACKAGE_ID: packageId,
        SUI_AGENT_ADDRESS: "",
        SUI_MAX_BUDGET: "500000000",
        SUI_ALLOWED_POOL_ID: poolId,
        SUI_EXPIRES_AT_MS: "1770000000000"
      })
    ).toThrow("Missing Sui policy bootstrap env: SUI_AGENT_ADDRESS");
  });

  it("builds owner policy and vault bootstrap plans", () => {
    expect(
      buildSuiPolicyBootstrapPlan(
        parseSuiPolicyBootstrapConfig({
          SUI_PACKAGE_ID: packageId,
          SUI_AGENT_ADDRESS: agent,
          SUI_MAX_BUDGET: "500000000",
          SUI_ALLOWED_POOL_ID: poolId,
          SUI_EXPIRES_AT_MS: "1770000000000"
        })
      ).commands
    ).toEqual([
      {
        kind: "moveCall",
        target: `${packageId}::policy::create_policy`,
        arguments: [agent, "500000000", poolId, "1770000000000"]
      }
    ]);

    expect(
      buildSuiVaultBootstrapPlan(
        parseSuiVaultBootstrapConfig({
          SUI_PACKAGE_ID: packageId,
          SUI_POLICY_ID: policyId,
          SUI_COIN_TYPE: "0x2::sui::SUI",
          SUI_TOKEN_TYPE_LABEL: "SUI"
        })
      ).commands
    ).toEqual([
      {
        kind: "moveCall",
        target: `${packageId}::policy::create_vault`,
        typeArguments: ["0x2::sui::SUI"],
        arguments: [policyId, "SUI"]
      }
    ]);
  });

  it("parses and builds an owner vault funding plan", () => {
    const config = parseSuiVaultDepositConfig({
      SUI_PACKAGE_ID: packageId,
      SUI_VAULT_ID: vaultId,
      SUI_COIN_TYPE: "0x2::sui::SUI",
      SUI_DEPOSIT_AMOUNT: "250000000"
    });

    expect(config).toMatchObject({
      packageId,
      vaultId,
      coinType: "0x2::sui::SUI",
      amount: "250000000",
      network: "testnet"
    });
    expect(buildSuiVaultDepositPlan(config).commands).toEqual([
      {
        kind: "splitCoins",
        coin: "$gas",
        amounts: ["250000000"],
        resultName: "depositCoin"
      },
      {
        kind: "moveCall",
        target: `${packageId}::policy::deposit`,
        typeArguments: ["0x2::sui::SUI"],
        arguments: [vaultId, "$depositCoin"]
      }
    ]);
  });

  it("builds owner revoke plan", () => {
    const config = parseSuiPolicyRevokeConfig({
      SUI_PACKAGE_ID: packageId,
      SUI_POLICY_ID: policyId
    });

    expect(buildSuiPolicyRevokePlan(config).commands).toEqual([
      {
        kind: "moveCall",
        target: `${packageId}::policy::revoke`,
        arguments: [policyId]
      }
    ]);
  });

  it("submits a bootstrap plan and formats the output", async () => {
    const client = {
      signAndExecuteTransaction: vi.fn(async () => ({
        digest: "BootstrapDigest",
        effects: { status: { status: "success" } }
      }))
    };
    const result = await runSuiPlan({
      client,
      signer: { label: "owner" },
      plan: buildSuiPolicyRevokePlan({ packageId, policyId, network: "testnet" }),
      network: "testnet"
    });

    expect(result).toMatchObject({
      ok: true,
      digest: "BootstrapDigest"
    });
    expect(formatSuiBootstrapResult("revoke policy", result)).toContain(
      "Sui revoke policy transaction submitted"
    );
  });
});
