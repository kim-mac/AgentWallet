#!/usr/bin/env node
import { createInterface } from "node:readline";
import {
  createAgentWalletMcpToolsFromEnv,
  type McpToolDefinition,
  type McpToolResult
} from "./index";

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
};

export type AgentWalletMcpToolServer = {
  listTools: () => McpToolDefinition[];
  callTool: (name: string, input: unknown) => Promise<McpToolResult>;
};

export async function handleMcpJsonRpcRequest(
  request: JsonRpcRequest,
  tools: AgentWalletMcpToolServer
): Promise<JsonRpcResponse | null> {
  if (request.method === "notifications/initialized") {
    return null;
  }

  if (request.method === "initialize") {
    return response(request.id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: "agentwallet-mcp",
        version: "0.1.0"
      }
    });
  }

  if (request.method === "tools/list") {
    return response(request.id, {
      tools: tools.listTools()
    });
  }

  if (request.method === "tools/call") {
    const params = request.params as { name?: unknown; arguments?: unknown } | undefined;
    if (!params || typeof params.name !== "string") {
      return errorResponse(request.id, -32602, "tools/call requires params.name.");
    }

    return response(request.id, await tools.callTool(params.name, params.arguments ?? {}));
  }

  return errorResponse(request.id, -32601, `Unknown MCP method: ${request.method}`);
}

export function startAgentWalletMcpServer(tools = createAgentWalletMcpToolsFromEnv()) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on("line", async (line) => {
    if (!line.trim()) {
      return;
    }

    try {
      const request = JSON.parse(line) as JsonRpcRequest;
      const result = await handleMcpJsonRpcRequest(request, tools);

      if (result) {
        process.stdout.write(`${JSON.stringify(result)}\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON-RPC request.";
      process.stdout.write(`${JSON.stringify(errorResponse(null, -32700, message))}\n`);
    }
  });
}

function response(id: JsonRpcRequest["id"], result: unknown): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

function errorResponse(
  id: JsonRpcRequest["id"],
  code: number,
  message: string
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message
    }
  };
}

if (process.argv[1]?.endsWith("server.ts")) {
  startAgentWalletMcpServer();
}
