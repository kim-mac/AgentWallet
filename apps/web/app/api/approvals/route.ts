import { NextResponse } from "next/server";
import { listOwnerApprovals } from "../../../lib/agent-approvals";
import { AuthError, requireOwnerFromSession } from "../../../lib/wallet-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const owner = await requireOwnerFromSession();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId") ?? undefined;

    return NextResponse.json({ approvals: await listOwnerApprovals(owner, agentId) });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load approvals." },
      { status }
    );
  }
}
