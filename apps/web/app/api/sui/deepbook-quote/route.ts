import { deepbook } from "@mysten/deepbook-v3";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { NextResponse } from "next/server";
import {
  evaluateSuiDeepBookQuote,
  findSuiDeepBookExecutableSuggestion,
  formatSuiDeepBookQuoteMessage,
  suiDeepBookQuoteMarkets
} from "../../../../lib/sui-deepbook-quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const suiTestnetFullnodeUrl =
  process.env.SUI_TESTNET_RPC_URL?.trim() || "https://fullnode.testnet.sui.io:443";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    agentAddress?: unknown;
    poolKey?: unknown;
    side?: unknown;
    amount?: unknown;
  };
  const agentAddress = typeof body.agentAddress === "string" ? body.agentAddress.trim() : "";
  const poolKey = typeof body.poolKey === "string" ? body.poolKey.trim() : "";
  const side = body.side === "buy" || body.side === "sell" ? body.side : null;
  const amountText = typeof body.amount === "string" ? body.amount.trim() : "";
  const market = suiDeepBookQuoteMarkets[poolKey as keyof typeof suiDeepBookQuoteMarkets];

  if (!/^0x[0-9a-f]{64}$/i.test(agentAddress) || !market || !side || !/^\d+$/.test(amountText)) {
    return NextResponse.json(
      { error: "Agent address, supported DeepBook pool, side, and atomic amount are required." },
      { status: 400 }
    );
  }

  const amount = BigInt(amountText);
  if (amount <= 0n) {
    return NextResponse.json({ error: "DeepBook quote amount must be greater than zero." }, { status: 400 });
  }

  try {
    const client = new SuiGrpcClient({
      network: "testnet",
      baseUrl: suiTestnetFullnodeUrl
    }).$extend(deepbook({ address: agentAddress }));
    const quoteAt = async (candidate: bigint) =>
      side === "buy"
        ? client.deepbook.getBaseQuantityOut(poolKey, candidate)
        : client.deepbook.getQuoteQuantityOut(poolKey, candidate);
    const quote = await quoteAt(amount);
    const inputAsset = side === "buy" ? market.quoteAsset : market.baseAsset;
    const outputAsset = side === "buy" ? market.baseAsset : market.quoteAsset;
    const expectedOutput = side === "buy" ? quote.baseOut : quote.quoteOut;
    const suggestion = expectedOutput > 0
      ? undefined
      : await findSuiDeepBookExecutableSuggestion({
          inputAmount: amount,
          inputDecimals: side === "buy" ? market.quoteDecimals : market.baseDecimals,
          inputAsset,
          quoteOutput: async (candidate) => {
            const candidateQuote = await quoteAt(candidate);
            return side === "buy" ? candidateQuote.baseOut : candidateQuote.quoteOut;
          }
        });
    const decision = evaluateSuiDeepBookQuote({
      side,
      inputAmount: amountText,
      inputAsset,
      outputAsset,
      quote,
      suggestion
    });

    return NextResponse.json({
      ...decision,
      message: formatSuiDeepBookQuoteMessage(decision)
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown DeepBook quote error.";
    return NextResponse.json({ error: `Unable to fetch a DeepBook quote: ${detail}` }, { status: 502 });
  }
}
