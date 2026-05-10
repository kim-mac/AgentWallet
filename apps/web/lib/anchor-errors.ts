const agentSpendErrors: Record<number, string> = {
  6000: "the policy limits are invalid.",
  6001: "the policy has too many allowed recipients.",
  6002: "only the policy owner can make that change.",
  6003: "this backend is not signing with the agent wallet configured in the policy.",
  6004: "the payment amount must be greater than zero.",
  6005: "the policy is paused.",
  6006: "that recipient wallet is not on the allowed list.",
  6007: "this payment is above the per-payment cap.",
  6008: "this payment would exceed the current budget window.",
  6009: "this payment is above the owner approval threshold.",
  6010: "the owner approval record is invalid.",
  6011: "the owner approval record has expired.",
  6012: "the owner approval record was already used."
};

export function explainAgentSpendError(error: unknown): string {
  const text = stringifyError(error);
  const nonProgramMessage = explainNonProgramError(text);

  if (nonProgramMessage) {
    return nonProgramMessage;
  }

  const customCode = extractCustomErrorCode(error);

  if (!customCode) {
    return `Rejected: ${text}.`;
  }

  const message = agentSpendErrors[customCode];

  if (!message) {
    return `Rejected: custom program error ${customCode}.`;
  }

  return `Rejected: ${message}`;
}

function explainNonProgramError(error: string): string | null {
  if (/Agent token account .* does not exist/i.test(error)) {
    return "Rejected: the agent wallet does not have a funded token account for this token.";
  }

  if (/insufficient funds|Attempt to debit an account/i.test(error)) {
    return "Rejected: the agent wallet does not have enough SOL or token balance to complete this payment.";
  }

  if (/blockhash/i.test(error)) {
    return "Rejected: the transaction expired before confirmation. Please try again.";
  }

  return null;
}

function extractCustomErrorCode(error: unknown): number | null {
  if (typeof error === "number") {
    return error;
  }

  if (typeof error === "string") {
    const hexMatch = error.match(/custom program error:\s*0x([0-9a-f]+)/i);
    if (hexMatch?.[1]) {
      return Number.parseInt(hexMatch[1], 16);
    }

    const decimalMatch = error.match(/\bCustom"?\s*:?\s*(\d{4})\b/i);
    if (decimalMatch?.[1]) {
      return Number(decimalMatch[1]);
    }

    return null;
  }

  if (!error || typeof error !== "object") {
    return null;
  }

  const maybeInstructionError = error as {
    InstructionError?: [number, { Custom?: number } | string];
  };
  const instructionError = maybeInstructionError.InstructionError;

  if (Array.isArray(instructionError)) {
    const detail = instructionError[1];

    if (typeof detail === "object" && detail && typeof detail.Custom === "number") {
      return detail.Custom;
    }
  }

  return extractCustomErrorCode(JSON.stringify(error));
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return JSON.stringify(error);
}
