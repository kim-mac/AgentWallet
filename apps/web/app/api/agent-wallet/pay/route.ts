import { NextResponse } from "next/server";
import {
  AgentExecutionError,
  executeProvisionedAgentPayment,
  formatAgentExecutionError,
  withAgentExecutionTimeout
} from "../../../../lib/agent-executor";
import { authorizeAgentRequest } from "../../../../lib/agent-request-auth";

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

    return NextResponse.json(formatAgentExecutionError(error), { status });
  }
}
