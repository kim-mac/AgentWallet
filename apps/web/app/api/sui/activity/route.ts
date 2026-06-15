import { NextResponse } from "next/server";
import {
  buildSuiEventRpcRequest,
  normalizeSuiDashboardConfig,
  parseSuiEventRpcResponse
} from "../../../../lib/sui-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const suiTestnetRpcUrl = "https://fullnode.testnet.sui.io:443";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const config = normalizeSuiDashboardConfig(body);

  if (!config.packageId) {
    return NextResponse.json({ error: "Sui package id is required." }, { status: 400 });
  }

  const rpcResponse = await fetch(suiTestnetRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildSuiEventRpcRequest(config))
  });

  const payload = await rpcResponse.json().catch(() => null);

  if (!rpcResponse.ok || !payload) {
    return NextResponse.json(
      { error: "Unable to fetch Sui testnet activity." },
      { status: 502 }
    );
  }

  if (payload.error) {
    return NextResponse.json(
      { error: payload.error.message ?? "Sui RPC returned an error." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    events: parseSuiEventRpcResponse(payload, config)
  });
}
