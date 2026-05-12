import { defaultDevnetUsdcMint } from "./solana-devnet";

export function normalizeTokenMint(tokenMint: string | undefined) {
  const trimmed = tokenMint?.trim();
  return trimmed || defaultDevnetUsdcMint;
}
