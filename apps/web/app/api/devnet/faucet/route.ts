import { NextResponse } from "next/server";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import {
  createDevnetConnection,
  defaultDevnetUsdcMint,
  getExplorerTransactionUrl
} from "../../../../lib/solana-devnet";
import { loadKeypairFromEnv } from "../../../../lib/server-wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const faucetSchema = z.object({
  owner: z.string().min(32),
  tokenMint: z.string().optional(),
  amount: z.coerce.number().positive().max(1000).default(25),
  decimals: z.coerce.number().int().min(0).max(9).default(6)
});

export async function POST(request: Request) {
  try {
    const body = faucetSchema.parse(await request.json());
    const mintAuthority = loadKeypairFromEnv("AGENTSPEND_DEVNET_FAUCET_SECRET_KEY");
    const connection = createDevnetConnection();
    const owner = new PublicKey(body.owner);
    const mint = new PublicKey(body.tokenMint ?? defaultDevnetUsdcMint);
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      mintAuthority,
      mint,
      owner,
      true,
      "confirmed",
      undefined,
      TOKEN_PROGRAM_ID
    );
    const units = BigInt(Math.round(body.amount * 10 ** body.decimals));
    const signature = await mintTo(
      connection,
      mintAuthority,
      mint,
      tokenAccount.address,
      mintAuthority,
      units,
      [],
      undefined,
      TOKEN_PROGRAM_ID
    );

    return NextResponse.json({
      ok: true,
      cluster: "devnet",
      owner: owner.toBase58(),
      tokenMint: mint.toBase58(),
      tokenAccount: tokenAccount.address.toBase58(),
      amount: body.amount,
      signature,
      explorerUrl: getExplorerTransactionUrl(signature)
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error)
      },
      { status: 400 }
    );
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected devnet faucet error.";
}
