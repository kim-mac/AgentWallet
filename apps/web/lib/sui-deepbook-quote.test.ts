import { describe, expect, it } from "vitest";
import {
  evaluateSuiDeepBookQuote,
  findSuiDeepBookExecutableSuggestion,
  formatSuiDeepBookQuoteMessage
} from "./sui-deepbook-quote";

describe("Sui DeepBook quote helpers", () => {
  it("marks a market buy executable only when DeepBook quotes acquired base", () => {
    expect(evaluateSuiDeepBookQuote({
      side: "buy",
      inputAmount: "500000000",
      inputAsset: "SUI",
      outputAsset: "DEEP",
      quote: { baseOut: 20, quoteOut: 0.0315 }
    })).toEqual({
      executable: true,
      expectedOutput: 20,
      expectedRefund: 0.0315,
      inputAsset: "SUI",
      outputAsset: "DEEP"
    });
  });

  it("rejects a zero-output quote and includes an executable suggestion", () => {
    const decision = evaluateSuiDeepBookQuote({
      side: "buy",
      inputAmount: "100000000",
      inputAsset: "SUI",
      outputAsset: "DEEP",
      quote: { baseOut: 0, quoteOut: 0.1 },
      suggestion: { inputAmount: "400000000", displayAmount: "0.4 SUI", expectedOutput: 16 }
    });

    expect(decision).toEqual({
      executable: false,
      expectedOutput: 0,
      expectedRefund: 0.1,
      inputAsset: "SUI",
      outputAsset: "DEEP",
      suggestion: { inputAmount: "400000000", displayAmount: "0.4 SUI", expectedOutput: 16 }
    });
    expect(formatSuiDeepBookQuoteMessage(decision)).toBe(
      "DeepBook currently quotes zero DEEP for this size. Try 0.4 SUI, currently quoted for about 16 DEEP."
    );
  });

  it("formats an executable sell quote without claiming final settlement", () => {
    const decision = evaluateSuiDeepBookQuote({
      side: "sell",
      inputAmount: "1000000000",
      inputAsset: "SUI",
      outputAsset: "USDC",
      quote: { baseOut: 0, quoteOut: 0.7 }
    });

    expect(formatSuiDeepBookQuoteMessage(decision)).toBe(
      "Preflight quote: approximately 0.7 USDC. Final settlement will be verified on-chain."
    );
  });

  it("finds the next executable input without changing the requested transaction", async () => {
    const suggestion = await findSuiDeepBookExecutableSuggestion({
      inputAmount: 100000000n,
      inputDecimals: 9,
      inputAsset: "SUI",
      quoteOutput: async (amount) => amount >= 400000000n ? 16 : 0
    });

    expect(suggestion).toEqual({
      inputAmount: "400000000",
      displayAmount: "0.4 SUI",
      expectedOutput: 16
    });
  });
});
