import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { buildWalletChallengeMessage } from "../../../../../lib/wallet-auth";
import { getProvisioningStore } from "../../../../../lib/provisioning-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { owner } = (await request.json()) as { owner?: string };

    if (!owner) {
      throw new Error("Owner wallet is required.");
    }

    new PublicKey(owner);

    const challenge = buildWalletChallengeMessage(owner);
    await getProvisioningStore().saveChallenge(challenge);

    return NextResponse.json({
      owner: challenge.owner,
      message: challenge.message,
      expiresAt: challenge.expiresAt
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to create wallet challenge.";
}
