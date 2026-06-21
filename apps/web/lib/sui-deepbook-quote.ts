export type SuiDeepBookRawQuote = {
  baseOut: number;
  quoteOut: number;
};

export type SuiDeepBookQuoteSuggestion = {
  inputAmount: string;
  displayAmount: string;
  expectedOutput: number;
};

export type SuiDeepBookQuoteDecision = {
  executable: boolean;
  expectedOutput: number;
  expectedRefund: number;
  inputAsset: string;
  outputAsset: string;
  suggestion?: SuiDeepBookQuoteSuggestion;
};

export const suiDeepBookQuoteMarkets = {
  DEEP_SUI: {
    baseAsset: "DEEP",
    quoteAsset: "SUI",
    baseDecimals: 6,
    quoteDecimals: 9
  },
  SUI_DBUSDC: {
    baseAsset: "SUI",
    quoteAsset: "USDC",
    baseDecimals: 9,
    quoteDecimals: 6
  }
} as const;

export function evaluateSuiDeepBookQuote(input: {
  side: "buy" | "sell";
  inputAmount: string;
  inputAsset: string;
  outputAsset: string;
  quote: SuiDeepBookRawQuote;
  suggestion?: SuiDeepBookQuoteSuggestion;
}): SuiDeepBookQuoteDecision {
  const expectedOutput = input.side === "buy" ? input.quote.baseOut : input.quote.quoteOut;
  const expectedRefund = input.side === "buy" ? input.quote.quoteOut : input.quote.baseOut;

  return {
    executable: expectedOutput > 0,
    expectedOutput,
    expectedRefund,
    inputAsset: input.inputAsset,
    outputAsset: input.outputAsset,
    ...(input.suggestion ? { suggestion: input.suggestion } : {})
  };
}

export function formatSuiDeepBookQuoteMessage(decision: SuiDeepBookQuoteDecision) {
  if (!decision.executable) {
    if (decision.suggestion) {
      return `DeepBook currently quotes zero ${decision.outputAsset} for this size. Try ${decision.suggestion.displayAmount}, currently quoted for about ${decision.suggestion.expectedOutput} ${decision.outputAsset}.`;
    }

    return `DeepBook currently quotes zero ${decision.outputAsset} for this size. Increase the amount or wait for pool liquidity before retrying.`;
  }

  return `Preflight quote: approximately ${decision.expectedOutput} ${decision.outputAsset}. Final settlement will be verified on-chain.`;
}

export async function findSuiDeepBookExecutableSuggestion(input: {
  inputAmount: bigint;
  inputDecimals: number;
  inputAsset: string;
  quoteOutput: (amount: bigint) => Promise<number>;
}) {
  for (const multiplier of [2n, 4n, 8n, 16n, 32n, 64n]) {
    const candidate = input.inputAmount * multiplier;
    const expectedOutput = await input.quoteOutput(candidate);
    if (expectedOutput > 0) {
      return {
        inputAmount: candidate.toString(),
        displayAmount: `${formatAtomicAmount(candidate, input.inputDecimals)} ${input.inputAsset}`,
        expectedOutput
      };
    }
  }

  return undefined;
}

function formatAtomicAmount(value: bigint, decimals: number) {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = (value % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
