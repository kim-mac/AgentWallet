import { NextResponse } from "next/server";
import {
  buildSuiDeepBookEventRpcRequest,
  buildSuiTransactionBlockRpcRequest,
  parseSuiDeepBookOrders
} from "../../../../lib/sui-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const suiTestnetRpcUrl =
  process.env.SUI_TESTNET_RPC_URL?.trim() || "https://fullnode.testnet.sui.io:443";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    deepbookPackageId?: unknown;
    balanceManagerId?: unknown;
    poolId?: unknown;
    marketLabel?: unknown;
    transactionDigest?: unknown;
    executionHint?: unknown;
    sideHint?: unknown;
    balanceOwnerAddress?: unknown;
  };
  const deepbookPackageId =
    typeof body.deepbookPackageId === "string" ? body.deepbookPackageId.trim() : "";
  const balanceManagerId =
    typeof body.balanceManagerId === "string" ? body.balanceManagerId.trim() : "";
  const poolId = typeof body.poolId === "string" ? body.poolId.trim() : "";
  const marketLabel = typeof body.marketLabel === "string" ? body.marketLabel.trim() : "DeepBook";
  const transactionDigest =
    typeof body.transactionDigest === "string" ? body.transactionDigest.trim() : "";
  const executionHint =
    body.executionHint === "market" || body.executionHint === "limit" ? body.executionHint : undefined;
  const sideHint =
    body.sideHint === "buy" || body.sideHint === "sell" ? body.sideHint : undefined;
  const balanceOwnerAddress =
    typeof body.balanceOwnerAddress === "string" ? body.balanceOwnerAddress.trim() : "";

  if (!deepbookPackageId || !balanceManagerId || !poolId) {
    return NextResponse.json(
      { error: "DeepBook package, pool, and balance manager IDs are required." },
      { status: 400 }
    );
  }

  try {
    const requests = [
      buildSuiDeepBookEventRpcRequest(deepbookPackageId, "pool"),
      ...(transactionDigest ? [buildSuiTransactionBlockRpcRequest(transactionDigest)] : [])
    ];
    const responses = await Promise.all(
      requests.map(async (rpcRequest) => {
        const response = await fetch(suiTestnetRpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcRequest)
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) {
          throw new Error("Unable to query DeepBook events.");
        }
        if (payload.error) {
          throw new Error(payload.error.message ?? "Sui RPC returned a DeepBook event error.");
        }
        return payload;
      })
    );

    return NextResponse.json({
      orders: parseSuiDeepBookOrders(responses, {
        balanceManagerId,
        poolId,
        marketLabel,
        transactionDigest,
        executionHint,
        sideHint,
        balanceOwnerAddress
      })
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown DeepBook order error.";
    return NextResponse.json({ error: `Unable to fetch DeepBook orders: ${detail}` }, { status: 502 });
  }
}
