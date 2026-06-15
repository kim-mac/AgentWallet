import { describe, expect, it } from "vitest";
import { agentWalletOpenApiSpec } from "./openapi";

describe("agentWalletOpenApiSpec", () => {
  it("describes the public agent wallet endpoints for machine clients", () => {
    expect(agentWalletOpenApiSpec).toMatchObject({
      openapi: "3.1.0",
      info: {
        title: "AgentWallet API"
      },
      paths: {
        "/api/agent-wallet/me": {
          get: {
            security: [{ agentApiKey: [] }]
          }
        },
        "/api/agent-wallet/capabilities": {
          get: {
            summary: expect.stringContaining("capabilities")
          }
        },
        "/api/agent-wallet/simulate-payment": {
          post: {
            summary: expect.stringContaining("Simulate")
          }
        },
        "/api/agent-wallet/pay": {
          post: {
            summary: expect.stringContaining("Execute")
          }
        },
        "/api/agent-wallet/audit": {
          get: {
            summary: expect.stringContaining("audit")
          }
        }
      },
      components: {
        securitySchemes: {
          agentApiKey: {
            type: "http",
            scheme: "bearer"
          }
        },
        schemas: {
          AgentCapabilities: expect.any(Object),
          PaymentSimulationResult: expect.any(Object),
          StructuredError: expect.any(Object)
        }
      }
    });
  });

  it("marks machine-readable payment routes with structured error responses", () => {
    expect(
      agentWalletOpenApiSpec.paths["/api/agent-wallet/pay"].post.responses["400"]
    ).toMatchObject({
      description: "Structured policy or payment rejection",
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/StructuredError"
          }
        }
      }
    });
  });
});
