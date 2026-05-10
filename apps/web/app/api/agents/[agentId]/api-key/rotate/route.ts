import { NextResponse } from "next/server";
import {
  AgentProvisioningError,
  rotateProvisionedAgentApiKey
} from "../../../../../../lib/agent-provisioning";
import { AuthError, requireOwnerFromSession } from "../../../../../../lib/wallet-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const owner = await requireOwnerFromSession();
    const { agentId } = await params;
    return NextResponse.json(await rotateProvisionedAgentApiKey(owner, agentId));
  } catch (error) {
    const status =
      error instanceof AuthError || error instanceof AgentProvisioningError ? error.status : 400;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to rotate API key." },
      { status }
    );
  }
}
