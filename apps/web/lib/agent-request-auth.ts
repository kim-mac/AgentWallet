import { AgentExecutionError } from "./agent-executor";

export function authorizeAgentRequest(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new AgentExecutionError("Invalid agent API key.", 401);
  }

  return authorization.slice("Bearer ".length).trim();
}
