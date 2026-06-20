export type SuiAgentCommand =
  | {
      kind: "place-order";
      side: "buy" | "sell";
      amount: string;
      execution: "limit" | "market";
    }
  | { kind: "show-budget" }
  | { kind: "show-orders" }
  | { kind: "test-over-budget" };

const commandGuidance =
  "Try: market buy 0.1 SUI of DEEP, market sell 0.1 SUI for USDC, show budget, show orders, or test over budget.";

export function parseSuiAgentCommand(input: string): SuiAgentCommand {
  const normalized = input.trim().toLowerCase();

  if (/^(show|check)\s+(the\s+)?budget$/.test(normalized)) {
    return { kind: "show-budget" };
  }

  if (/^(show|refresh|check)\s+(the\s+)?orders$/.test(normalized)) {
    return { kind: "show-orders" };
  }

  if (/^(test|try|prove)\s+(the\s+)?over[\s-]?budget/.test(normalized)) {
    return { kind: "test-over-budget" };
  }

  const orderMatch = normalized.match(
    /^(?:(market|limit)\s+)?(buy|sell)\s+(\d+(?:\.\d{1,9})?)\s+(sui|usdc)(?:\s+(?:of|for)\s+(deep|sui|usdc))?$/
  );
  if (orderMatch) {
    return {
      kind: "place-order",
      side: orderMatch[2] as "buy" | "sell",
      amount: parseSuiCommandAmount(orderMatch[3]!, orderMatch[4]!),
      execution: orderMatch[1] === "market" ? "market" : "limit"
    };
  }

  throw new Error(commandGuidance);
}

function parseSuiCommandAmount(value: string, token: string) {
  return parseDecimalAmount(value, token === "usdc" ? 6 : 9);
}

export function parseSuiAmountToMist(value: string) {
  return parseDecimalAmount(value, 9);
}

function parseDecimalAmount(value: string, decimals: number) {
  const [whole = "0", fraction = ""] = value.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Order amount supports up to ${decimals} decimal places.`);
  }

  const multiplier = 10n ** BigInt(decimals);
  const atomicAmount = BigInt(whole) * multiplier + BigInt(fraction.padEnd(decimals, "0"));

  if (atomicAmount <= 0n) {
    throw new Error("Order amount must be greater than zero.");
  }

  return atomicAmount.toString();
}

export function scaleSuiOrderQuantity(
  requestedSpendAmount: string,
  referenceSpendAmount: string,
  referenceOrderQuantity: string
) {
  const requested = BigInt(requestedSpendAmount);
  const referenceSpend = BigInt(referenceSpendAmount);
  const referenceQuantity = BigInt(referenceOrderQuantity);

  if (requested <= 0n || referenceSpend <= 0n || referenceQuantity <= 0n) {
    throw new Error("DeepBook order amount and quantity must be greater than zero.");
  }

  if (requested < referenceSpend || requested % referenceSpend !== 0n) {
    throw new Error("DeepBook orders must be at least the selected market minimum and use that market increment.");
  }

  const scaled = (referenceQuantity * requested) / referenceSpend;
  return scaled.toString();
}
