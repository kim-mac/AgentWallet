import { NextResponse } from "next/server";
import {
  AgentProvisioningError,
  createProvisionedAgent,
  listProvisionedAgents
} from "../../../lib/agent-provisioning";
import { AuthError, requireOwnerFromSession } from "../../../lib/wallet-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const owner = await requireOwnerFromSession();
    return NextResponse.json({ agents: await listProvisionedAgents(owner) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const owner = await requireOwnerFromSession();
    const result = await createProvisionedAgent(owner, await request.json());

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  const status =
    error instanceof AuthError || error instanceof AgentProvisioningError ? error.status : 400;

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Agent provisioning failed." },
    { status }
  );
}
