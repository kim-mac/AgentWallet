import { describe, expect, it, vi } from "vitest";
import {
  buildSuiDeepBookDemoPlan,
  formatSuiDemoResult,
  parseSuiDeepBookDemoConfig,
  runSuiDeepBookDemo
} from "./sui-demo";

describe("Sui DeepBook demo runner", () => {
  const objectId = `0x${"1".repeat(64)}`;
  const policyId = `0x${"2".repeat(64)}`;
  const vaultId = `0x${"3".repeat(64)}`;
  const poolId = `0x${"4".repeat(64)}`;
  const balanceManagerId = `0x${"5".repeat(64)}`;
  const env = {
    SUI_PACKAGE_ID: objectId,
    SUI_POLICY_ID: policyId,
    SUI_VAULT_ID: vaultId,
    SUI_COIN_TYPE: "0x2::sui::SUI",
    SUI_ORDER_AMOUNT: "1000000",
    SUI_DEEPBOOK_PACKAGE_ID: objectId,
    SUI_DEEPBOOK_POOL_ID: poolId,
    SUI_DEEPBOOK_BASE_TYPE: "0xdeep::DEEP",
    SUI_DEEPBOOK_QUOTE_TYPE: "0x2::sui::SUI",
    SUI_BALANCE_MANAGER_ID: balanceManagerId,
    SUI_ORDER_TYPE: "bid",
    SUI_ORDER_PRICE: "1200000000",
    SUI_ORDER_QUANTITY: "1000000",
    SUI_CLOCK_ID: "0x6",
    SUI_NETWORK: "testnet"
  };

  it("parses required Sui and DeepBook env values", () => {
    expect(parseSuiDeepBookDemoConfig(env)).toMatchObject({
      packageId: objectId,
      policyId,
      vaultId,
      coinType: "0x2::sui::SUI",
      deepBookBaseType: "0xdeep::DEEP",
      deepBookQuoteType: "0x2::sui::SUI",
      orderType: "bid",
      network: "testnet"
    });
  });

  it("reports missing env values before building a transaction", () => {
    expect(() =>
      parseSuiDeepBookDemoConfig({
        ...env,
        SUI_POLICY_ID: ""
      })
    ).toThrow("Missing Sui demo env: SUI_POLICY_ID");
  });

  it("builds the DeepBook plan from parsed config", () => {
    const plan = buildSuiDeepBookDemoPlan(parseSuiDeepBookDemoConfig(env));

    expect(plan.commands.filter((command) => command.kind === "moveCall").map((command) => command.target)).toEqual([
      `${objectId}::policy::take_budgeted_coin`,
      `${objectId}::balance_manager::deposit`,
      `${objectId}::balance_manager::generate_proof_as_owner`,
      `${objectId}::pool::place_limit_order`
    ]);
  });

  it("submits the plan with the provided client and signer", async () => {
    const client = {
      signAndExecuteTransaction: vi.fn(async ({ transaction }) => {
        expect(JSON.stringify(transaction.getData())).toContain("place_limit_order");
        return {
          digest: "SuiDigest",
          effects: { status: { status: "success" } }
        };
      })
    };

    await expect(
      runSuiDeepBookDemo({
        config: parseSuiDeepBookDemoConfig(env),
        client,
        signer: { label: "agent" }
      })
    ).resolves.toMatchObject({
      ok: true,
      digest: "SuiDigest",
      explorerUrl: "https://suiexplorer.com/txblock/SuiDigest?network=testnet"
    });
  });

  it("formats success and failure output for the CLI", () => {
    expect(
      formatSuiDemoResult({
        ok: true,
        digest: "SuiDigest",
        status: "success",
        explorerUrl: "https://suiexplorer.com/txblock/SuiDigest?network=testnet",
        raw: { digest: "SuiDigest" }
      })
    ).toContain("Sui DeepBook order submitted");

    expect(
      formatSuiDemoResult({
        ok: false,
        error: "MoveAbort(policy, 6)"
      })
    ).toContain("Sui DeepBook order failed");
  });
});
