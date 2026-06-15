import { describe, expect, it } from "vitest";
import { explainAgentSpendError, getAgentSpendErrorDetails } from "./anchor-errors";

describe("explainAgentSpendError", () => {
  it("maps Anchor custom error codes to policy messages", () => {
    expect(explainAgentSpendError({ InstructionError: [0, { Custom: 6009 }] })).toBe(
      "Rejected: this payment is above the owner approval threshold."
    );
  });

  it("maps hex custom program errors to policy messages", () => {
    expect(explainAgentSpendError("custom program error: 0x1779")).toBe(
      "Rejected: this payment is above the owner approval threshold."
    );
  });

  it("explains a blocked recipient in user-facing language", () => {
    expect(explainAgentSpendError({ InstructionError: [0, { Custom: 6006 }] })).toBe(
      "Rejected: that recipient wallet is not on the allowed list."
    );
  });

  it("explains a missing agent token account", () => {
    expect(
      explainAgentSpendError(
        "Agent token account ABC123 does not exist. Fund the agent wallet with this SPL token first."
      )
    ).toBe("Rejected: the agent wallet does not have a funded token account for this token.");
  });

  it("maps SPL token custom error 1 to an insufficient balance message", () => {
    expect(explainAgentSpendError("custom program error: 0x1")).toBe(
      "Rejected: the agent wallet does not have enough SOL or token balance to complete this payment."
    );
    expect(getAgentSpendErrorDetails({ InstructionError: [0, { Custom: 1 }] })).toMatchObject({
      code: "INSUFFICIENT_FUNDS",
      suggestedAction: "request_owner_funding"
    });
  });

  it("falls back when the code is unknown", () => {
    expect(explainAgentSpendError({ InstructionError: [0, { Custom: 6999 }] })).toBe(
      "Rejected: custom program error 6999."
    );
  });

  it("returns structured details for agents to handle policy rejections", () => {
    expect(getAgentSpendErrorDetails({ InstructionError: [0, { Custom: 6006 }] })).toEqual({
      code: "RECIPIENT_NOT_ALLOWED",
      message: "Recipient wallet is not on the allowed list.",
      humanMessage: "That recipient wallet is not on the allowed list.",
      agentMessage: "Choose an allowed recipient or ask the owner to update the policy.",
      suggestedAction: "request_owner_policy_update"
    });
  });

  it("returns structured details for owner approval requirements", () => {
    expect(getAgentSpendErrorDetails({ InstructionError: [0, { Custom: 6009 }] })).toEqual({
      code: "OWNER_APPROVAL_REQUIRED",
      message: "Payment is above the owner approval threshold.",
      humanMessage: "This payment is above the owner approval threshold.",
      agentMessage: "Request owner approval and wait for the approval result before retrying.",
      suggestedAction: "request_owner_approval"
    });
  });
});
