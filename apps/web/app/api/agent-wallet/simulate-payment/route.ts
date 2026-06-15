import { NextResponse } from "next/server";
import {
  AgentExecutionError,
  formatAgentExecutionError,
  withAgentExecutionTimeout
} from "../../../../lib/agent-executor";
import { authorizeAgentRequest } from "../../../../lib/agent-request-auth";
import { simulateProvisionedAgentPayment } from "../../../../lib/agent-payment-simulator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const apiKey = authorizeAgentRequest(request);
    const result = await withAgentExecutionTimeout(
      simulateProvisionedAgentPayment(apiKey, await request.json())
    );

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AgentExecutionError ? error.status : 400;

    return NextResponse.json(formatAgentExecutionError(error), { status });
  }
}
