import { describe, expect, it, vi } from "vitest";
import {
  createAgentWalletMcpTools,
  getAgentWalletMcpToolDefinitions
} from "./index";

const capabilityResponse = {
  ok: true as const,
  agent: {
    id: "agent_123",
    owner: "owner_123",
    name: "Research agent",
    publicKey: "agent_123",
    apiKeyPrefix: "agw_live_1",
    programId: "program_123",
    policyPda: "policy_123",
    tokenMint: "token_1",
    decimals: 6,
    telegramChatId: null,
    createdAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-29T00:00:00.000Z"
  },
  policy: {
    pda: "policy_123",
    status: "active" as const,
    owner: "owner_123",
    programId: "program_123",
    periodStartedAt: "0",
    periodSeconds: "86400"
  },
  allowed: {
    recipients: ["recipient_1"],
    tokenMints: ["token_1"]
  },
  spend: {
    maxPerPaymentUnits: "3000000",
    dailyBudgetUnits: "10000000",
    spentInPeriodUnits: "0",
    remainingBudgetUnits: "10000000",
    approvalThresholdUnits: "2000000"
  },
  canSpendNow: true,
  supportedActions: ["simulate_payment", "request_payment"],
  nextAction: "Use simulate_payment before request_payment when planning a spend."
};

describe("AgentWallet MCP tools", () => {
  it("exposes the core agent wallet tools", () => {
    expect(getAgentWalletMcpToolDefinitions().map((tool) => tool.name)).toEqual([
      "get_wallet_status",
      "get_capabilities",
      "list_allowed_recipients",
      "list_allowed_tokens",
      "simulate_payment",
      "request_payment",
      "get_audit_log"
    ]);
  });

  it("calls wallet capabilities for list tools", async () => {
    const wallet = {
      getCapabilities: vi.fn(async () => capabilityResponse)
    };
    const tools = createAgentWalletMcpTools(wallet);

    await expect(tools.callTool("list_allowed_recipients", {})).resolves.toMatchObject({
      content: [{ type: "text", text: JSON.stringify(["recipient_1"], null, 2) }]
    });
    await expect(tools.callTool("list_allowed_tokens", {})).resolves.toMatchObject({
      content: [{ type: "text", text: JSON.stringify(["token_1"], null, 2) }]
    });
  });

  it("maps simulate_payment and request_payment to the AgentWallet SDK", async () => {
    const wallet = {
      simulatePayment: vi.fn(async () => ({
        ok: true as const,
        decision: "approved" as const,
        code: "PAYMENT_ALLOWED",
        message: "Payment is allowed.",
        humanMessage: "Payment is allowed.",
        agentMessage: "Execute payment.",
        suggestedAction: "execute_payment",
        amount: "1",
        amountUnits: "1000000",
        tokenMint: "token_1",
        recipient: "recipient_1",
        policyPda: "policy_123",
        remainingBudgetUnits: "10000000"
      })),
      pay: vi.fn(async () => ({
        ok: true as const,
        cluster: "devnet" as const,
        agent: "agent_123",
        policyPda: "policy_123",
        tokenMint: "token_1",
        amount: "1",
        signature: "sig_123",
        explorerUrl: "https://explorer.solana.com/tx/sig_123?cluster=devnet",
        agentTokenAccount: "agent_token_1",
        recipientTokenAccount: "recipient_token_1"
      }))
    };
    const tools = createAgentWalletMcpTools(wallet);

    await tools.callTool("simulate_payment", {
      recipient: "recipient_1",
      amount: "1"
    });
    await tools.callTool("request_payment", {
      recipient: "recipient_1",
      amount: "1"
    });

    expect(wallet.simulatePayment).toHaveBeenCalledWith({
      recipient: "recipient_1",
      amount: "1"
    });
    expect(wallet.pay).toHaveBeenCalledWith({
      recipient: "recipient_1",
      amount: "1"
    });
  });

  it("returns a structured MCP error for unknown tools", async () => {
    const tools = createAgentWalletMcpTools({});

    await expect(tools.callTool("unknown_tool", {})).resolves.toMatchObject({
      isError: true,
      content: [{ type: "text", text: expect.stringContaining("Unknown AgentWallet MCP tool") }]
    });
  });
});
