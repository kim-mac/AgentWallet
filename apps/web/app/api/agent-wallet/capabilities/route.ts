import { NextResponse } from "next/server";
import { getProvisionedAgentCapabilities } from "../../../../lib/agent-capabilities";
import {
  AgentExecutionError,
  formatAgentExecutionError,
  withAgentExecutionTimeout
} from "../../../../lib/agent-executor";
import { authorizeAgentRequest } from "../../../../lib/agent-request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const apiKey = authorizeAgentRequest(request);
    const result = await withAgentExecutionTimeout(getProvisionedAgentCapabilities(apiKey));

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AgentExecutionError ? error.status : 400;

    return NextResponse.json(formatAgentExecutionError(error), { status });
  }
}
