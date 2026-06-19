import { describe, expect, it } from "vitest";
import { explainSuiTransactionError, getSuiTransactionErrorDetails } from "./sui-errors";

describe("explainSuiTransactionError", () => {
  it("explains an over-budget Move abort in user-facing language", () => {
    expect(
      explainSuiTransactionError(
        "Transaction resolution failed: MoveAbort in 1st command, abort code: 6, in '0xpackage::policy::record_budget_use' (instruction 51)"
      )
    ).toBe("Rejected: this action exceeds the policy's remaining budget.");
  });

  it.each([
    [1, "Rejected: only the configured agent wallet can execute this action."],
    [2, "Rejected: the owner revoked this policy."],
    [3, "Rejected: this policy has expired."],
    [4, "Rejected: this DeepBook pool is not allowed by the policy."],
    [5, "Rejected: the amount must be greater than zero."],
    [7, "Rejected: this vault does not belong to the selected policy."]
  ])("maps policy abort code %i", (code, message) => {
    expect(
      explainSuiTransactionError(
        `Transaction resolution failed: MoveAbort in command 1, abort code: ${code}, in '0xpackage::policy::record_budget_use'`
      )
    ).toBe(message);
  });

  it("explains insufficient Sui balance", () => {
    expect(explainSuiTransactionError("InsufficientCoinBalance in command 0")).toBe(
      "Rejected: the signing wallet or policy vault does not have enough SUI."
    );
  });

  it("explains missing gas separately from vault balance", () => {
    expect(explainSuiTransactionError("No valid gas coins found for signer")).toBe(
      "Rejected: the signing wallet does not have enough SUI for gas."
    );
  });

  it("explains missing Sui objects without leaking RPC wording", () => {
    expect(explainSuiTransactionError("ObjectNotFound object_id: 0xabc")).toBe(
      "Rejected: a required Sui object was not found. Refresh the Sui IDs and try again."
    );
  });

  it("does not treat a DeepBook abort code as an AgentWallet policy error", () => {
    expect(
      explainSuiTransactionError(
        "Transaction resolution failed: MoveAbort in command 4, abort code: 2, in '0xdeepbook::pool::place_limit_order'"
      )
    ).toBe("Rejected: DeepBook rejected the order before it could be placed.");
  });

  it.each([
    [0, "Rejected: the DeepBook limit price is invalid for this market."],
    [1, "Rejected: this order is below DeepBook's minimum size."],
    [2, "Rejected: this order does not match DeepBook's required lot size."],
    [3, "Rejected: the DeepBook order expiry is invalid."],
    [4, "Rejected: the DeepBook order type is invalid."],
    [5, "Rejected: the post-only order would immediately cross the book."],
    [6, "Rejected: the fill-or-kill order could not be fully filled."],
    [7, "Rejected: DeepBook cannot place a market order as post-only."]
  ])("explains DeepBook order validation abort code %i", (code, message) => {
    expect(
      explainSuiTransactionError(
        `MoveAbort in command 4, abort code: ${code}, in '0xdeepbook::order_info::validate_inputs'`
      )
    ).toBe(message);
  });

  it("turns generic transaction failure into a next-step message", () => {
    expect(explainSuiTransactionError("Sui transaction failed.")).toBe(
      "Rejected: Sui rejected the transaction. Check balances, policy status, and order settings before retrying."
    );
  });

  it("returns structured details for agent integrations", () => {
    expect(
      getSuiTransactionErrorDetails(
        "MoveAbort in command 1, abort code: 6, in '0xpackage::policy::record_budget_use'"
      )
    ).toMatchObject({
      code: "SUI_OVER_BUDGET",
      suggestedAction: "reduce_amount_or_create_new_policy"
    });
  });
});
