export type SuiTransactionErrorCode =
  | "SUI_NOT_OWNER"
  | "SUI_NOT_AGENT"
  | "SUI_POLICY_REVOKED"
  | "SUI_POLICY_EXPIRED"
  | "SUI_POOL_NOT_ALLOWED"
  | "SUI_INVALID_AMOUNT"
  | "SUI_OVER_BUDGET"
  | "SUI_VAULT_POLICY_MISMATCH"
  | "SUI_INSUFFICIENT_BALANCE"
  | "SUI_MISSING_GAS"
  | "SUI_OBJECT_NOT_FOUND"
  | "SUI_DEEPBOOK_ORDER_REJECTED"
  | "SUI_TRANSACTION_FAILED";

export type SuiTransactionErrorDetails = {
  code: SuiTransactionErrorCode;
  humanMessage: string;
  agentMessage: string;
  suggestedAction: string;
  rawMessage: string;
};

const policyErrors: Record<number, Omit<SuiTransactionErrorDetails, "rawMessage">> = {
  0: detail("SUI_NOT_OWNER", "Only the policy owner can perform this action.", "Ask the owner to perform this action.", "request_owner_action"),
  1: detail("SUI_NOT_AGENT", "Only the configured agent wallet can execute this action.", "Use the agent wallet configured in the policy.", "use_configured_agent_wallet"),
  2: detail("SUI_POLICY_REVOKED", "The owner revoked this policy.", "Ask the owner to create a new policy before retrying.", "request_new_policy"),
  3: detail("SUI_POLICY_EXPIRED", "This policy has expired.", "Ask the owner to create or extend a policy before retrying.", "request_new_policy"),
  4: detail("SUI_POOL_NOT_ALLOWED", "This DeepBook pool is not allowed by the policy.", "Use the allowed DeepBook pool or ask the owner to update the policy.", "use_allowed_pool"),
  5: detail("SUI_INVALID_AMOUNT", "The amount must be greater than zero.", "Retry with an amount greater than zero.", "retry_with_valid_amount"),
  6: detail("SUI_OVER_BUDGET", "This action exceeds the policy's remaining budget.", "Retry with an amount within the remaining budget or ask the owner to create a new policy.", "reduce_amount_or_create_new_policy"),
  7: detail("SUI_VAULT_POLICY_MISMATCH", "This vault does not belong to the selected policy.", "Use the vault created for this policy.", "use_matching_vault")
};

export function explainSuiTransactionError(error: unknown) {
  const details = getSuiTransactionErrorDetails(error);
  return `Rejected: ${lowercaseFirst(details.humanMessage)}`;
}

export function getSuiTransactionErrorDetails(error: unknown): SuiTransactionErrorDetails {
  const rawMessage = stringifyError(error);

  if (/InsufficientCoinBalance|insufficient (coin )?balance/i.test(rawMessage)) {
    return {
      ...detail(
        "SUI_INSUFFICIENT_BALANCE",
        "The signing wallet or policy vault does not have enough SUI.",
        "Ask the owner to fund the wallet or vault before retrying.",
        "request_owner_funding"
      ),
      rawMessage
    };
  }

  if (/No valid gas coins|gas coin|insufficient gas/i.test(rawMessage)) {
    return {
      ...detail(
        "SUI_MISSING_GAS",
        "The signing wallet does not have enough SUI for gas.",
        "Ask the owner or agent operator to add SUI for gas before retrying.",
        "fund_gas_wallet"
      ),
      rawMessage
    };
  }

  if (/ObjectNotFound|object.*not found|Could not find the referenced object/i.test(rawMessage)) {
    return {
      ...detail(
        "SUI_OBJECT_NOT_FOUND",
        "A required Sui object was not found. Refresh the Sui IDs and try again.",
        "Refresh the policy, vault, pool, and balance manager IDs before retrying.",
        "refresh_sui_object_ids"
      ),
      rawMessage
    };
  }

  const abortCode = extractMoveAbortCode(rawMessage);
  const policyError =
    abortCode === null || !isAgentWalletPolicyAbort(rawMessage) ? null : policyErrors[abortCode];
  if (policyError) {
    return { ...policyError, rawMessage };
  }

  const deepBookValidationError = getDeepBookValidationError(rawMessage, abortCode);
  if (deepBookValidationError) {
    return { ...deepBookValidationError, rawMessage };
  }

  if (isDeepBookOrderError(rawMessage)) {
    return {
      ...detail(
        "SUI_DEEPBOOK_ORDER_REJECTED",
        "DeepBook rejected the order before it could be placed.",
        "Check the requested amount, market lot size, and available trading balance before retrying.",
        "adjust_deepbook_order"
      ),
      rawMessage
    };
  }

  return {
      ...detail(
        "SUI_TRANSACTION_FAILED",
        "Sui rejected the transaction. Check balances, policy status, and order settings before retrying.",
        "Check balances, policy status, and order settings before retrying.",
        "inspect_and_retry"
      ),
    rawMessage
  };
}

function extractMoveAbortCode(message: string) {
  const match = message.match(/abort code:\s*(\d+)/i);
  return match?.[1] ? Number(match[1]) : null;
}

function isAgentWalletPolicyAbort(message: string) {
  return /::policy::/i.test(message);
}

function isDeepBookOrderError(message: string) {
  return /::(?:pool::place_limit_order|order_info::validate_inputs|balance_manager::)/i.test(message);
}

function getDeepBookValidationError(
  message: string,
  abortCode: number | null
): Omit<SuiTransactionErrorDetails, "rawMessage"> | null {
  if (!/::order_info::validate_inputs/i.test(message)) {
    return null;
  }

  if (abortCode === 1) {
    return detail(
      "SUI_DEEPBOOK_ORDER_REJECTED",
      "This order is below DeepBook's minimum size.",
      "Retry with an amount that meets the selected DeepBook market minimum.",
      "increase_order_amount"
    );
  }

  if (abortCode === 2) {
    return detail(
      "SUI_DEEPBOOK_ORDER_REJECTED",
      "This order does not match DeepBook's required lot size.",
      "Retry using the selected DeepBook market's order increment.",
      "adjust_order_increment"
    );
  }

  if (abortCode === 0) {
    return detail(
      "SUI_DEEPBOOK_ORDER_REJECTED",
      "The DeepBook limit price is invalid for this market.",
      "Retry with a valid price for the selected DeepBook market.",
      "adjust_order_price"
    );
  }

  if (abortCode === 3) {
    return detail(
      "SUI_DEEPBOOK_ORDER_REJECTED",
      "The DeepBook order expiry is invalid.",
      "Retry with a future expiry timestamp or the default no-expiry value.",
      "adjust_order_expiry"
    );
  }

  if (abortCode === 4) {
    return detail(
      "SUI_DEEPBOOK_ORDER_REJECTED",
      "The DeepBook order type is invalid.",
      "Retry with a supported order type such as limit or market.",
      "adjust_order_type"
    );
  }

  if (abortCode === 5) {
    return detail(
      "SUI_DEEPBOOK_ORDER_REJECTED",
      "The post-only order would immediately cross the book.",
      "Use a limit price that rests on the book, or submit a market order.",
      "adjust_post_only_price"
    );
  }

  if (abortCode === 6) {
    return detail(
      "SUI_DEEPBOOK_ORDER_REJECTED",
      "The fill-or-kill order could not be fully filled.",
      "Reduce the order size or use market/immediate-or-cancel execution.",
      "reduce_order_size"
    );
  }

  if (abortCode === 7) {
    return detail(
      "SUI_DEEPBOOK_ORDER_REJECTED",
      "DeepBook cannot place a market order as post-only.",
      "Choose either market execution or post-only limit execution.",
      "choose_valid_execution_mode"
    );
  }

  return null;
}

function stringifyError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

function lowercaseFirst(value: string) {
  if (value.startsWith("DeepBook") || value.startsWith("Sui")) {
    return value;
  }
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function detail(
  code: SuiTransactionErrorCode,
  humanMessage: string,
  agentMessage: string,
  suggestedAction: string
): Omit<SuiTransactionErrorDetails, "rawMessage"> {
  return { code, humanMessage, agentMessage, suggestedAction };
}
