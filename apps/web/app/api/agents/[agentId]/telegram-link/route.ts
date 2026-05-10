import { NextResponse } from "next/server";
import {
  AgentProvisioningError,
  createTelegramLink,
  unlinkTelegram
} from "../../../../../lib/agent-provisioning";
import { AuthError, requireOwnerFromSession } from "../../../../../lib/wallet-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const owner = await requireOwnerFromSession();
    const { agentId } = await params;
    return NextResponse.json(await createTelegramLink(owner, agentId));
  } catch (error) {
    return errorResponse(error, "Unable to create Telegram link.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const owner = await requireOwnerFromSession();
    const { agentId } = await params;
    return NextResponse.json({ agent: await unlinkTelegram(owner, agentId) });
  } catch (error) {
    return errorResponse(error, "Unable to unlink Telegram.");
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
