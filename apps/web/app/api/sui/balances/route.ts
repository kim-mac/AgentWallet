import { SuiGrpcClient } from "@mysten/sui/grpc";
import { NextResponse } from "next/server";
import { parseSuiGrpcBalanceResponse, suiType } from "../../../../lib/sui-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const suiTestnetGrpcUrl =
  process.env.SUI_TESTNET_GRPC_URL?.trim() || "https://fullnode.testnet.sui.io:443";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    owner?: unknown;
    agent?: unknown;
  };
  const owner = typeof body.owner === "string" ? body.owner.trim() : "";
  const agent = typeof body.agent === "string" ? body.agent.trim() : "";

  if (!owner || !agent) {
    return NextResponse.json({ error: "Owner and agent Sui addresses are required." }, { status: 400 });
  }

  const client = new SuiGrpcClient({
    network: "testnet",
    baseUrl: suiTestnetGrpcUrl
  });

  try {
    const [ownerResponse, agentResponse] = await Promise.all([
      client.getBalance({ owner, coinType: suiType }),
      client.getBalance({ owner: agent, coinType: suiType })
    ]);

    return NextResponse.json({
      ownerBalance: parseSuiGrpcBalanceResponse(ownerResponse),
      agentBalance: parseSuiGrpcBalanceResponse(agentResponse)
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown Sui balance error.";
    return NextResponse.json(
      { error: `Unable to fetch Sui testnet balances: ${detail}` },
      { status: 502 }
    );
  }
}
