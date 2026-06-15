export const agentWalletOpenApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "AgentWallet API",
    version: "0.1.0",
    description:
      "Agent-native wallet API for hosted Solana devnet wallets protected by owner-defined on-chain policy."
  },
  servers: [
    {
      url: "https://agentwallet-web.vercel.app",
      description: "Production devnet demo"
    },
    {
      url: "http://localhost:3002",
      description: "Local development"
    }
  ],
  tags: [
    {
      name: "Agent runtime",
      description: "Endpoints intended for AI agents and agent frameworks."
    }
  ],
  paths: {
    "/api/agent-wallet/me": {
      get: {
        tags: ["Agent runtime"],
        summary: "Get hosted agent wallet status",
        description: "Returns the selected hosted agent wallet and basic readiness state.",
        security: [{ agentApiKey: [] }],
        responses: {
          "200": jsonResponse("Agent wallet status", "#/components/schemas/AgentWalletMe"),
          "401": errorResponse("Invalid agent API key")
        }
      }
    },
    "/api/agent-wallet/setup-status": {
      get: {
        tags: ["Agent runtime"],
        summary: "Get setup status",
        description: "Returns missing setup steps and the next owner action needed before the agent can spend.",
        security: [{ agentApiKey: [] }],
        responses: {
          "200": jsonResponse("Agent setup status", "#/components/schemas/AgentSetupStatus"),
          "401": errorResponse("Invalid agent API key")
        }
      }
    },
    "/api/agent-wallet/capabilities": {
      get: {
        tags: ["Agent runtime"],
        summary: "Get agent wallet capabilities",
        description:
          "Returns policy-derived boundaries including allowed recipients, allowed token mints, spend caps, remaining budget, policy status, and supported actions.",
        security: [{ agentApiKey: [] }],
        responses: {
          "200": jsonResponse("Agent capabilities", "#/components/schemas/AgentCapabilities"),
          "400": errorResponse("Policy not initialized"),
          "401": errorResponse("Invalid agent API key"),
          "404": errorResponse("Policy account missing")
        }
      }
    },
    "/api/agent-wallet/simulate-payment": {
      post: {
        tags: ["Agent runtime"],
        summary: "Simulate a policy-gated payment",
        description:
          "Reads the active on-chain policy and returns whether a payment would be approved, rejected, or require owner approval without signing or sending a transaction.",
        security: [{ agentApiKey: [] }],
        requestBody: jsonRequest("#/components/schemas/PaymentRequest"),
        responses: {
          "200": jsonResponse("Payment simulation result", "#/components/schemas/PaymentSimulationResult"),
          "400": errorResponse("Structured policy or payment rejection"),
          "401": errorResponse("Invalid agent API key"),
          "404": errorResponse("Policy account missing")
        }
      }
    },
    "/api/agent-wallet/pay": {
      post: {
        tags: ["Agent runtime"],
        summary: "Execute a policy-gated payment",
        description:
          "Executes a Solana devnet SPL token transfer using the hosted agent wallet only if the on-chain policy allows it or an owner approval is available.",
        security: [{ agentApiKey: [] }],
        requestBody: jsonRequest("#/components/schemas/PaymentRequest"),
        responses: {
          "200": jsonResponse("Executed payment", "#/components/schemas/PaymentResult"),
          "400": errorResponse("Structured policy or payment rejection"),
          "401": errorResponse("Invalid agent API key"),
          "402": errorResponse("Owner approval required"),
          "504": errorResponse("Solana devnet timeout")
        }
      }
    },
    "/api/agent-wallet/audit": {
      get: {
        tags: ["Agent runtime"],
        summary: "Get agent audit log",
        description: "Returns recent audit events for the authenticated hosted agent.",
        security: [{ agentApiKey: [] }],
        responses: {
          "200": jsonResponse("Audit events", "#/components/schemas/AuditLog"),
          "401": errorResponse("Invalid agent API key")
        }
      }
    }
  },
  components: {
    securitySchemes: {
      agentApiKey: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "AgentWallet API key"
      }
    },
    schemas: {
      AgentWalletMe: objectSchema({
        agent: { $ref: "#/components/schemas/Agent" },
        status: { $ref: "#/components/schemas/AgentWalletStatus" }
      }),
      AgentSetupStatus: objectSchema({
        agent: { $ref: "#/components/schemas/Agent" },
        setup: objectSchema({
          ready: { type: "boolean" },
          missing: { type: "array", items: { type: "string" } },
          ownerActionRequired: { type: "boolean" },
          nextAction: { type: "string" },
          availableActions: { type: "array", items: { type: "string" } },
          summary: { type: "string" }
        })
      }),
      AgentCapabilities: objectSchema({
        ok: { const: true },
        agent: { $ref: "#/components/schemas/Agent" },
        policy: objectSchema({
          pda: { type: "string" },
          status: { type: "string", enum: ["active", "paused"] },
          owner: { type: "string" },
          programId: { type: "string" },
          periodStartedAt: { type: "string" },
          periodSeconds: { type: "string" }
        }),
        allowed: objectSchema({
          recipients: { type: "array", items: { type: "string" } },
          tokenMints: { type: "array", items: { type: "string" } }
        }),
        spend: objectSchema({
          maxPerPaymentUnits: { type: "string" },
          dailyBudgetUnits: { type: "string" },
          spentInPeriodUnits: { type: "string" },
          remainingBudgetUnits: { type: "string" },
          approvalThresholdUnits: { type: "string" }
        }),
        canSpendNow: { type: "boolean" },
        supportedActions: { type: "array", items: { type: "string" } },
        nextAction: { type: "string" }
      }),
      PaymentRequest: objectSchema({
        recipient: { type: "string", minLength: 32 },
        amount: { type: "string", minLength: 1 },
        tokenMint: { type: "string", minLength: 32 },
        decimals: { type: "integer", minimum: 0, maximum: 9 },
        policyPda: { type: "string", minLength: 32 },
        programId: { type: "string", minLength: 32 }
      }, ["recipient", "amount"]),
      PaymentSimulationResult: objectSchema({
        ok: { const: true },
        decision: { type: "string", enum: ["approved", "requires_approval", "rejected"] },
        code: { type: "string" },
        message: { type: "string" },
        humanMessage: { type: "string" },
        agentMessage: { type: "string" },
        suggestedAction: { type: "string" },
        amount: { type: "string" },
        amountUnits: { type: "string" },
        tokenMint: { type: "string" },
        recipient: { type: "string" },
        policyPda: { type: "string" },
        remainingBudgetUnits: { type: "string" }
      }),
      PaymentResult: objectSchema({
        ok: { const: true },
        cluster: { const: "devnet" },
        agent: { type: "string" },
        policyPda: { type: "string" },
        tokenMint: { type: "string" },
        amount: { type: "string" },
        signature: { type: "string" },
        explorerUrl: { type: "string" },
        agentTokenAccount: { type: "string" },
        recipientTokenAccount: { type: "string" },
        approvalId: { type: "string" }
      }),
      AuditLog: objectSchema({
        events: {
          type: "array",
          items: objectSchema({
            id: { type: "string" },
            type: { type: "string" },
            status: { type: "string" },
            message: { type: "string" },
            createdAt: { type: "string" },
            signature: { type: "string" },
            explorerUrl: { type: "string" }
          })
        }
      }),
      Agent: objectSchema({
        id: { type: "string" },
        owner: { type: "string" },
        name: { type: "string" },
        publicKey: { type: "string" },
        apiKeyPrefix: { type: "string" },
        programId: { type: "string" },
        policyPda: { type: ["string", "null"] },
        tokenMint: { type: "string" },
        decimals: { type: "integer" },
        telegramChatId: { type: ["string", "null"] },
        createdAt: { type: "string" },
        updatedAt: { type: "string" }
      }),
      AgentWalletStatus: objectSchema({
        readyForPayments: { type: "boolean" },
        policyConfigured: { type: "boolean" },
        tokenMintConfigured: { type: "boolean" },
        telegramLinked: { type: "boolean" },
        missing: { type: "array", items: { type: "string" } }
      }),
      StructuredError: objectSchema({
        ok: { const: false },
        error: { type: "string" },
        code: { type: "string" },
        message: { type: "string" },
        humanMessage: { type: "string" },
        agentMessage: { type: "string" },
        suggestedAction: { type: "string" }
      })
    }
  }
} as const;

function jsonResponse(description: string, schemaRef: string) {
  return {
    description,
    content: {
      "application/json": {
        schema: { $ref: schemaRef }
      }
    }
  };
}

function errorResponse(description: string) {
  return jsonResponse(description, "#/components/schemas/StructuredError");
}

function jsonRequest(schemaRef: string) {
  return {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: schemaRef }
      }
    }
  };
}

function objectSchema(properties: Record<string, unknown>, required = Object.keys(properties)) {
  return {
    type: "object",
    additionalProperties: false,
    required,
    properties
  };
}
