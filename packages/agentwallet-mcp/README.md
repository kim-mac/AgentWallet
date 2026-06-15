# AgentWallet MCP

AgentWallet MCP exposes a hosted AgentWallet as native tools for AI agents.

## Environment

```bash
AGENTWALLET_BASE_URL=https://agentwallet-web.vercel.app
AGENTWALLET_API_KEY=<hosted-agent-api-key>
```

## Tools

- `get_wallet_status`
- `get_capabilities`
- `list_allowed_recipients`
- `list_allowed_tokens`
- `simulate_payment`
- `request_payment`
- `get_audit_log`

## Example MCP Config

```json
{
  "mcpServers": {
    "agentwallet": {
      "command": "npx",
      "args": ["agentwallet-mcp"],
      "env": {
        "AGENTWALLET_BASE_URL": "https://agentwallet-web.vercel.app",
        "AGENTWALLET_API_KEY": "<hosted-agent-api-key>"
      }
    }
  }
}
```

## Agent Flow

1. Call `get_capabilities` to understand allowed recipients, tokens, caps, and budget.
2. Call `simulate_payment` before spending.
3. If the result is approved, call `request_payment`.
4. If the result requires approval or is rejected, follow `suggestedAction`.
5. Call `get_audit_log` to inspect recent wallet activity.
