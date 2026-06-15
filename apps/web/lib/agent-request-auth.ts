import { AgentExecutionError } from "./agent-executor";

export function authorizeAgentRequest(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new AgentExecutionError("Invalid agent API key.", 401, {
      code: "INVALID_AGENT_API_KEY",
      message: "Agent API key is missing or invalid.",
      humanMessage: "Invalid agent API key.",
      agentMessage: "Use a valid AgentWallet API key from the selected hosted agent.",
      suggestedAction: "rotate_or_update_agent_api_key"
    });
  }

  return authorization.slice("Bearer ".length).trim();
}
