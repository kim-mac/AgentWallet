import { NextResponse } from "next/server";
import {
  AgentApprovalError,
  markApprovalRejected
} from "../../../../../lib/agent-approvals";
import { AuthError, requireOwnerFromSession } from "../../../../../lib/wallet-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  try {
    const owner = await requireOwnerFromSession();
    const { approvalId } = await params;
    const approval = await markApprovalRejected(owner, approvalId);

    return NextResponse.json({ approval });
  } catch (error) {
    const status =
      error instanceof AuthError || error instanceof AgentApprovalError ? error.status : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reject approval." },
      { status }
    );
  }
}
