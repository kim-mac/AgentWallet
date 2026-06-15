import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

export type SuiLocalWalletRole = "owner" | "agent";

export type SuiLocalWallet = {
  role: SuiLocalWalletRole;
  address: string;
  privateKey: string;
  createdAt: string;
};

export type SuiLocalWalletBundle = {
  owner: SuiLocalWallet;
  agent: SuiLocalWallet;
  createdAt: string;
};

export type EncryptedSuiLocalWalletBundle = {
  version: 1;
  kdf: "PBKDF2-SHA256";
  cipher: "AES-GCM-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  ownerAddress: string;
  agentAddress: string;
  createdAt: string;
};

const encryptionIterations = 120_000;

export function generateSuiLocalWalletBundle(createdAtDate = new Date()): SuiLocalWalletBundle {
  const createdAt = createdAtDate.toISOString();
  const ownerKeypair = Ed25519Keypair.generate();
  const agentKeypair = Ed25519Keypair.generate();

  return {
    owner: {
      role: "owner",
      address: ownerKeypair.getPublicKey().toSuiAddress(),
      privateKey: ownerKeypair.getSecretKey(),
      createdAt
    },
    agent: {
      role: "agent",
      address: agentKeypair.getPublicKey().toSuiAddress(),
      privateKey: agentKeypair.getSecretKey(),
      createdAt
    },
    createdAt
  };
}

export async function encryptSuiLocalWalletBundle(
  bundle: SuiLocalWalletBundle,
  password: string
): Promise<EncryptedSuiLocalWalletBundle> {
  assertUsablePassword(password);
  const salt = getRandomBytes(16);
  const iv = getRandomBytes(12);
  const key = await deriveAesKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(bundle));
  const ciphertext = new Uint8Array(await getSubtleCrypto().encrypt({ name: "AES-GCM", iv }, key, plaintext));

  return {
    version: 1,
    kdf: "PBKDF2-SHA256",
    cipher: "AES-GCM-256",
    iterations: encryptionIterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    ownerAddress: bundle.owner.address,
    agentAddress: bundle.agent.address,
    createdAt: bundle.createdAt
  };
}

export async function decryptSuiLocalWalletBundle(
  encrypted: EncryptedSuiLocalWalletBundle,
  password: string
): Promise<SuiLocalWalletBundle> {
  assertUsablePassword(password);

  try {
    const salt = base64ToBytes(encrypted.salt);
    const iv = base64ToBytes(encrypted.iv);
    const ciphertext = base64ToBytes(encrypted.ciphertext);
    const key = await deriveAesKey(password, salt);
    const plaintext = await getSubtleCrypto().decrypt({ name: "AES-GCM", iv }, key, ciphertext);

    return JSON.parse(new TextDecoder().decode(plaintext)) as SuiLocalWalletBundle;
  } catch {
    throw new Error("Unable to unlock Sui wallets. Check the password and try again.");
  }
}

function assertUsablePassword(password: string) {
  if (password.trim().length < 8) {
    throw new Error("Use a Sui wallet password with at least 8 characters.");
  }
}

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await getSubtleCrypto().importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return getSubtleCrypto().deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: encryptionIterations,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function getRandomBytes(length: number) {
  const bytes = new Uint8Array(length);
  getCrypto().getRandomValues(bytes);
  return bytes;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto) {
    throw new Error("Web Crypto is not available in this browser.");
  }

  return globalThis.crypto;
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = getCrypto().subtle;

  if (!subtle) {
    throw new Error("Secure wallet encryption is not available in this browser.");
  }

  return subtle;
}

function bytesToBase64(bytes: Uint8Array) {
  if (typeof btoa === "function") {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(value: string) {
  if (typeof atob === "function") {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  }

  return Uint8Array.from(Buffer.from(value, "base64"));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
