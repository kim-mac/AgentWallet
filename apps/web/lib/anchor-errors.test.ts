import { describe, expect, it } from "vitest";
import { explainAgentSpendError } from "./anchor-errors";

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

  it("falls back when the code is unknown", () => {
    expect(explainAgentSpendError({ InstructionError: [0, { Custom: 6999 }] })).toBe(
      "Rejected: custom program error 6999."
    );
  });
});
