import { NextResponse } from "next/server";
import {
  AgentExecutionError,
  executeProvisionedAgentPayment,
  withAgentExecutionTimeout
} from "../../../../lib/agent-executor";
import { authorizeAgentRequest } from "../../../../lib/agent-request-auth";
import { appendAuditEvent } from "../../../../lib/audit-log";
import {
  createPaymentPayload,
  createSettlementResponse,
  encodeX402Header,
  paymentRequiredSchema
} from "../../../../lib/x402";
import { getAgentByApiKey } from "../../../../lib/agent-provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const apiKey = authorizeAgentRequest(request);
    const agent = await getAgentByApiKey(apiKey);
    const body = await request.json();
    const paymentRequired = paymentRequiredSchema.parse(body.paymentRequired);
    const requirement = paymentRequired.accepts[0];

    if (!agent) {
      throw new AgentExecutionError("Invalid agent API key.", 401);
    }

    if (!requirement) {
      throw new AgentExecutionError("x402 payment request did not include a supported payment requirement.", 400);
    }

    await appendAuditEvent({
      owner: agent.owner,
      agentId: agent.id,
      type: "x402_challenge",
      message: `x402 challenge accepted for ${requirement.amount} token.`,
      status: "info",
      metadata: requirement
    });

    const payment = await withAgentExecutionTimeout(
      executeProvisionedAgentPayment(apiKey, {
        recipient: requirement.payTo,
        tokenMint: requirement.asset,
        amount: requirement.amount,
        decimals: requirement.decimals
      })
    );
    const settlement = createSettlementResponse({
      success: true,
      transaction: payment.signature
    });
    const paymentPayload = createPaymentPayload({
      policyPda: payment.policyPda,
      agent: payment.agent,
      signature: payment.signature
    });

    await appendAuditEvent({
      owner: agent.owner,
      agentId: agent.id,
      type: "x402_settled",
      message: "x402 payment settled on Solana devnet.",
      status: "approved",
      signature: payment.signature,
      explorerUrl: payment.explorerUrl
    });

    return NextResponse.json(
      {
        settlement,
        paymentPayload,
        paymentSignature: encodeX402Header(paymentPayload)
      },
      {
        headers: {
          "PAYMENT-RESPONSE": encodeX402Header(settlement)
        }
      }
    );
  } catch (error) {
    const status = error instanceof AgentExecutionError ? error.status : 400;
    return NextResponse.json(
      {
        settlement: createSettlementResponse({
          success: false,
          error: error instanceof Error ? error.message : "x402 settlement failed."
        })
      },
      { status }
    );
  }
}
