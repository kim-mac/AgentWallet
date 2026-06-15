import { describe, expect, it } from "vitest";
import { AgentExecutionError, formatAgentExecutionError } from "./agent-executor";

describe("formatAgentExecutionError", () => {
  it("returns structured fields for agent-facing API responses", () => {
    const error = new AgentExecutionError("Recipient is blocked.", 400, {
      code: "RECIPIENT_NOT_ALLOWED",
      message: "Recipient wallet is not on the allowed list.",
      humanMessage: "That recipient wallet is not on the allowed list.",
      agentMessage: "Choose an allowed recipient or ask the owner to update the policy.",
      suggestedAction: "request_owner_policy_update"
    });

    expect(formatAgentExecutionError(error)).toEqual({
      ok: false,
      error: "Recipient is blocked.",
      code: "RECIPIENT_NOT_ALLOWED",
      message: "Recipient wallet is not on the allowed list.",
      humanMessage: "That recipient wallet is not on the allowed list.",
      agentMessage: "Choose an allowed recipient or ask the owner to update the policy.",
      suggestedAction: "request_owner_policy_update"
    });
  });
});
