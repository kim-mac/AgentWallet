import { describe, expect, it, vi } from "vitest";
import { handleMcpJsonRpcRequest } from "./server";

describe("handleMcpJsonRpcRequest", () => {
  it("returns MCP initialize metadata", async () => {
    await expect(
      handleMcpJsonRpcRequest(
        { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
        { listTools: () => [], callTool: vi.fn() }
      )
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "agentwallet-mcp"
        }
      }
    });
  });

  it("lists tools and calls tools through the tool layer", async () => {
    const tools = {
      listTools: () => [
        {
          name: "get_wallet_status",
          description: "status",
          inputSchema: {
            type: "object" as const,
            additionalProperties: false,
            properties: {}
          }
        }
      ],
      callTool: vi.fn(async () => ({ content: [{ type: "text" as const, text: "{}" }] }))
    };

    await expect(
      handleMcpJsonRpcRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" }, tools)
    ).resolves.toMatchObject({
      result: {
        tools: [{ name: "get_wallet_status" }]
      }
    });

    await expect(
      handleMcpJsonRpcRequest(
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "get_wallet_status", arguments: {} }
        },
        tools
      )
    ).resolves.toMatchObject({
      result: { content: [{ type: "text", text: "{}" }] }
    });

    expect(tools.callTool).toHaveBeenCalledWith("get_wallet_status", {});
  });
});
