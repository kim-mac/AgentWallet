import { evaluatePayment } from "@agentspend/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { policy } from "../../../../lib/demo-data";

const paymentRequestSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  vendorId: z.string(),
  vendorName: z.string(),
  category: z.string(),
  recipient: z.string(),
  tokenMint: z.string(),
  amountUsd: z.number().positive(),
  requestedAt: z.string()
});

export async function POST(request: Request) {
  const body = await request.json();
  const payment = paymentRequestSchema.parse(body);
  const evaluation = evaluatePayment(policy, payment);

  return NextResponse.json({
    policyId: policy.id,
    paymentId: payment.id,
    ...evaluation
  });
}
