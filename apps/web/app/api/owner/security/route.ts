import { NextResponse } from "next/server";
import {
  AgentProvisioningError,
  getOwnerSecurity,
  setOwnerExportPassword
} from "../../../../lib/agent-provisioning";
import { AuthError, requireOwnerFromSession } from "../../../../lib/wallet-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const owner = await requireOwnerFromSession();
    return NextResponse.json({ security: await getOwnerSecurity(owner) });
  } catch (error) {
    return errorResponse(error, "Unable to load owner security settings.");
  }
}

export async function POST(request: Request) {
  try {
    const owner = await requireOwnerFromSession();
    return NextResponse.json({
      security: await setOwnerExportPassword(owner, await request.json())
    });
  } catch (error) {
    return errorResponse(error, "Unable to set owner recovery password.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  const status =
    error instanceof AuthError || error instanceof AgentProvisioningError ? error.status : 400;

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status }
  );
}
