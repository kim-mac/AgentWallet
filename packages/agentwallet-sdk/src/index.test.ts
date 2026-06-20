import { describe, expect, it, vi } from "vitest";
import { Transaction } from "@mysten/sui/transactions";
import {
  AgentWallet,
  buildSuiCreateDeepBookBalanceManagerPlan,
  buildSuiCreatePolicyPlan,
  buildSuiCreateVaultPlan,
  buildSuiDepositVaultPlan,
  buildSuiDeepBookActionPlan,
  buildSuiDeepBookLimitOrderPlan,
  buildSuiRevokePolicyPlan,
  createSuiTransaction,
  submitSuiPlan,
  submitSuiTransaction,
  toSuiTransaction
} from "./index";

describe("AgentWallet SDK", () => {
  it("executes policy-gated payments through the hosted API", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          signature: "sig_123",
          explorerUrl: "https://explorer.solana.com/tx/sig_123?cluster=devnet"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const wallet = new AgentWallet({
      apiKey: "agent_key",
      baseUrl: "https://agentwallet.example",
      fetch: fetcher
    });

    await expect(
      wallet.pay({
        recipient: "ELCt5nsW3HNBesvuynh94VnmKZosrUcncuEP89XDJFDH",
        amount: "1"
      })
    ).resolves.toMatchObject({ signature: "sig_123" });

    expect(fetcher).toHaveBeenCalledWith(
      "https://agentwallet.example/api/agent-wallet/pay",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer agent_key" })
      })
    );
  });

  it("loads the hosted agent wallet readiness state", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          agent: {
            name: "Research agent",
            publicKey: "FoJQ6uazwDmo2knNhKBM8ZYAcvC8Y5yQtSEVjd3iy6dN"
          },
          status: {
            readyForPayments: true,
            policyConfigured: true,
            tokenMintConfigured: true,
            telegramLinked: false,
            missing: []
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const wallet = new AgentWallet({
      apiKey: "agent_key",
      baseUrl: "https://agentwallet.example/",
      fetch: fetcher
    });

    await expect(wallet.getAgent()).resolves.toMatchObject({
      status: { readyForPayments: true },
      agent: { name: "Research agent" }
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://agentwallet.example/api/agent-wallet/me",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer agent_key" })
      })
    );
  });

  it("loads agent wallet capabilities", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          policy: { status: "active" },
          allowed: { recipients: ["recipient_1"], tokenMints: ["token_1"] },
          spend: { remainingBudgetUnits: "5000000" },
          supportedActions: ["simulate_payment", "request_payment"]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const wallet = new AgentWallet({
      apiKey: "agent_key",
      baseUrl: "https://agentwallet.example",
      fetch: fetcher
    });

    await expect(wallet.getCapabilities()).resolves.toMatchObject({
      ok: true,
      policy: { status: "active" },
      allowed: { recipients: ["recipient_1"] }
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://agentwallet.example/api/agent-wallet/capabilities",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer agent_key" })
      })
    );
  });

  it("simulates policy-gated payments without moving funds", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          decision: "requires_approval",
          code: "OWNER_APPROVAL_REQUIRED",
          suggestedAction: "request_owner_approval"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const wallet = new AgentWallet({
      apiKey: "agent_key",
      baseUrl: "https://agentwallet.example",
      fetch: fetcher
    });

    await expect(
      wallet.simulatePayment({
        recipient: "ELCt5nsW3HNBesvuynh94VnmKZosrUcncuEP89XDJFDH",
        amount: "5"
      })
    ).resolves.toMatchObject({
      decision: "requires_approval",
      code: "OWNER_APPROVAL_REQUIRED"
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://agentwallet.example/api/agent-wallet/simulate-payment",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer agent_key" })
      })
    );
  });

  it("completes an x402 retry after a 402 payment challenge", async () => {
    const paymentRequired = btoa(
      JSON.stringify({
        x402Version: "2",
        accepts: [
          {
            scheme: "exact",
            network: "solana-devnet",
            asset: "6XigBN521xmNyFV4DDgLpfGVsXTP3JstsaSTkbpNRXgk",
            payTo: "ELCt5nsW3HNBesvuynh94VnmKZosrUcncuEP89XDJFDH",
            amount: "1",
            decimals: 6
          }
        ]
      })
    );
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("payment required", {
        status: 402,
        headers: { "PAYMENT-REQUIRED": paymentRequired }
      }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            signature: "sig_123",
            policyPda: "Ha8rr1mRut57gkvTk1SBrt5Jb2VzrkFMwKC7BKk9LaqD",
            agent: "DAzJZKmEUtHfXL69kLHMG4pu3oVTpo6RTSAYXPEPZugF"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: "paid resource" }), {
          status: 200,
          headers: { "content-type": "application/json", "PAYMENT-RESPONSE": btoa("{}") }
        })
      );

    const wallet = new AgentWallet({
      apiKey: "agent_key",
      baseUrl: "https://agentwallet.example",
      fetch: fetcher
    });

    const response = await wallet.fetch("https://merchant.example/weather");

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenLastCalledWith(
      "https://merchant.example/weather",
      expect.objectContaining({
        headers: expect.objectContaining({ "PAYMENT-SIGNATURE": expect.any(String) })
      })
    );
  });
});

describe("Sui AgentWallet PTB plans", () => {
  const packageId = "0xagentwallet";
  const policyId = "0xpolicy";
  const vaultId = "0xvault";
  const poolId = "0xdeepbookpool";
  const coinType = "0x2::sui::SUI";

  it("builds the owner policy creation call", () => {
    const plan = buildSuiCreatePolicyPlan({
      packageId,
      agent: "0xagent",
      maxBudget: "500000000",
      allowedPoolId: poolId,
      expiresAtMs: "1770000000000"
    });

    expect(plan.commands).toEqual([
      {
        kind: "moveCall",
        target: "0xagentwallet::policy::create_policy",
        arguments: ["0xagent", "500000000", poolId, "1770000000000"]
      }
    ]);
  });

  it("builds the owner vault creation call for a specific coin type", () => {
    const plan = buildSuiCreateVaultPlan({
      packageId,
      policyId,
      coinType,
      tokenTypeLabel: "SUI"
    });

    expect(plan.commands).toEqual([
      {
        kind: "moveCall",
        target: "0xagentwallet::policy::create_vault",
        typeArguments: [coinType],
        arguments: [policyId, "SUI"]
      }
    ]);
  });

  it("builds an owner vault deposit flow by splitting the gas coin", () => {
    const plan = buildSuiDepositVaultPlan({
      packageId,
      vaultId,
      coinType,
      amount: "250000000"
    });

    expect(plan.commands).toEqual([
      {
        kind: "splitCoins",
        coin: "$gas",
        amounts: ["250000000"],
        resultName: "depositCoin"
      },
      {
        kind: "moveCall",
        target: "0xagentwallet::policy::deposit",
        typeArguments: [coinType],
        arguments: [vaultId, "$depositCoin"]
      }
    ]);
  });

  it("builds the agent budgeted DeepBook action flow", () => {
    const plan = buildSuiDeepBookActionPlan({
      packageId,
      policyId,
      vaultId,
      coinType,
      amount: "1000000",
      poolId,
      deepBookTarget: "0xdee9::pool::swap_exact_base_for_quote",
      deepBookArguments: ["0xdeepbookpool", "$agentwalletCoin", "1000000"],
      clockId: "0x6",
      action: "deepbook_swap"
    });

    expect(plan.commands).toEqual([
      {
        kind: "moveCall",
        target: "0xagentwallet::policy::take_budgeted_coin",
        typeArguments: [coinType],
        arguments: [policyId, vaultId, "1000000", poolId, "deepbook_swap", "0x6"],
        resultName: "agentwalletCoin"
      },
      {
        kind: "moveCall",
        target: "0xdee9::pool::swap_exact_base_for_quote",
        arguments: ["0xdeepbookpool", "$agentwalletCoin", "1000000"]
      }
    ]);
  });

  it("builds a budgeted DeepBook limit order flow with leftover coin return", () => {
    const plan = buildSuiDeepBookLimitOrderPlan({
      packageId,
      policyId,
      vaultId,
      coinType,
      amount: "1000000",
      poolId,
      deepBookPackageId: "0xdee9",
      balanceManagerId: "0xbalance",
      baseAssetType: "0xdeep::DEEP",
      quoteAssetType: coinType,
      orderType: "bid",
      price: "1200000000",
      quantity: "1000000",
      clockId: "0x6"
    });

    expect(plan.commands).toEqual([
      {
        kind: "moveCall",
        target: "0xagentwallet::policy::take_budgeted_coin",
        typeArguments: [coinType],
        arguments: [policyId, vaultId, "1000000", poolId, "deepbook_limit_order", "0x6"],
        resultName: "agentwalletCoin"
      },
      {
        kind: "moveCall",
        target: "0xdee9::balance_manager::deposit",
        typeArguments: [coinType],
        arguments: ["0xbalance", "$agentwalletCoin"]
      },
      {
        kind: "moveCall",
        target: "0xdee9::balance_manager::generate_proof_as_owner",
        arguments: ["0xbalance"],
        resultName: "deepbookTradeProof"
      },
      {
        kind: "moveCall",
        target: "0xdee9::pool::place_limit_order",
        typeArguments: ["0xdeep::DEEP", coinType],
        arguments: [
          poolId,
          "0xbalance",
          "$deepbookTradeProof",
          "0",
          "0",
          "0",
          "1200000000",
          "1000000",
          "true",
          "false",
          "18446744073709551615",
          "0x6"
        ]
      }
    ]);
  });

  it("builds a budgeted DeepBook market buy that swaps exact quote and settles output to the agent wallet", () => {
    const plan = buildSuiDeepBookLimitOrderPlan({
      packageId,
      policyId,
      vaultId,
      coinType,
      amount: "1000000",
      poolId,
      deepBookPackageId: "0xdee9",
      balanceManagerId: "0xbalance",
      baseAssetType: "0xdeep::DEEP",
      quoteAssetType: coinType,
      orderType: "bid",
      execution: "market",
      price: "1200000000",
      quantity: "1000000",
      clockId: "0x6",
      settleToAddress: "0xagent"
    });

    expect(plan.commands).toEqual([
      {
        kind: "moveCall",
        target: "0xagentwallet::policy::take_budgeted_coin",
        typeArguments: [coinType],
        arguments: [policyId, vaultId, "1000000", poolId, "deepbook_market_order", "0x6"],
        resultName: "agentwalletCoin"
      },
      {
        kind: "moveCall",
        target: "0x2::coin::zero",
        typeArguments: ["0xdeep::DEEP"],
        arguments: [],
        resultName: "deepbookFeeCoin"
      },
      {
        kind: "moveCall",
        target: "0xdee9::pool::swap_exact_quote_for_base",
        typeArguments: ["0xdeep::DEEP", coinType],
        arguments: [poolId, "$agentwalletCoin", "$deepbookFeeCoin", "1", "0x6"],
        resultNames: ["deepbookBaseOut", "deepbookQuoteOut", "deepbookFeeOut"]
      },
      {
        kind: "transferObjects",
        objects: ["$deepbookBaseOut", "$deepbookQuoteOut", "$deepbookFeeOut"],
        recipient: "0xagent"
      }
    ]);
  });

  it("builds a budgeted SUI/USDC market sell with a DEEP fee coin placeholder", () => {
    const plan = buildSuiDeepBookLimitOrderPlan({
      packageId,
      policyId,
      vaultId,
      coinType,
      amount: "100000000",
      poolId,
      deepBookPackageId: "0xdee9",
      balanceManagerId: "0xbalance",
      baseAssetType: coinType,
      quoteAssetType: "0xusdc::DBUSDC::DBUSDC",
      deepFeeAssetType: "0xdeep::DEEP",
      orderType: "ask",
      execution: "market",
      price: "800000",
      quantity: "100000000",
      clockId: "0x6",
      settleToAddress: "0xagent"
    });

    expect(plan.commands[1]).toMatchObject({
      kind: "moveCall",
      target: "0x2::coin::zero",
      typeArguments: ["0xdeep::DEEP"]
    });
    expect(plan.commands[2]).toMatchObject({
      kind: "moveCall",
      target: "0xdee9::pool::swap_exact_base_for_quote",
      typeArguments: [coinType, "0xusdc::DBUSDC::DBUSDC"],
      arguments: [poolId, "$agentwalletCoin", "$deepbookFeeCoin", "1", "0x6"]
    });
  });


  it("builds the owner revocation call", () => {
    const plan = buildSuiRevokePolicyPlan({ packageId, policyId });

    expect(plan.commands).toEqual([
      {
        kind: "moveCall",
        target: "0xagentwallet::policy::revoke",
        arguments: [policyId]
      }
    ]);
  });

  it("builds a DeepBook balance manager creation flow", () => {
    const plan = buildSuiCreateDeepBookBalanceManagerPlan({
      deepBookPackageId: "0xdeepbook"
    });

    expect(plan.commands).toEqual([
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

  it("rejects missing object ids before an agent can construct unsafe calls", () => {
    expect(() =>
      buildSuiDeepBookActionPlan({
        packageId: "",
        policyId,
        vaultId,
        coinType,
        amount: "1000000",
        poolId,
        deepBookTarget: "0xdee9::pool::swap_exact_base_for_quote",
        deepBookArguments: [],
        clockId: "0x6"
      })
    ).toThrow("packageId is required");
  });

  it("applies an AgentWallet plan to a Sui transaction builder", () => {
    const tx = createFakeSuiTransaction();
    const plan = buildSuiCreatePolicyPlan({
      packageId,
      agent: "0xagent",
      maxBudget: "500000000",
      allowedPoolId: poolId,
      expiresAtMs: "1770000000000"
    });

    const result = toSuiTransaction(tx, plan);

    expect(result).toBe(tx);
    expect(tx.calls).toEqual([
      {
        target: "0xagentwallet::policy::create_policy",
        arguments: [
          { kind: "pure.address", value: "0xagent" },
          { kind: "pure.u64", value: "500000000" },
          { kind: "pure.address", value: poolId },
          { kind: "pure.u64", value: "1770000000000" }
        ],
        typeArguments: undefined
      }
    ]);
  });

  it("resolves a named AgentWallet coin result into a downstream DeepBook call", () => {
    const tx = createFakeSuiTransaction();
    const plan = buildSuiDeepBookActionPlan({
      packageId,
      policyId,
      vaultId,
      coinType,
      amount: "1000000",
      poolId,
      deepBookTarget: "0xdee9::pool::swap_exact_base_for_quote",
      deepBookArguments: ["0xdeepbookpool", "$agentwalletCoin", "1000000"],
      clockId: "0x6",
      action: "deepbook_swap"
    });

    toSuiTransaction(tx, plan);

    expect(tx.calls[0]).toMatchObject({
      target: "0xagentwallet::policy::take_budgeted_coin",
      arguments: [
        { kind: "object", id: policyId },
        { kind: "object", id: vaultId },
        { kind: "pure.u64", value: "1000000" },
        { kind: "pure.address", value: poolId },
        {
          kind: "pure.vector",
          type: "u8",
          value: [100, 101, 101, 112, 98, 111, 111, 107, 95, 115, 119, 97, 112]
        },
        { kind: "object", id: "0x6" }
      ],
      typeArguments: [coinType]
    });
    expect(tx.calls[1]).toMatchObject({
      target: "0xdee9::pool::swap_exact_base_for_quote",
      arguments: [
        { kind: "object", id: "0xdeepbookpool" },
        { kind: "result", index: 0 },
        { kind: "pure.u64", value: "1000000" }
      ]
    });
  });

  it("encodes the real DeepBook pool as an object argument for limit orders", () => {
    const tx = createFakeSuiTransaction();
    const plan = buildSuiDeepBookLimitOrderPlan({
      packageId,
      policyId,
      vaultId,
      coinType,
      amount: "1000000",
      poolId,
      deepBookPackageId: "0xdee9",
      balanceManagerId: "0xbalance",
      baseAssetType: "0xdeep::DEEP",
      quoteAssetType: coinType,
      orderType: "bid",
      price: "1200000000",
      quantity: "1000000",
      clockId: "0x6"
    });

    toSuiTransaction(tx, plan);

    expect(tx.calls[0]?.arguments[3]).toEqual({ kind: "pure.address", value: poolId });
    expect(tx.calls[3]?.arguments[0]).toEqual({ kind: "object", id: poolId });
    expect(tx.calls[3]?.arguments[1]).toEqual({ kind: "object", id: "0xbalance" });
  });

  it("applies a DeepBook exact-quote market swap settlement transfer to a Sui transaction builder", () => {
    const tx = createFakeSuiTransaction();
    const plan = buildSuiDeepBookLimitOrderPlan({
      packageId,
      policyId,
      vaultId,
      coinType,
      amount: "1000000",
      poolId,
      deepBookPackageId: "0xdee9",
      balanceManagerId: "0xbalance",
      baseAssetType: "0xdeep::DEEP",
      quoteAssetType: coinType,
      orderType: "bid",
      execution: "market",
      price: "1200000000",
      quantity: "1000000",
      clockId: "0x6",
      settleToAddress: "0xagent"
    });

    toSuiTransaction(tx, plan);

    expect(tx.calls[1]?.target).toBe("0x2::coin::zero");
    expect(tx.calls[2]?.target).toBe("0xdee9::pool::swap_exact_quote_for_base");
    expect(tx.transfers).toEqual([
      {
        objects: [
          { kind: "nestedResult", index: 2, resultIndex: 0 },
          { kind: "nestedResult", index: 2, resultIndex: 1 },
          { kind: "nestedResult", index: 2, resultIndex: 2 }
        ],
        recipient: { kind: "pure.address", value: "0xagent" }
      }
    ]);
  });

  it("applies a gas split deposit plan to a Sui transaction builder", () => {
    const tx = createFakeSuiTransaction();
    const plan = buildSuiDepositVaultPlan({
      packageId,
      vaultId,
      coinType,
      amount: "250000000"
    });

    toSuiTransaction(tx, plan);

    expect(tx.splits).toEqual([
      {
        coin: { kind: "gas" },
        amounts: [{ kind: "pure.u64", value: "250000000" }]
      }
    ]);
    expect(tx.calls).toEqual([
      {
        target: "0xagentwallet::policy::deposit",
        arguments: [{ kind: "object", id: vaultId }, { kind: "splitResult", index: 0 }],
        typeArguments: [coinType]
      }
    ]);
  });

  it("fails when a DeepBook argument references an unknown prior result", () => {
    const tx = createFakeSuiTransaction();

    expect(() =>
      toSuiTransaction(tx, {
        chain: "sui",
        commands: [
          {
            kind: "moveCall",
            target: "0xdee9::pool::swap_exact_base_for_quote",
            arguments: ["$missingCoin"]
          }
        ]
      })
    ).toThrow("Unknown Sui PTB result reference: $missingCoin");
  });

  it("applies a plan to a real @mysten/sui Transaction", () => {
    const tx = new Transaction();
    const objectId = `0x${"1".repeat(64)}`;
    const agent = `0x${"2".repeat(64)}`;
    const plan = buildSuiCreatePolicyPlan({
      packageId: objectId,
      agent,
      maxBudget: "500000000",
      allowedPoolId: objectId,
      expiresAtMs: "1770000000000"
    });

    toSuiTransaction(tx, plan);

    expect(JSON.stringify(tx.getData())).toContain("create_policy");
  });

  it("creates a real @mysten/sui Transaction directly from a plan", () => {
    const objectId = `0x${"1".repeat(64)}`;
    const agent = `0x${"2".repeat(64)}`;
    const plan = buildSuiCreatePolicyPlan({
      packageId: objectId,
      agent,
      maxBudget: "500000000",
      allowedPoolId: objectId,
      expiresAtMs: "1770000000000"
    });

    const tx = createSuiTransaction(plan);

    expect(tx).toBeInstanceOf(Transaction);
    expect(JSON.stringify(tx.getData())).toContain("create_policy");
  });

  it("signs, submits, and waits for a Sui transaction", async () => {
    const tx = new Transaction();
    const signer = { label: "agent signer" };
    const client = {
      signAndExecuteTransaction: vi.fn(async () => ({
        digest: "7YUiDigest",
        effects: { status: { status: "success" } }
      })),
      waitForTransaction: vi.fn(async () => ({
        digest: "7YUiDigest",
        effects: { status: { status: "success" } },
        events: [{ type: "agent_wallet::policy::AgentBudgetUsed" }]
      }))
    };

    await expect(
      submitSuiTransaction({
        client,
        signer,
        transaction: tx,
        waitForConfirmation: true,
        explorerBaseUrl: "https://suiexplorer.com"
      })
    ).resolves.toMatchObject({
      ok: true,
      digest: "7YUiDigest",
      status: "success",
      explorerUrl: "https://suiexplorer.com/txblock/7YUiDigest?network=testnet"
    });

    expect(client.signAndExecuteTransaction).toHaveBeenCalledWith({
      transaction: tx,
      signer,
      include: { effects: true, events: true }
    });
    expect(client.waitForTransaction).toHaveBeenCalledWith({
      digest: "7YUiDigest",
      include: { effects: true, events: true }
    });
  });

  it("returns a structured failure when Sui execution rejects the transaction", async () => {
    const client = {
      signAndExecuteTransaction: vi.fn(async () => ({
        digest: "RejectedDigest",
        effects: {
          status: {
            status: "failure",
            error: "MoveAbort(MoveLocation { module: policy }, 6)"
          }
        }
      }))
    };

    await expect(
      submitSuiTransaction({
        client,
        signer: { label: "agent signer" },
        transaction: new Transaction(),
        waitForConfirmation: false
      })
    ).resolves.toMatchObject({
      ok: false,
      digest: "RejectedDigest",
      status: "failure",
      error: "MoveAbort(MoveLocation { module: policy }, 6)"
    });
  });

  it("returns a structured failure when signing or submission throws", async () => {
    const client = {
      signAndExecuteTransaction: vi.fn(async () => {
        throw new Error("insufficient gas");
      })
    };

    await expect(
      submitSuiTransaction({
        client,
        signer: { label: "agent signer" },
        transaction: new Transaction()
      })
    ).resolves.toMatchObject({
      ok: false,
      error: "insufficient gas"
    });
  });

  it("creates, signs, and submits a Sui plan in one call", async () => {
    const objectId = `0x${"1".repeat(64)}`;
    const plan = buildSuiRevokePolicyPlan({
      packageId: objectId,
      policyId: objectId
    });
    const client = {
      signAndExecuteTransaction: vi.fn(async ({ transaction }) => {
        expect(transaction).toBeInstanceOf(Transaction);
        return {
          digest: "PlanDigest",
          effects: { status: { status: "success" } }
        };
      })
    };

    await expect(
      submitSuiPlan({
        client,
        signer: { label: "owner signer" },
        plan
      })
    ).resolves.toMatchObject({
      ok: true,
      digest: "PlanDigest"
    });
  });
});

function createFakeSuiTransaction() {
  const calls: Array<{
    target: string;
    arguments: unknown[];
    typeArguments?: string[];
  }> = [];
  const splits: Array<{
    coin: unknown;
    amounts: unknown[];
  }> = [];
  const transfers: Array<{
    objects: unknown[];
    recipient: unknown;
  }> = [];

  return {
    calls,
    splits,
    transfers,
    gas: { kind: "gas" },
    object(id: string) {
      return { kind: "object", id };
    },
    pure: {
      address(value: string) {
        return { kind: "pure.address", value };
      },
      u64(value: string | number | bigint) {
        return { kind: "pure.u64", value: value.toString() };
      },
      vector(type: string, value: unknown[]) {
        return { kind: "pure.vector", type, value };
      }
    },
    splitCoins(coin: unknown, amounts: unknown[]) {
      splits.push({ coin, amounts });
      return { kind: "splitResult", index: splits.length - 1 };
    },
    moveCall(input: { target: string; arguments: unknown[]; typeArguments?: string[] }) {
      calls.push(input);
      if (input.target.endsWith("::pool::swap_exact_quote_for_base")) {
        const index = calls.length - 1;
        return [
          { kind: "nestedResult", index, resultIndex: 0 },
          { kind: "nestedResult", index, resultIndex: 1 },
          { kind: "nestedResult", index, resultIndex: 2 }
        ];
      }
      return { kind: "result", index: calls.length - 1 };
    },
    transferObjects(objects: unknown[], recipient: unknown) {
      transfers.push({ objects, recipient });
    }
  };
}
