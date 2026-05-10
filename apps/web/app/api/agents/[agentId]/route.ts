import { NextResponse } from "next/server";
import {
  AgentProvisioningError,
  updateProvisionedAgentConfig
} from "../../../../lib/agent-provisioning";
import { AuthError, requireOwnerFromSession } from "../../../../lib/wallet-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const owner = await requireOwnerFromSession();
    const { agentId } = await params;
    const agent = await updateProvisionedAgentConfig(owner, agentId, await request.json());

    return NextResponse.json({ agent });
  } catch (error) {
    const status =
      error instanceof AuthError || error instanceof AgentProvisioningError ? error.status : 400;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update agent." },
      { status }
    );
  }
}
