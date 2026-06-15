import { describe, expect, it } from "vitest";
import {
  buildSuiDeepBookBalanceManagerPlan,
  formatSuiDeepBookBalanceManagerResult,
  parseSuiDeepBookBalanceManagerConfig
} from "./sui-deepbook";

describe("Sui DeepBook helpers", () => {
  it("parses balance manager config from env", () => {
    expect(
      parseSuiDeepBookBalanceManagerConfig({
        SUI_DEEPBOOK_PACKAGE_ID: " 0xdeepbook ",
        SUI_NETWORK: "testnet"
      })
    ).toEqual({
      deepBookPackageId: "0xdeepbook",
      network: "testnet"
    });
  });

  it("builds a balance manager plan from parsed config", () => {
    expect(
      buildSuiDeepBookBalanceManagerPlan({
        deepBookPackageId: "0xdeepbook",
        network: "testnet"
      }).commands
    ).toEqual([
      {
        kind: "moveCall",
        target: "0xdeepbook::balance_manager::new",
        arguments: [],
        resultName: "balanceManager"
      },
      {
        kind: "moveCall",
        target: "0x2::transfer::public_share_object",
        typeArguments: ["0xdeepbook::balance_manager::BalanceManager"],
        arguments: ["$balanceManager"]
      }
    ]);
  });

  it("prints the created balance manager id from DeepBook events", () => {
    expect(
      formatSuiDeepBookBalanceManagerResult({
        ok: true,
        digest: "digest",
        status: "success",
        explorerUrl: "https://suiexplorer.com/txblock/digest?network=testnet",
        raw: {
          digest: "digest",
          events: [
            {
              type: "0xdeepbook::balance_manager::BalanceManagerEvent",
              parsedJson: {
                balance_manager_id: "0xbalance",
                owner: "0xowner"
              }
            }
          ]
        }
      })
    ).toContain("BalanceManager ID: 0xbalance");
  });
});
