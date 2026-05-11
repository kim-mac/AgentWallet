import { describe, expect, it } from "vitest";
import {
  decodeX402Header,
  encodeX402Header,
  createPaymentRequired,
  createPaymentPayload,
  createSettlementResponse
} from "./x402";

describe("x402 helpers", () => {
  it("round trips base64 JSON payment headers", () => {
    const required = createPaymentRequired({
      resource: "https://merchant.example/weather",
      recipient: "ELCt5nsW3HNBesvuynh94VnmKZosrUcncuEP89XDJFDH",
      tokenMint: "6XigBN521xmNyFV4DDgLpfGVsXTP3JstsaSTkbpNRXgk",
      amount: "1",
      decimals: 6
    });

    expect(decodeX402Header(encodeX402Header(required))).toEqual(required);
  });

  it("creates a Solana devnet payment payload and settlement response", () => {
    const payload = createPaymentPayload({
      policyPda: "Ha8rr1mRut57gkvTk1SBrt5Jb2VzrkFMwKC7BKk9LaqD",
      agent: "DAzJZKmEUtHfXL69kLHMG4pu3oVTpo6RTSAYXPEPZugF",
      signature: "sig_123"
    });
    const response = createSettlementResponse({
      success: true,
      network: "solana-devnet",
      transaction: "sig_123"
    });

    expect(payload.scheme).toBe("exact");
    expect(payload.network).toBe("solana-devnet");
    expect(response.transaction).toBe("sig_123");
  });
});
