import { describe, expect, it } from "vitest";
import {
  applySuiDeepBookMarket,
  buildSuiDashboardCommands,
  buildSuiBalanceRpcRequest,
  buildSuiDeepBookEventRpcRequest,
  buildSuiTransactionBlockRpcRequest,
  canReviewSuiLaunchStage,
  describeSuiOrderAssetFlow,
  buildSuiEventRpcRequest,
  getSuiLaunchStage,
  getSuiFundingReadiness,
  getSuiGasReadiness,
  getSuiBudgetMetrics,
  getSuiPolicyExpiryState,
  getSuiProofSummary,
  findSuiDeepBookMarketId,
  formatSuiTokenAmount,
  mergeSuiActivityIntoConfig,
  normalizeSuiDashboardConfig,
  parseSuiEventRpcResponse,
  parseSuiBalanceRpcResponse,
  parseSuiDeepBookOrders,
  parseSuiGrpcBalanceResponse,
  parseSuiGrpcCoinBalanceResponse,
  resolveSuiActivityConfig,
  suiActivityEventLabels,
  suiDeepBookMarkets,
  suiOverflowProofItems
} from "./sui-dashboard";

describe("Sui dashboard helpers", () => {
  it("builds copyable commands for the Sui owner and DeepBook demo flow", () => {
    const commands = buildSuiDashboardCommands({
      packageId: "0xpackage",
      policyId: "0xpolicy",
      vaultId: "0xvault",
      agentAddress: "0xagent",
      allowedPoolId: "0xpool",
      balanceManagerId: "0xbalance",
      deepbookPackageId: "0xdeepbook",
      coinType: "0xcoin::usdc::USDC",
      tokenTypeLabel: "USDC",
      deepbookBaseType: "0xbase::coin::BASE",
      deepbookQuoteType: "0xquote::coin::QUOTE",
      budgetMist: "9000000",
      expiresAtMs: "1800000000000",
      spendAmount: "700000",
      orderQuantity: "42",
      limitPrice: "123"
    });

    expect(commands.map((command) => command.id)).toEqual([
      "publish-package",
      "create-policy",
      "create-vault",
      "fund-vault",
      "create-balance-manager",
      "deepbook-order",
      "revoke-policy"
    ]);
    expect(commands[0]?.command).toContain("sui.exe client publish sui/agent_wallet");
    expect(commands[1]?.command).toContain("npm run sui:owner -w @agentwallet/sdk -- create-policy");
    expect(commands[1]?.command).toContain("SUI_MAX_BUDGET");
    expect(commands[2]?.command).toContain("SUI_COIN_TYPE");
    expect(commands[2]?.command).toContain('$env:SUI_COIN_TYPE="0xcoin::usdc::USDC"');
    expect(commands[2]?.command).toContain('$env:SUI_TOKEN_TYPE_LABEL="USDC"');
    expect(commands[3]?.command).toContain("npm run sui:owner -w @agentwallet/sdk -- fund-vault");
    expect(commands[3]?.command).toContain('$env:SUI_DEPOSIT_AMOUNT="9000000"');
    expect(commands[3]?.command).toContain('$env:SUI_COIN_TYPE="0xcoin::usdc::USDC"');
    expect(commands[4]?.command).toContain("npm run sui:deepbook -w @agentwallet/sdk -- create-balance-manager");
    expect(commands[5]?.command).toContain("npm run sui:deepbook-demo -w @agentwallet/sdk");
    expect(commands[5]?.command).toContain('$env:SUI_BALANCE_MANAGER_ID="0xbalance"');
    expect(commands[5]?.command).toContain('$env:SUI_DEEPBOOK_BASE_TYPE="0xbase::coin::BASE"');
    expect(commands[5]?.command).toContain('$env:SUI_DEEPBOOK_QUOTE_TYPE="0xquote::coin::QUOTE"');
    expect(commands[5]?.command).toContain('$env:SUI_ORDER_PRICE="123"');
    expect(commands[5]?.command).toContain('$env:SUI_ORDER_QUANTITY="42"');
    expect(commands[6]?.command).toContain("npm run sui:owner -w @agentwallet/sdk -- revoke-policy");
  });

  it("normalizes saved Sui config values", () => {
    expect(
      normalizeSuiDashboardConfig({
        packageId: " 0xPACKAGE ",
        policyId: "0xpolicy",
        vaultId: undefined,
        budgetMist: "",
        expiresAtMs: " 1800 "
      })
    ).toMatchObject({
      packageId: "0xPACKAGE",
      policyId: "0xpolicy",
      vaultId: "",
      budgetMist: "500000000",
      expiresAtMs: "1800",
      orderExecution: "limit"
    });
  });

  it("normalizes market order execution mode", () => {
    expect(normalizeSuiDashboardConfig({ orderExecution: "market" }).orderExecution).toBe("market");
    expect(normalizeSuiDashboardConfig({ orderExecution: "post-only" as never }).orderExecution).toBe("limit");
  });

  it("uses the deployed AgentWallet Sui package by default", () => {
    expect(normalizeSuiDashboardConfig(null).packageId).toBe(
      "0x768743700b22d533d228719672e17009a48a4dac473ae7f1d1d2733f6c1defa9"
    );
  });

  it("builds and parses Sui testnet balance requests", () => {
    expect(buildSuiBalanceRpcRequest("0xowner")).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "suix_getBalance",
      params: ["0xowner", "0x2::sui::SUI"]
    });
    expect(parseSuiBalanceRpcResponse({ result: { totalBalance: "150000000" } })).toBe("150000000");
  });

  it("parses the Mysten gRPC balance response used by the dashboard balance route", () => {
    expect(
      parseSuiGrpcBalanceResponse({
        balance: {
          balance: "250000000",
          coinType: "0x2::sui::SUI"
        }
      })
    ).toBe("250000000");
    expect(parseSuiGrpcBalanceResponse(null)).toBe("0");
  });

  it("parses arbitrary Sui coin balances for acquired assets", () => {
    expect(
      parseSuiGrpcCoinBalanceResponse({
        balance: {
          balance: "123456789",
          coinType: "0xdeep::DEEP"
        }
      })
    ).toBe("123456789");
    expect(parseSuiGrpcCoinBalanceResponse({})).toBe("0");
  });

  it("derives the current guided Sui launch stage", () => {
    expect(getSuiLaunchStage({ hasPassword: false, hasWallets: false, walletsFunded: false, unlocked: false, mandateApplied: false, launched: false })).toBe("password");
    expect(getSuiLaunchStage({ hasPassword: true, hasWallets: true, walletsFunded: false, unlocked: false, mandateApplied: false, launched: false })).toBe("fund");
    expect(getSuiLaunchStage({ hasPassword: true, hasWallets: true, walletsFunded: true, unlocked: true, mandateApplied: true, launched: false })).toBe("launch");
    expect(getSuiLaunchStage({ hasPassword: true, hasWallets: true, walletsFunded: true, unlocked: true, mandateApplied: true, launched: true })).toBe("console");
  });

  it("allows review of completed and current Sui launch steps but locks future steps", () => {
    expect(canReviewSuiLaunchStage("console", "password")).toBe(true);
    expect(canReviewSuiLaunchStage("console", "launch")).toBe(true);
    expect(canReviewSuiLaunchStage("fund", "fund")).toBe(true);
    expect(canReviewSuiLaunchStage("fund", "unlock")).toBe(false);
  });

  it("requires the owner to hold the SUI vault budget plus gas before launch", () => {
    expect(
      getSuiFundingReadiness({
        ownerBalance: "400000000",
        agentBalance: "900000000",
        budgetMist: "500000000",
        coinType: "0x2::sui::SUI"
      })
    ).toMatchObject({
      ready: false,
      ownerReady: false,
      agentReady: true,
      requiredOwnerBalance: "550000000"
    });

    expect(
      getSuiFundingReadiness({
        ownerBalance: "600000000",
        agentBalance: "100000000",
        budgetMist: "500000000",
        coinType: "0x2::sui::SUI"
      }).ready
    ).toBe(true);
  });

  it("requires only transaction gas before the owner chooses a mandate budget", () => {
    expect(
      getSuiGasReadiness({
        ownerBalance: "50000000",
        agentBalance: "50000000"
      })
    ).toEqual({
      ready: true,
      ownerReady: true,
      agentReady: true,
      requiredOwnerBalance: "50000000",
      requiredAgentBalance: "50000000"
    });
  });

  it("derives used and remaining policy budget from the latest on-chain budget event", () => {
    expect(
      getSuiBudgetMetrics("500000000", [
        {
          id: "latest:0",
          digest: "latest",
          sequence: "0",
          type: "AgentBudgetUsed",
          timestampMs: "2",
          summary: "AgentBudgetUsed",
          parsedJson: { remaining_budget: "400000000" }
        },
        {
          id: "older:0",
          digest: "older",
          sequence: "0",
          type: "AgentBudgetUsed",
          timestampMs: "1",
          summary: "AgentBudgetUsed",
          parsedJson: { remaining_budget: "450000000" }
        }
      ])
    ).toEqual({
      maxBudget: "500000000",
      usedBudget: "100000000",
      remainingBudget: "400000000"
    });
  });

  it("shows the full policy budget remaining before the first on-chain spend", () => {
    expect(getSuiBudgetMetrics("500000000", [])).toEqual({
      maxBudget: "500000000",
      usedBudget: "0",
      remainingBudget: "500000000"
    });
  });

  it("formats policy budget values using the mandate token decimals", () => {
    expect(formatSuiTokenAmount("100000000", "SUI")).toBe("0.1 SUI");
    expect(formatSuiTokenAmount("450000000", "USDC")).toBe("450 USDC");
    expect(formatSuiTokenAmount("123456789", "DEEP")).toBe("123.456789 DEEP");
  });

  it("shows an active countdown and then marks a Sui policy expired", () => {
    expect(getSuiPolicyExpiryState("160000", 100000)).toEqual({
      expired: false,
      label: "Expires in 1m 0s"
    });
    expect(getSuiPolicyExpiryState("100000", 100001)).toEqual({
      expired: true,
      label: "Expired"
    });
  });

  it("provides a verified DeepBook testnet market catalog", () => {
    expect(suiDeepBookMarkets).toContainEqual(
      expect.objectContaining({
        id: "deep-sui-testnet",
        label: "DEEP / SUI",
        network: "testnet",
        deepbookPackageId: "0xbc331f09e5c737d45f074ad2d17c3038421b3b9018699e370d88d94938c53d28",
        poolId: "0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f",
        quoteAssetType: "0x2::sui::SUI"
      })
    );
  });

  it("applies a selected DeepBook market without replacing owner proof state", () => {
    const config = applySuiDeepBookMarket(
      normalizeSuiDashboardConfig({
        packageId: "0xagentwallet",
        policyId: "0xpolicy",
        vaultId: "0xvault",
        agentAddress: "0xagent",
        balanceManagerId: "0xmanager"
      }),
      "deep-sui-testnet"
    );

    expect(config).toMatchObject({
      packageId: "0xagentwallet",
      policyId: "0xpolicy",
      vaultId: "0xvault",
      agentAddress: "0xagent",
      balanceManagerId: "0xmanager",
      allowedPoolId: "0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f",
      deepbookPackageId: "0xbc331f09e5c737d45f074ad2d17c3038421b3b9018699e370d88d94938c53d28",
      coinType: "0x2::sui::SUI",
      tokenTypeLabel: "SUI",
      orderQuantity: "10000000",
      limitPrice: "10000000000",
      spendAmount: "100000000"
    });
    expect(findSuiDeepBookMarketId(config)).toBe("deep-sui-testnet");
    expect(findSuiDeepBookMarketId({ ...config, allowedPoolId: "0xcustom" })).toBe("custom");
  });

  it("builds a Sui event query for the AgentWallet Move module", () => {
    expect(buildSuiEventRpcRequest({ packageId: "0xpackage" })).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "suix_queryEvents",
      params: [{ MoveModule: { package: "0xpackage", module: "policy" } }, null, 50, true]
    });
  });

  it("builds DeepBook event queries for order lifecycle modules", () => {
    expect(buildSuiDeepBookEventRpcRequest("0xdeepbook", "pool")).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "suix_queryEvents",
      params: [{ MoveModule: { package: "0xdeepbook", module: "pool" } }, null, 50, true]
    });
  });

  it("builds an exact transaction query that includes emitted events", () => {
    expect(buildSuiTransactionBlockRpcRequest(" strategy-digest ")).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "sui_getTransactionBlock",
      params: ["strategy-digest", { showEvents: true }]
    });
  });

  it("parses and aggregates DeepBook order lifecycle events for the selected manager", () => {
    const orders = parseSuiDeepBookOrders(
      [
        {
          result: {
            data: [
              {
                id: { txDigest: "placed-digest", eventSeq: "0" },
                type: "0xdeepbook::order_info::OrderPlaced",
                parsedJson: {
                  balance_manager_id: "0xmanager",
                  pool_id: "0xpool",
                  order_id: "42",
                  price: "10000000000",
                  order_type: "1",
                  is_bid: true,
                  placed_quantity: "10000000",
                  timestamp: "1770000000000"
                }
              },
              {
                id: { txDigest: "filled-digest", eventSeq: "1" },
                type: "0xdeepbook::order_info::OrderFullyFilled",
                parsedJson: {
                  balance_manager_id: "0xmanager",
                  pool_id: "0xpool",
                  order_id: "42",
                  original_quantity: "10000000",
                  is_bid: true,
                  timestamp: "1770000001000"
                }
              }
            ]
          }
        }
      ],
      { balanceManagerId: "0xmanager", poolId: "0xpool", marketLabel: "DEEP / SUI" }
    );

    expect(orders).toEqual([
      expect.objectContaining({
        orderId: "42",
        market: "DEEP / SUI",
        poolId: "0xpool",
        side: "buy",
        execution: "market",
        assetFlow: "SUI -> DEEP",
        baseAsset: "DEEP",
        quoteAsset: "SUI",
        baseQuantity: "10000000",
        quoteQuantity: "",
        amountEvidence: "10000000 DEEP requested with SUI",
        transactionUrl: "https://suiexplorer.com/txblock/filled-digest?network=testnet",
        status: "filled",
        price: "10000000000",
        quantity: "10000000",
        digest: "filled-digest"
      })
    ]);
  });

  it("describes asset flow from a DeepBook market pair and order side", () => {
    expect(describeSuiOrderAssetFlow("DEEP / SUI", "buy")).toBe("SUI -> DEEP");
    expect(describeSuiOrderAssetFlow("DEEP / SUI", "sell")).toBe("DEEP -> SUI");
    expect(describeSuiOrderAssetFlow("BTC / USDC", "buy")).toBe("USDC -> BTC");
  });

  it("keeps only the selected balance manager side of a DeepBook fill", () => {
    const orders = parseSuiDeepBookOrders(
      [{
        result: {
          data: [{
            id: { txDigest: "fill", eventSeq: "0" },
            type: "0xdeepbook::order_info::OrderFilled",
            parsedJson: {
              maker_order_id: "maker-order",
              taker_order_id: "agent-order",
              maker_balance_manager_id: "0xother",
              taker_balance_manager_id: "0xagent",
              pool_id: "0xpool",
              taker_is_bid: true,
              price: "10",
              base_quantity: "5",
              timestamp: "1"
            }
          }]
        }
      }],
      { balanceManagerId: "0xagent", poolId: "0xpool", marketLabel: "DEEP / SUI" }
    );

    expect(orders.map((order) => order.orderId)).toEqual(["agent-order"]);
  });

  it("shows filled swap amounts when DeepBook emits quote and base quantities", () => {
    const orders = parseSuiDeepBookOrders(
      [{
        result: {
          data: [{
            id: { txDigest: "fill", eventSeq: "0" },
            type: "0xdeepbook::order_info::OrderFilled",
            parsedJson: {
              maker_order_id: "maker-order",
              taker_order_id: "agent-order",
              maker_balance_manager_id: "0xother",
              taker_balance_manager_id: "0xagent",
              pool_id: "0xpool",
              taker_is_bid: true,
              price: "10",
              base_quantity: "5",
              quote_quantity: "50",
              timestamp: "1"
            }
          }]
        }
      }],
      { balanceManagerId: "0xagent", poolId: "0xpool", marketLabel: "DEEP / SUI" }
    );

    expect(orders).toEqual([
      expect.objectContaining({
        orderId: "agent-order",
        assetFlow: "SUI -> DEEP",
        amountEvidence: "50 SUI -> 5 DEEP",
        transactionUrl: "https://suiexplorer.com/txblock/fill?network=testnet"
      })
    ]);
  });

  it("parses an OrderPlaced event from an exact strategy transaction response", () => {
    const orders = parseSuiDeepBookOrders(
      [{
        result: {
          digest: "strategy-digest",
          events: [{
            id: { txDigest: "strategy-digest", eventSeq: "3" },
            transactionModule: "pool",
            type: "0xevents::order_info::OrderPlaced",
            parsedJson: {
              balance_manager_id: "0xmanager",
              pool_id: "0xpool",
              order_id: "184467440755542260233709280272",
              price: "10000000000",
              is_bid: true,
              placed_quantity: "10000000",
              timestamp: "1781315117161"
            }
          }]
        }
      }],
      { balanceManagerId: "0xmanager", poolId: "0xpool", marketLabel: "DEEP / SUI" }
    );

    expect(orders).toEqual([
      expect.objectContaining({
        orderId: "184467440755542260233709280272",
        status: "open",
        digest: "strategy-digest"
      })
    ]);
  });

  it("uses the latest transaction execution hint when DeepBook events omit order type", () => {
    const orders = parseSuiDeepBookOrders(
      [{
        result: {
          digest: "strategy-digest",
          events: [{
            id: { txDigest: "strategy-digest", eventSeq: "3" },
            type: "0xevents::order_info::OrderPlaced",
            parsedJson: {
              balance_manager_id: "0xmanager",
              pool_id: "0xpool",
              order_id: "99",
              price: "10000000000",
              is_bid: true,
              placed_quantity: "10000000",
              timestamp: "1781315117161"
            }
          }]
        }
      }],
      {
        balanceManagerId: "0xmanager",
        poolId: "0xpool",
        marketLabel: "DEEP / SUI",
        transactionDigest: "strategy-digest",
        executionHint: "market"
      }
    );

    expect(orders).toEqual([
      expect.objectContaining({
        orderId: "99",
        execution: "market",
        assetFlow: "SUI -> DEEP"
      })
    ]);
  });

  it("keeps market order evidence from the exact transaction even when the balance manager id is omitted", () => {
    const orders = parseSuiDeepBookOrders(
      [{
        result: {
          digest: "market-digest",
          events: [{
            id: { txDigest: "market-digest", eventSeq: "4" },
            type: "0xdeepbook::order_info::OrderFilled",
            parsedJson: {
              pool_id: "0xpool",
              taker_order_id: "agent-market-order",
              taker_is_bid: true,
              price: "10000000000",
              base_quantity: "10000000",
              quote_quantity: "100000000",
              timestamp: "1781315117161"
            }
          }]
        }
      }],
      {
        balanceManagerId: "0xmanager",
        poolId: "0xpool",
        marketLabel: "DEEP / SUI",
        transactionDigest: "market-digest",
        executionHint: "market"
      }
    );

    expect(orders).toEqual([
      expect.objectContaining({
        orderId: "agent-market-order",
        execution: "market",
        side: "buy",
        amountEvidence: "100000000 SUI -> 10000000 DEEP",
        digest: "market-digest"
      })
    ]);
  });

  it("ignores click-event-shaped activity overrides and uses the current config", () => {
    const current = normalizeSuiDashboardConfig({ packageId: "0xpackage", policyId: "0xpolicy" });

    expect(resolveSuiActivityConfig({ type: "click" }, current)).toMatchObject({
      packageId: "0xpackage",
      policyId: "0xpolicy"
    });
  });

  it("parses Sui RPC event responses into dashboard events", () => {
    const events = parseSuiEventRpcResponse(
      {
        result: {
          data: [
            {
              id: { txDigest: "abc", eventSeq: "0" },
              type: "0xpackage::policy::AgentBudgetUsed",
              timestampMs: "1770000000000",
              parsedJson: {
                agent: "0xagent",
                policy: "0xpolicy",
                vault: "0xvault",
                amount: "100"
              }
            }
          ]
        }
      },
      { policyId: "0xpolicy", vaultId: "0xvault", agentAddress: "0xagent" }
    );

    expect(events).toEqual([
      {
        id: "abc:0",
        digest: "abc",
        sequence: "0",
        type: "AgentBudgetUsed",
        timestampMs: "1770000000000",
        summary: "AgentBudgetUsed for 0xpolicy",
        parsedJson: {
          agent: "0xagent",
          policy: "0xpolicy",
          vault: "0xvault",
          amount: "100"
        }
      }
    ]);
  });

  it("keeps policy and vault events when they only include their own object ids", () => {
    const events = parseSuiEventRpcResponse(
      {
        result: {
          data: [
            {
              id: { txDigest: "policy-digest", eventSeq: "0" },
              type: "0xpackage::policy::PolicyCreated",
              timestampMs: "1770000000000",
              parsedJson: {
                agent: "0xagent",
                policy_id: "0xpolicy"
              }
            },
            {
              id: { txDigest: "vault-digest", eventSeq: "0" },
              type: "0xpackage::policy::AgentVaultCreated",
              timestampMs: "1770000000001",
              parsedJson: {
                policy_id: "0xpolicy",
                vault_id: "0xvault"
              }
            }
          ]
        }
      },
      { policyId: "0xpolicy", vaultId: "0xvault", agentAddress: "0xagent" }
    );

    expect(events.map((event) => event.type)).toEqual(["PolicyCreated", "AgentVaultCreated"]);
  });

  it("recovers policy and vault ids from fetched on-chain activity", () => {
    const config = mergeSuiActivityIntoConfig(normalizeSuiDashboardConfig(null), [
      {
        id: "policy:0",
        digest: "policy",
        sequence: "0",
        type: "PolicyCreated",
        timestampMs: "1",
        summary: "PolicyCreated",
        parsedJson: { policy_id: "0xpolicy" }
      },
      {
        id: "vault:0",
        digest: "vault",
        sequence: "0",
        type: "AgentVaultCreated",
        timestampMs: "2",
        summary: "AgentVaultCreated",
        parsedJson: { policy_id: "0xpolicy", vault_id: "0xvault" }
      }
    ]);

    expect(config.policyId).toBe("0xpolicy");
    expect(config.vaultId).toBe("0xvault");
  });

  it("recovers the latest successful DeepBook strategy digest from budget activity", () => {
    const config = mergeSuiActivityIntoConfig(normalizeSuiDashboardConfig(null), [
      {
        id: "strategy-digest:0",
        digest: "strategy-digest",
        sequence: "0",
        type: "AgentBudgetUsed",
        timestampMs: "3",
        summary: "AgentBudgetUsed",
        parsedJson: { policy_id: "0xpolicy", pool_id: "0xpool" }
      }
    ]);

    expect(config.lastDeepBookTransactionDigest).toBe("strategy-digest");
  });

  it("keeps a recovered vault paired with the policy that created it", () => {
    const config = mergeSuiActivityIntoConfig(normalizeSuiDashboardConfig(null), [
      {
        id: "new-policy:0",
        digest: "new-policy",
        sequence: "0",
        type: "PolicyCreated",
        timestampMs: "3",
        summary: "PolicyCreated",
        parsedJson: { policy_id: "0xpolicy-without-vault" }
      },
      {
        id: "vault:0",
        digest: "vault",
        sequence: "0",
        type: "AgentVaultCreated",
        timestampMs: "2",
        summary: "AgentVaultCreated",
        parsedJson: { policy_id: "0xpaired-policy", vault_id: "0xpaired-vault" }
      }
    ]);

    expect(config.policyId).toBe("0xpaired-policy");
    expect(config.vaultId).toBe("0xpaired-vault");
  });

  it("summarizes the required Overflow proof points and event trail", () => {
    expect(suiOverflowProofItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Real DeepBook orders" }),
        expect.objectContaining({ title: "Self-enforced budget ceiling" }),
        expect.objectContaining({ title: "Owner revocation" })
      ])
    );
    expect(suiActivityEventLabels).toEqual([
      "PolicyCreated",
      "AgentVaultCreated",
      "AgentBudgetUsed",
      "AgentVaultFunded",
      "AgentVaultReturned",
      "PolicyRevoked"
    ]);
  });

  it("summarizes the Sui proof state from activity, budget, revocation, and DeepBook orders", () => {
    const summary = getSuiProofSummary(
      normalizeSuiDashboardConfig({
        budgetMist: "500000000",
        tokenTypeLabel: "SUI",
        expiresAtMs: "180000",
        policyId: "0xpolicy",
        vaultId: "0xvault",
        balanceManagerId: "0xmanager"
      }),
      [
        {
          id: "created:0",
          digest: "created",
          sequence: "0",
          type: "PolicyCreated",
          timestampMs: "1",
          summary: "PolicyCreated",
          parsedJson: { policy_id: "0xpolicy" }
        },
        {
          id: "vault:0",
          digest: "vault",
          sequence: "0",
          type: "AgentVaultCreated",
          timestampMs: "2",
          summary: "AgentVaultCreated",
          parsedJson: { vault_id: "0xvault" }
        },
        {
          id: "funded:0",
          digest: "funded",
          sequence: "0",
          type: "AgentVaultFunded",
          timestampMs: "3",
          summary: "AgentVaultFunded",
          parsedJson: { amount: "500000000" }
        },
        {
          id: "spent:0",
          digest: "spent",
          sequence: "0",
          type: "AgentBudgetUsed",
          timestampMs: "4",
          summary: "AgentBudgetUsed",
          parsedJson: { amount: "100000000", remaining_budget: "400000000" }
        }
      ],
      [
        {
          orderId: "42",
          market: "DEEP / SUI",
          poolId: "0xpool",
          side: "buy",
          execution: "market",
          assetFlow: "SUI -> DEEP",
          baseAsset: "DEEP",
          quoteAsset: "SUI",
          baseQuantity: "10000000",
          quoteQuantity: "100000000",
          amountEvidence: "100000000 SUI -> 10000000 DEEP",
          status: "open",
          price: "10000000000",
          quantity: "10000000",
          digest: "order-digest",
          transactionUrl: "https://suiexplorer.com/txblock/order-digest?network=testnet",
          timestampMs: "5"
        }
      ],
      120000
    );

    expect(summary.status).toEqual({
      label: "Active",
      tone: "initialized",
      detail: "Move policy enforced. Expires in 1m 0s."
    });
    expect(summary.budget).toMatchObject({
      used: "0.1 SUI",
      remaining: "0.4 SUI",
      max: "0.5 SUI",
      percentUsed: 20
    });
    expect(summary.proofs).toEqual([
      expect.objectContaining({ label: "Policy object", state: "proven" }),
      expect.objectContaining({ label: "Vault funded", state: "proven" }),
      expect.objectContaining({ label: "DeepBook order", state: "proven" }),
      expect.objectContaining({ label: "Budget enforced", state: "proven" }),
      expect.objectContaining({ label: "Owner revocation", state: "pending" })
    ]);
    expect(summary.latestOrder).toMatchObject({
      headline: "Market buy on DEEP / SUI",
      evidence: "100000000 SUI -> 10000000 DEEP",
      digest: "order-digest"
    });
  });

  it("marks a Sui proof as revoked when the owner revocation event exists", () => {
    const summary = getSuiProofSummary(
      normalizeSuiDashboardConfig({ expiresAtMs: "180000" }),
      [
        {
          id: "revoked:0",
          digest: "revoked",
          sequence: "0",
          type: "PolicyRevoked",
          timestampMs: "3",
          summary: "PolicyRevoked",
          parsedJson: { policy_id: "0xpolicy" }
        }
      ],
      [],
      120000
    );

    expect(summary.status).toEqual({
      label: "Revoked",
      tone: "paused",
      detail: "Owner revoked this policy on-chain. Future agent actions are blocked."
    });
    expect(summary.proofs.find((proof) => proof.label === "Owner revocation")).toMatchObject({
      state: "proven",
      digest: "revoked"
    });
  });
});
