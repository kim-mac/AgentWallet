import { describe, expect, it } from "vitest";
import { parseSuiAgentCommand, scaleSuiOrderQuantity } from "./sui-agent-command";

describe("parseSuiAgentCommand", () => {
  it("parses a buy command into a DeepBook bid using SUI mist", () => {
    expect(parseSuiAgentCommand("buy 0.05 SUI of DEEP")).toEqual({
      kind: "place-order",
      side: "buy",
      amount: "50000000",
      execution: "limit"
    });
  });

  it("parses a sell command into a DeepBook ask", () => {
    expect(parseSuiAgentCommand("sell 0.1 SUI of DEEP")).toEqual({
      kind: "place-order",
      side: "sell",
      amount: "100000000",
      execution: "limit"
    });
  });

  it("parses market-prefixed orders as immediate DeepBook execution", () => {
    expect(parseSuiAgentCommand("market buy 0.1 SUI of DEEP")).toEqual({
      kind: "place-order",
      side: "buy",
      amount: "100000000",
      execution: "market"
    });
    expect(parseSuiAgentCommand("limit sell 0.2 SUI of DEEP")).toEqual({
      kind: "place-order",
      side: "sell",
      amount: "200000000",
      execution: "limit"
    });
  });

  it("parses SUI/USDC buy commands using USDC decimals", () => {
    expect(parseSuiAgentCommand("market buy 1 USDC of SUI")).toEqual({
      kind: "place-order",
      side: "buy",
      amount: "1000000",
      execution: "market"
    });
    expect(parseSuiAgentCommand("limit buy 2.5 USDC of SUI")).toEqual({
      kind: "place-order",
      side: "buy",
      amount: "2500000",
      execution: "limit"
    });
  });

  it("parses SUI/USDC sell commands using SUI decimals", () => {
    expect(parseSuiAgentCommand("market sell 0.1 SUI for USDC")).toEqual({
      kind: "place-order",
      side: "sell",
      amount: "100000000",
      execution: "market"
    });
    expect(parseSuiAgentCommand("limit sell 1 SUI for USDC")).toEqual({
      kind: "place-order",
      side: "sell",
      amount: "1000000000",
      execution: "limit"
    });
  });


  it.each([
    ["show budget", { kind: "show-budget" }],
    ["show orders", { kind: "show-orders" }],
    ["test over budget", { kind: "test-over-budget" }]
  ])("parses %s", (input, expected) => {
    expect(parseSuiAgentCommand(input)).toEqual(expected);
  });

  it("rejects unsupported commands with guidance", () => {
    expect(() => parseSuiAgentCommand("do something clever")).toThrow(
      "Try: market buy 0.1 SUI of DEEP, market sell 0.1 SUI for USDC, show budget, show orders, or test over budget."
    );
  });

  it("scales valid DeepBook quantities using the market order increment", () => {
    expect(scaleSuiOrderQuantity("100000000", "100000000", "10000000")).toBe("10000000");
    expect(scaleSuiOrderQuantity("200000000", "100000000", "10000000")).toBe("20000000");
  });

  it("rejects commands below the DeepBook minimum or outside its order increment", () => {
    expect(() => scaleSuiOrderQuantity("50000000", "100000000", "10000000")).toThrow(
      "DeepBook orders must be at least the selected market minimum and use that market increment."
    );
    expect(() => scaleSuiOrderQuantity("150000000", "100000000", "10000000")).toThrow(
      "DeepBook orders must be at least the selected market minimum and use that market increment."
    );
  });
});
