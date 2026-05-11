import { describe, expect, it, vi } from "vitest";
import { AgentWallet } from "./index";

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
