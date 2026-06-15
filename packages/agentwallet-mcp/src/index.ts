import { AgentWallet, type AgentWalletPaymentInput } from "@agentwallet/sdk";

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    additionalProperties: boolean;
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type AgentWalletMcpWallet = Pick<
  AgentWallet,
  "getAgent" | "getCapabilities" | "simulatePayment" | "pay" | "getAudit"
>;

export type AgentWalletMcpToolName =
  | "get_wallet_status"
  | "get_capabilities"
  | "list_allowed_recipients"
  | "list_allowed_tokens"
  | "simulate_payment"
  | "request_payment"
  | "get_audit_log";

const paymentInputProperties = {
  recipient: {
    type: "string",
    description: "Solana recipient wallet public key."
  },
  amount: {
    type: "string",
    description: "Human token amount, for example 1 or 2.5."
  },
  tokenMint: {
    type: "string",
    description: "Optional SPL token mint. Defaults to the hosted agent token mint."
  },
  decimals: {
    type: "integer",
    minimum: 0,
    maximum: 9,
    description: "Optional token decimals. Defaults to the hosted agent decimals."
  }
};

const toolDefinitions: McpToolDefinition[] = [
  {
    name: "get_wallet_status",
    description: "Get the hosted AgentWallet public key and readiness status.",
    inputSchema: emptySchema()
  },
  {
    name: "get_capabilities",
    description: "Get current policy boundaries, spend limits, allowed recipients, and allowed token mints.",
    inputSchema: emptySchema()
  },
  {
    name: "list_allowed_recipients",
    description: "List recipient wallets the agent is allowed to pay.",
    inputSchema: emptySchema()
  },
  {
    name: "list_allowed_tokens",
    description: "List token mints the agent is allowed to spend.",
    inputSchema: emptySchema()
  },
  {
    name: "simulate_payment",
    description: "Check whether a payment would be approved, rejected, or require owner approval without moving funds.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["recipient", "amount"],
      properties: paymentInputProperties
    }
  },
  {
    name: "request_payment",
    description: "Execute a policy-gated payment through the hosted AgentWallet.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["recipient", "amount"],
      properties: paymentInputProperties
    }
  },
  {
    name: "get_audit_log",
    description: "Get recent AgentWallet audit events for this hosted agent.",
    inputSchema: emptySchema()
  }
];

export function getAgentWalletMcpToolDefinitions(): McpToolDefinition[] {
  return toolDefinitions;
}

export function createAgentWalletMcpTools(wallet: Partial<AgentWalletMcpWallet>) {
  return {
    listTools: getAgentWalletMcpToolDefinitions,
    async callTool(name: string, input: unknown): Promise<McpToolResult> {
      try {
        switch (name) {
          case "get_wallet_status":
            return jsonContent(await requireMethod(wallet.getAgent, name)());
          case "get_capabilities":
            return jsonContent(await requireMethod(wallet.getCapabilities, name)());
          case "list_allowed_recipients": {
            const capabilities = await requireMethod(wallet.getCapabilities, name)();
            return jsonContent(capabilities.allowed.recipients);
          }
          case "list_allowed_tokens": {
            const capabilities = await requireMethod(wallet.getCapabilities, name)();
            return jsonContent(capabilities.allowed.tokenMints);
          }
          case "simulate_payment":
            return jsonContent(await requireMethod(wallet.simulatePayment, name)(parsePaymentInput(input)));
          case "request_payment":
            return jsonContent(await requireMethod(wallet.pay, name)(parsePaymentInput(input)));
          case "get_audit_log":
            return jsonContent(await requireMethod(wallet.getAudit, name)());
          default:
            return errorContent(`Unknown AgentWallet MCP tool: ${name}`);
        }
      } catch (error) {
        return errorContent(error instanceof Error ? error.message : "AgentWallet MCP tool failed.");
      }
    }
  };
}

export function createAgentWalletMcpToolsFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const baseUrl = env.AGENTWALLET_BASE_URL;
  const apiKey = env.AGENTWALLET_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Set AGENTWALLET_BASE_URL and AGENTWALLET_API_KEY before starting AgentWallet MCP.");
  }

  return createAgentWalletMcpTools(new AgentWallet({ baseUrl, apiKey }));
}

function parsePaymentInput(input: unknown): AgentWalletPaymentInput {
  if (!input || typeof input !== "object") {
    throw new Error("Payment input must be an object.");
  }

  const value = input as Record<string, unknown>;
  if (typeof value.recipient !== "string" || !value.recipient.trim()) {
    throw new Error("Payment input requires recipient.");
  }

  if (typeof value.amount !== "string" || !value.amount.trim()) {
    throw new Error("Payment input requires amount.");
  }

  return {
    recipient: value.recipient,
    amount: value.amount,
    ...(typeof value.tokenMint === "string" ? { tokenMint: value.tokenMint } : {}),
    ...(typeof value.decimals === "number" ? { decimals: value.decimals } : {})
  };
}

function requireMethod<T extends (...args: never[]) => Promise<unknown>>(
  method: T | undefined,
  toolName: string
): T {
  if (!method) {
    throw new Error(`AgentWallet method is not available for ${toolName}.`);
  }

  return method;
}

function jsonContent(value: unknown): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }]
  };
}

function errorContent(message: string): McpToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }]
  };
}

function emptySchema(): McpToolDefinition["inputSchema"] {
  return {
    type: "object",
    additionalProperties: false,
    properties: {}
  };
}
