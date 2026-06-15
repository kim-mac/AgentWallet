import { NextResponse } from "next/server";
import { agentWalletOpenApiSpec } from "../../../lib/openapi";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(agentWalletOpenApiSpec);
}
