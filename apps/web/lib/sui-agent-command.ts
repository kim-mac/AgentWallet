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
  "Try: market buy 0.1 SUI of DEEP, limit sell 0.1 SUI of DEEP, show budget, show orders, or test over budget.";

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
    /^(?:(market|limit)\s+)?(buy|sell)\s+(\d+(?:\.\d{1,9})?)\s+sui(?:\s+of\s+deep)?$/
  );
  if (orderMatch) {
    return {
      kind: "place-order",
      side: orderMatch[2] as "buy" | "sell",
      amount: parseSuiAmountToMist(orderMatch[3]!),
      execution: orderMatch[1] === "market" ? "market" : "limit"
    };
  }

  throw new Error(commandGuidance);
}

export function parseSuiAmountToMist(value: string) {
  const [whole = "0", fraction = ""] = value.split(".");
  const mist = BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, "0"));

  if (mist <= 0n) {
    throw new Error("Order amount must be greater than zero.");
  }

  return mist.toString();
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
    throw new Error("DeepBook DEEP/SUI orders must be at least 0.1 SUI and use 0.1 SUI increments.");
  }

  const scaled = (referenceQuantity * requested) / referenceSpend;
  return scaled.toString();
}
