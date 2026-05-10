import { NextResponse } from "next/server";
import { setOwnerSessionCookie, verifyWalletChallenge } from "../../../../../lib/wallet-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      owner?: string;
      message?: string;
      signature?: string | number[];
    };

    if (!body.owner || !body.message || !body.signature) {
      throw new Error("Owner, message, and signature are required.");
    }

    const session = await verifyWalletChallenge({
      owner: body.owner,
      message: body.message,
      signature: body.signature
    });
    await setOwnerSessionCookie(session);

    return NextResponse.json({ ok: true, owner: body.owner });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 401 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to verify wallet signature.";
}
