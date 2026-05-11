import { NextResponse } from "next/server";
import { getAgentByApiKey } from "../../../../lib/agent-provisioning";
import { authorizeAgentRequest } from "../../../../lib/agent-request-auth";
import { listAuditEvents } from "../../../../lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const agent = await getAgentByApiKey(authorizeAgentRequest(request));

  if (!agent) {
    return NextResponse.json({ error: "Invalid agent API key." }, { status: 401 });
  }

  return NextResponse.json({
    events: await listAuditEvents({ owner: agent.owner, agentId: agent.id })
  });
}
