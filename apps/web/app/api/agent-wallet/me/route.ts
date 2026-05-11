import { NextResponse } from "next/server";
import { buildAgentWalletStatus } from "../../../../lib/agent-wallet-status";
import { getAgentByApiKey, toPublicAgent } from "../../../../lib/agent-provisioning";
import { authorizeAgentRequest } from "../../../../lib/agent-request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const agent = await getAgentByApiKey(authorizeAgentRequest(request));

  if (!agent) {
    return NextResponse.json({ error: "Invalid agent API key." }, { status: 401 });
  }

  return NextResponse.json({
    agent: toPublicAgent(agent),
    status: buildAgentWalletStatus(agent)
  });
}
