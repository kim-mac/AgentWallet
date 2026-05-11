import { NextResponse } from "next/server";
import {
  decodeX402Header,
  paymentPayloadSchema
} from "../../../../lib/x402";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = typeof body.paymentSignature === "string"
      ? decodeX402Header(body.paymentSignature)
      : body.paymentPayload;

    return NextResponse.json({
      valid: paymentPayloadSchema.safeParse(payload).success
    });
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}
