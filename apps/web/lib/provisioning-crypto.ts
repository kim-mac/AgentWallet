import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getServerEnv } from "./server-wallet";

const encryptionAlgorithm = "aes-256-gcm";

export function createId(prefix: string) {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export function createAgentApiKey() {
  return `ags_${randomBytes(24).toString("base64url")}`;
}

export function createTelegramLinkCode() {
  return randomBytes(4).toString("base64url").replace(/[-_]/g, "").slice(0, 6).toUpperCase();
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function encryptText(plainText: string, secret = getEncryptionSecret()) {
  const key = deriveEncryptionKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(encryptionAlgorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptText(payload: string, secret = getEncryptionSecret()) {
  const [ivValue, tagValue, encryptedValue] = payload.split(".");

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Encrypted payload is invalid.");
  }

  const key = deriveEncryptionKey(secret);
  const decipher = createDecipheriv(encryptionAlgorithm, key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function signValue(value: string, secret = getSessionSecret()) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function isValidSignature(value: string, signature: string, secret = getSessionSecret()) {
  const expected = signValue(value, secret);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function deriveEncryptionKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function getEncryptionSecret() {
  const secret = getServerEnv("AGENTSPEND_ENCRYPTION_KEY");

  if (!secret) {
    throw new Error("AGENTSPEND_ENCRYPTION_KEY is not configured.");
  }

  return secret;
}

function getSessionSecret() {
  return (
    getServerEnv("AGENTSPEND_SESSION_SECRET") ??
    getServerEnv("AGENTSPEND_ENCRYPTION_KEY") ??
    "agentspend-dev-session-secret"
  );
}
