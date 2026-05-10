import { Keypair } from "@solana/web3.js";
import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import bs58 from "bs58";

export function loadKeypairFromEnv(name: string): Keypair {
  const value = getServerEnv(name);

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return Keypair.fromSecretKey(parseSecretKey(value, name));
}

export function getServerEnv(name: string): string | undefined {
  return process.env[name] ?? loadEnvFileValue(name);
}

export function parseSecretKey(value: string, label = "secret key"): Uint8Array {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} is empty.`);
  }

  if (!trimmed.startsWith("[") && !trimmed.includes(",")) {
    try {
      const decoded = bs58.decode(trimmed);
      if (decoded.length === 64) {
        return decoded;
      }
    } catch {
      // Fall through to the byte-list parser for a clearer validation error.
    }
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    parsed = trimmed.split(",").map((item) => Number(item.trim()));
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array or comma-separated byte list.`);
  }

  const bytes = parsed.map((item) => Number(item));
  const isValidByteArray = bytes.every((item) => Number.isInteger(item) && item >= 0 && item <= 255);

  if (!isValidByteArray || bytes.length !== 64) {
    throw new Error(`${label} must contain 64 byte values.`);
  }

  return Uint8Array.from(bytes);
}

function loadEnvFileValue(name: string): string | undefined {
  const candidates = [
    join(process.cwd(), ".env.local"),
    resolve(process.cwd(), "..", "..", ".env.local"),
    join(process.cwd(), "apps", "web", ".env.local")
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const value = readEnvValue(candidate, name);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function readEnvValue(path: string, name: string): string | undefined {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();

    if (key !== name) {
      continue;
    }

    return unquoteEnvValue(trimmed.slice(separatorIndex + 1).trim());
  }

  return undefined;
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
