export type AgentSpendErrorCode =
  | "POLICY_LIMITS_INVALID"
  | "TOO_MANY_ALLOWED_RECIPIENTS"
  | "OWNER_ONLY_ACTION"
  | "AGENT_WALLET_MISMATCH"
  | "AMOUNT_MUST_BE_POSITIVE"
  | "POLICY_PAUSED"
  | "RECIPIENT_NOT_ALLOWED"
  | "AMOUNT_ABOVE_PER_PAYMENT_CAP"
  | "DAILY_BUDGET_EXCEEDED"
  | "OWNER_APPROVAL_REQUIRED"
  | "APPROVAL_RECORD_INVALID"
  | "APPROVAL_RECORD_EXPIRED"
  | "APPROVAL_RECORD_ALREADY_USED"
  | "POLICY_NOT_INITIALIZED"
  | "TOKEN_ALLOWLIST_EMPTY"
  | "TOO_MANY_ALLOWED_TOKEN_MINTS"
  | "TOKEN_NOT_ALLOWED"
  | "AGENT_WALLET_NOT_FUNDED"
  | "INSUFFICIENT_FUNDS"
  | "TRANSACTION_EXPIRED"
  | "INVALID_AGENT_API_KEY"
  | "UNKNOWN_POLICY_ERROR";

export type AgentSpendErrorDetails = {
  code: AgentSpendErrorCode;
  message: string;
  humanMessage: string;
  agentMessage: string;
  suggestedAction: string;
};

const agentSpendErrors: Record<number, AgentSpendErrorDetails> = {
  6000: detail("POLICY_LIMITS_INVALID", "Policy limits are invalid.", "Fix the policy limits before publishing.", "Ask the owner to correct the policy limits.", "request_owner_policy_update"),
  6001: detail("TOO_MANY_ALLOWED_RECIPIENTS", "Policy has too many allowed recipients.", "The policy has too many allowed recipients.", "Ask the owner to reduce the recipient allowlist.", "request_owner_policy_update"),
  6002: detail("OWNER_ONLY_ACTION", "Only the policy owner can make that change.", "Only the policy owner can make that change.", "Ask the owner to perform this policy action.", "request_owner_action"),
  6003: detail("AGENT_WALLET_MISMATCH", "Backend signer does not match the policy agent wallet.", "This backend is not signing with the agent wallet configured in the policy.", "Ask the owner to select the correct hosted agent wallet.", "request_owner_policy_update"),
  6004: detail("AMOUNT_MUST_BE_POSITIVE", "Payment amount must be greater than zero.", "The payment amount must be greater than zero.", "Retry with an amount greater than zero.", "retry_with_valid_amount"),
  6005: detail("POLICY_PAUSED", "Policy is paused.", "The policy is paused.", "Ask the owner to resume the policy before spending.", "request_owner_resume_policy"),
  6006: detail("RECIPIENT_NOT_ALLOWED", "Recipient wallet is not on the allowed list.", "That recipient wallet is not on the allowed list.", "Choose an allowed recipient or ask the owner to update the policy.", "request_owner_policy_update"),
  6007: detail("AMOUNT_ABOVE_PER_PAYMENT_CAP", "Payment is above the per-payment cap.", "This payment is above the per-payment cap.", "Retry with a smaller amount or ask the owner to update the cap.", "retry_with_lower_amount"),
  6008: detail("DAILY_BUDGET_EXCEEDED", "Payment would exceed the current budget window.", "This payment would exceed the current budget window.", "Wait for the budget window to reset or ask the owner to increase the budget.", "wait_or_request_owner_policy_update"),
  6009: detail("OWNER_APPROVAL_REQUIRED", "Payment is above the owner approval threshold.", "This payment is above the owner approval threshold.", "Request owner approval and wait for the approval result before retrying.", "request_owner_approval"),
  6010: detail("APPROVAL_RECORD_INVALID", "Owner approval record is invalid.", "The owner approval record is invalid.", "Ask the owner to approve this payment again.", "request_owner_approval"),
  6011: detail("APPROVAL_RECORD_EXPIRED", "Owner approval record has expired.", "The owner approval record has expired.", "Ask the owner to create a fresh approval.", "request_owner_approval"),
  6012: detail("APPROVAL_RECORD_ALREADY_USED", "Owner approval record was already used.", "The owner approval record was already used.", "Create a new payment request if funds still need to move.", "retry_payment_request"),
  6013: detail("TOKEN_ALLOWLIST_EMPTY", "Policy must allow at least one token mint.", "The policy must allow at least one token mint.", "Ask the owner to add an allowed token mint.", "request_owner_policy_update"),
  6014: detail("TOO_MANY_ALLOWED_TOKEN_MINTS", "Policy has too many allowed token mints.", "The policy has too many allowed token mints.", "Ask the owner to reduce the token allowlist.", "request_owner_policy_update"),
  6015: detail("TOKEN_NOT_ALLOWED", "Token mint is not on the allowed list.", "That token mint is not on the allowed list.", "Use an allowed token or ask the owner to update the token allowlist.", "request_owner_policy_update")
};

const splTokenProgramErrors: Record<number, AgentSpendErrorDetails> = {
  1: detail(
    "INSUFFICIENT_FUNDS",
    "Agent wallet does not have enough SOL or token balance.",
    "The agent wallet does not have enough SOL or token balance to complete this payment.",
    "Ask the owner to fund the hosted wallet before retrying.",
    "request_owner_funding"
  )
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

  const details = agentSpendErrors[customCode] ?? splTokenProgramErrors[customCode];

  if (!details) {
    return `Rejected: custom program error ${customCode}.`;
  }

  return `Rejected: ${details.humanMessage.charAt(0).toLowerCase()}${details.humanMessage.slice(1)}`;
}

export function getAgentSpendErrorDetails(error: unknown): AgentSpendErrorDetails {
  const text = stringifyError(error);
  const nonProgramDetails = explainNonProgramErrorDetails(text);

  if (nonProgramDetails) {
    return nonProgramDetails;
  }

  const customCode = extractCustomErrorCode(error);

  if (customCode) {
    const customDetails = agentSpendErrors[customCode] ?? splTokenProgramErrors[customCode];
    if (customDetails) {
      return customDetails;
    }
  }

  return detail(
    "UNKNOWN_POLICY_ERROR",
    customCode ? `Unknown custom program error ${customCode}.` : text,
    customCode ? `Custom program error ${customCode}.` : text,
    "Inspect the policy, wallet funding, and transaction parameters before retrying.",
    "inspect_and_retry"
  );
}

function explainNonProgramError(error: string): string | null {
  const details = explainNonProgramErrorDetails(error);
  return details ? `Rejected: ${details.humanMessage.charAt(0).toLowerCase()}${details.humanMessage.slice(1)}` : null;
}

function explainNonProgramErrorDetails(error: string): AgentSpendErrorDetails | null {
  if (/Agent token account .* does not exist/i.test(error)) {
    return detail("AGENT_WALLET_NOT_FUNDED", "Agent wallet does not have a funded token account for this token.", "The agent wallet does not have a funded token account for this token.", "Ask the owner to fund the hosted wallet with this token first.", "request_owner_funding");
  }

  if (/insufficient funds|Attempt to debit an account/i.test(error)) {
    return detail("INSUFFICIENT_FUNDS", "Agent wallet does not have enough SOL or token balance.", "The agent wallet does not have enough SOL or token balance to complete this payment.", "Ask the owner to fund the hosted wallet before retrying.", "request_owner_funding");
  }

  if (/blockhash|expired before confirmation/i.test(error)) {
    return detail("TRANSACTION_EXPIRED", "Transaction expired before confirmation.", "The transaction expired before confirmation. Please try again.", "Retry the payment request.", "retry");
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

    const decimalMatch = error.match(/\bCustom"?\s*:?\s*(\d{1,4})\b/i);
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

function detail(
  code: AgentSpendErrorCode,
  message: string,
  humanMessage: string,
  agentMessage: string,
  suggestedAction: string
): AgentSpendErrorDetails {
  return {
    code,
    message,
    humanMessage,
    agentMessage,
    suggestedAction
  };
}
