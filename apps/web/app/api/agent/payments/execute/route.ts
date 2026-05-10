import { NextResponse } from "next/server";
import {
  AgentExecutionError,
  executeProvisionedAgentPayment,
  withAgentExecutionTimeout
} from "../../../../../lib/agent-executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const apiKey = authorizeAgentRequest(request);

    const result = await withAgentExecutionTimeout(
      executeProvisionedAgentPayment(apiKey, await request.json())
    );

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AgentExecutionError ? error.status : 400;

    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error)
      },
      { status }
    );
  }
}

function authorizeAgentRequest(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new AgentExecutionError("Invalid agent API key.", 401);
  }

  return authorization.slice("Bearer ".length).trim();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected agent execution error.";
}
