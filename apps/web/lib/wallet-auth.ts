import { cookies } from "next/headers";
import { PublicKey } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { createId, isValidSignature, signValue } from "./provisioning-crypto";
import { getProvisioningStore } from "./provisioning-store";

export const ownerSessionCookie = "agentspend_owner";

export function buildWalletChallengeMessage(owner: string, nonce = createId("nonce")) {
  return {
    owner,
    nonce,
    message: [
      "Sign in to AgentSpend",
      "",
      `Owner: ${owner}`,
      `Nonce: ${nonce}`,
      "Cluster: devnet"
    ].join("\n"),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString()
  };
}

export async function verifyWalletChallenge({
  owner,
  message,
  signature
}: {
  owner: string;
  message: string;
  signature: string | number[];
}) {
  const challenge = await getProvisioningStore().getChallenge(owner);

  if (!challenge || challenge.message !== message) {
    throw new Error("Wallet challenge was not found or does not match.");
  }

  if (Date.now() > new Date(challenge.expiresAt).getTime()) {
    await getProvisioningStore().deleteChallenge(owner);
    throw new Error("Wallet challenge expired. Request a new challenge.");
  }

  const publicKey = new PublicKey(owner);
  const signatureBytes = Array.isArray(signature) ? Uint8Array.from(signature) : bs58.decode(signature);
  const isValid = ed25519.verify(
    signatureBytes,
    new TextEncoder().encode(message),
    publicKey.toBytes()
  );

  if (!isValid) {
    throw new Error("Wallet signature is invalid.");
  }

  await getProvisioningStore().deleteChallenge(owner);
  return createOwnerSession(owner);
}

export function createOwnerSession(owner: string) {
  const payload = Buffer.from(
    JSON.stringify({
      owner,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString()
    })
  ).toString("base64url");

  return `${payload}.${signValue(payload)}`;
}

export async function setOwnerSessionCookie(session: string) {
  const cookieStore = await cookies();
  cookieStore.set(ownerSessionCookie, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60
  });
}

export async function requireOwnerFromSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ownerSessionCookie)?.value;

  if (!session) {
    throw new AuthError("Connect and sign with the owner wallet first.", 401);
  }

  const [payload, signature] = session.split(".");

  if (!payload || !signature || !isValidSignature(payload, signature)) {
    throw new AuthError("Owner session is invalid. Sign in again.", 401);
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    owner?: string;
    expiresAt?: string;
  };

  if (!parsed.owner || !parsed.expiresAt || Date.now() > new Date(parsed.expiresAt).getTime()) {
    throw new AuthError("Owner session expired. Sign in again.", 401);
  }

  return parsed.owner;
}

export class AuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message);
  }
}
