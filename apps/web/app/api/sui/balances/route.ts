import { SuiGrpcClient } from "@mysten/sui/grpc";
import { NextResponse } from "next/server";
import { deepbookDeepType, parseSuiGrpcBalanceResponse, parseSuiGrpcCoinBalanceResponse, suiType } from "../../../../lib/sui-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const suiTestnetGrpcUrl =
  process.env.SUI_TESTNET_GRPC_URL?.trim() || "https://fullnode.testnet.sui.io:443";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    owner?: unknown;
    agent?: unknown;
    deepType?: unknown;
  };
  const owner = typeof body.owner === "string" ? body.owner.trim() : "";
  const agent = typeof body.agent === "string" ? body.agent.trim() : "";
  const deepType = typeof body.deepType === "string" && body.deepType.trim() ? body.deepType.trim() : deepbookDeepType;

  if (!owner || !agent) {
    return NextResponse.json({ error: "Owner and agent Sui addresses are required." }, { status: 400 });
  }

  const client = new SuiGrpcClient({
    network: "testnet",
    baseUrl: suiTestnetGrpcUrl
  });

  try {
    const [ownerResponse, agentResponse, agentDeepResponse] = await Promise.all([
      client.getBalance({ owner, coinType: suiType }),
      client.getBalance({ owner: agent, coinType: suiType }),
      client.getBalance({ owner: agent, coinType: deepType })
    ]);

    return NextResponse.json({
      ownerBalance: parseSuiGrpcBalanceResponse(ownerResponse),
      agentBalance: parseSuiGrpcBalanceResponse(agentResponse),
      agentDeepBalance: parseSuiGrpcCoinBalanceResponse(agentDeepResponse)
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown Sui balance error.";
    return NextResponse.json(
      { error: `Unable to fetch Sui testnet balances: ${detail}` },
      { status: 502 }
    );
  }
}
