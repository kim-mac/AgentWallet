import { describe, expect, it } from "vitest";
import { parseAgentCommand } from "./agent-command";

const recipient = "DAzJZKmEUtHfXL69kLHMG4pu3oVTpo6RTSAYXPEPZugF";

describe("parseAgentCommand", () => {
  it("extracts amount and recipient from a natural send command", () => {
    expect(parseAgentCommand(`send 1.5 token to ${recipient}`)).toEqual({
      action: "send",
      amount: "1.5",
      recipient
    });
  });

  it("supports payment phrasing without hardcoded outcomes", () => {
    expect(parseAgentCommand(`please pay 999 to ${recipient}`)).toEqual({
      action: "send",
      amount: "999",
      recipient
    });
  });

  it("rejects unsupported swap intent for the current MVP", () => {
    expect(() => parseAgentCommand("buy 40 dollars of sol")).toThrow(
      "Swap support is not connected yet"
    );
  });

  it("requires a Solana recipient public key", () => {
    expect(() => parseAgentCommand("send 1 token to not-a-wallet")).toThrow(
      "Include a valid recipient public key"
    );
  });
});
