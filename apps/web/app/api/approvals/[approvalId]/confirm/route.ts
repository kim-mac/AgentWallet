import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AgentApprovalError,
  executeApprovedPayment
} from "../../../../../lib/agent-approvals";
import {
  AgentExecutionError,
  executeProvisionedAgentRecordPayment,
  formatAgentExecutionError
} from "../../../../../lib/agent-executor";
import { getProvisioningStore } from "../../../../../lib/provisioning-store";
import { AuthError, requireOwnerFromSession } from "../../../../../lib/wallet-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const confirmApprovalSchema = z.object({
  signature: z.string().min(32),
  paymentIntentPda: z.string().min(32)
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  try {
    const owner = await requireOwnerFromSession();
    const { approvalId } = await params;
    const body = confirmApprovalSchema.parse(await request.json());
    const result = await executeApprovedPayment(owner, approvalId, body, async (approval) => {
      const agent = await getProvisioningStore().getAgent(approval.agentId);

      if (!agent) {
        throw new AgentApprovalError("Hosted agent for this approval was not found.", 404);
      }

      return executeProvisionedAgentRecordPayment(agent, {
        programId: approval.programId,
        policyPda: approval.policyPda,
        recipient: approval.recipient,
        tokenMint: approval.tokenMint,
        amount: approval.amount,
        decimals: approval.decimals
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AgentExecutionError) {
      return NextResponse.json(formatAgentExecutionError(error), { status: error.status });
    }

    const status =
      error instanceof AuthError ||
      error instanceof AgentApprovalError
        ? error.status
        : 400;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to confirm approval." },
      { status }
    );
  }
}
