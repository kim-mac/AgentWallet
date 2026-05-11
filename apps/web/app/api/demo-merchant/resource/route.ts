import { NextResponse } from "next/server";
import {
  createPaymentRequired,
  createSettlementResponse,
  decodeX402Header,
  encodeX402Header,
  paymentPayloadSchema
} from "../../../../lib/x402";
import { defaultDevnetUsdcMint, getExplorerTransactionUrl } from "../../../../lib/solana-devnet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const merchantWallet = "ELCt5nsW3HNBesvuynh94VnmKZosrUcncuEP89XDJFDH";
const price = "1";

export async function GET(request: Request) {
  const paymentSignature = request.headers.get("PAYMENT-SIGNATURE");

  if (!paymentSignature) {
    const paymentRequired = createPaymentRequired({
      resource: request.url,
      recipient: merchantWallet,
      tokenMint: defaultDevnetUsdcMint,
      amount: price,
      decimals: 6,
      description: "AgentWallet paid API demo"
    });

    return new NextResponse(
      JSON.stringify({ error: "Payment required", paymentRequired }),
      {
        status: 402,
        headers: {
          "content-type": "application/json",
          "PAYMENT-REQUIRED": encodeX402Header(paymentRequired)
        }
      }
    );
  }

  const parsed = paymentPayloadSchema.safeParse(decodeX402Header(paymentSignature));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid PAYMENT-SIGNATURE." }, { status: 402 });
  }

  const settlement = createSettlementResponse({
    success: true,
    transaction: parsed.data.payload.transaction
  });

  return NextResponse.json(
    {
      ok: true,
      resource: "AgentWallet paid API demo response",
      merchantWallet,
      transaction: parsed.data.payload.transaction,
      explorerUrl: getExplorerTransactionUrl(parsed.data.payload.transaction)
    },
    {
      headers: {
        "PAYMENT-RESPONSE": encodeX402Header(settlement)
      }
    }
  );
}
