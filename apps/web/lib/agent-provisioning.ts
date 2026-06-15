import { Keypair } from "@solana/web3.js";
import { z } from "zod";
import {
  createAgentApiKey,
  createId,
  createPasswordSalt,
  createTelegramLinkCode,
  decryptText,
  encryptText,
  hashExportPassword,
  hashSecret,
  verifyExportPassword
} from "./provisioning-crypto";
import {
  getProvisioningStore,
  type ProvisionedAgentRecord
} from "./provisioning-store";
import { defaultAgentSpendProgramId } from "./solana-devnet";
import { appendAuditEvent } from "./audit-log";
import bs58 from "bs58";

const optionalPublicKeyString = z.union([z.string().trim().min(32), z.literal("")]);

export const createAgentSchema = z.object({
  name: z.string().trim().min(1).max(64),
  programId: z.string().min(32).default(defaultAgentSpendProgramId),
  policyPda: z.string().min(32).optional().nullable(),
  tokenMint: optionalPublicKeyString.optional().default(""),
  decimals: z.coerce.number().int().min(0).max(9).default(6)
});

export const updateAgentConfigSchema = z.object({
  programId: z.string().min(32).optional(),
  policyPda: z.string().min(32).nullable().optional(),
  tokenMint: optionalPublicKeyString.optional(),
  decimals: z.coerce.number().int().min(0).max(9).optional()
});

const exportPasswordSchema = z.object({
  password: z.string().min(8).max(128)
});

export type PublicProvisionedAgent = Omit<
  ProvisionedAgentRecord,
  "encryptedSecretKey" | "apiKeyHash" | "exportPasswordHash" | "exportPasswordSalt"
>;

export type PublicOwnerSecurity = {
  owner: string;
  exportPasswordSet: boolean;
};

export async function createProvisionedAgent(owner: string, input: unknown) {
  await requireOwnerExportPassword(owner);
  const body = createAgentSchema.parse(input);
  const now = new Date().toISOString();
  const agent = Keypair.generate();
  const apiKey = createAgentApiKey();
  const record: ProvisionedAgentRecord = {
    id: createId("agent"),
    owner,
    name: body.name,
    publicKey: agent.publicKey.toBase58(),
    encryptedSecretKey: encryptText(JSON.stringify([...agent.secretKey])),
    apiKeyHash: hashSecret(apiKey),
    apiKeyPrefix: apiKey.slice(0, 10),
    exportPasswordHash: null,
    exportPasswordSalt: null,
    programId: body.programId,
    policyPda: body.policyPda ?? null,
    tokenMint: body.tokenMint,
    decimals: body.decimals,
    telegramChatId: null,
    createdAt: now,
    updatedAt: now
  };

  await getProvisioningStore().saveAgent(record);
  await appendAuditEvent({
    owner,
    agentId: record.id,
    type: "agent_created",
    message: `Hosted AgentWallet created for ${record.publicKey}.`,
    status: "info",
    metadata: { publicKey: record.publicKey }
  });

  return {
    agent: toPublicAgent(record),
    apiKey
  };
}

export async function listProvisionedAgents(owner: string) {
  const agents = await getProvisioningStore().listOwnerAgents(owner);
  return agents.map(toPublicAgent);
}

export async function getOwnerSecurity(owner: string): Promise<PublicOwnerSecurity> {
  const security = await getProvisioningStore().getOwnerSecurity(owner);

  return {
    owner,
    exportPasswordSet: Boolean(security?.exportPasswordHash)
  };
}

export async function updateProvisionedAgentConfig(owner: string, agentId: string, input: unknown) {
  const current = await requireOwnedAgent(owner, agentId);
  const body = updateAgentConfigSchema.parse(input);
  const updated: ProvisionedAgentRecord = {
    ...current,
    ...body,
    updatedAt: new Date().toISOString()
  };

  await getProvisioningStore().saveAgent(updated);
  return toPublicAgent(updated);
}

export async function rotateProvisionedAgentApiKey(owner: string, agentId: string) {
  const current = await requireOwnedAgent(owner, agentId);
  const apiKey = createAgentApiKey();
  await getProvisioningStore().deleteApiKeyHash(current.apiKeyHash);

  const updated = {
    ...current,
    apiKeyHash: hashSecret(apiKey),
    apiKeyPrefix: apiKey.slice(0, 10),
    updatedAt: new Date().toISOString()
  };

  await getProvisioningStore().saveAgent(updated);
  await appendAuditEvent({
    owner,
    agentId,
    type: "api_key_rotated",
    message: "Agent API key rotated.",
    status: "info"
  });
  return {
    agent: toPublicAgent(updated),
    apiKey
  };
}

export async function createTelegramLink(owner: string, agentId: string) {
  await requireOwnedAgent(owner, agentId);
  const code = createTelegramLinkCode();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  await getProvisioningStore().saveTelegramLink({
    code,
    owner,
    agentId,
    expiresAt
  });

  return { code, expiresAt };
}

export async function unlinkTelegram(owner: string, agentId: string) {
  await requireOwnedAgent(owner, agentId);
  return toPublicAgent(await getProvisioningStore().unlinkTelegramChat(agentId));
}

export async function setOwnerExportPassword(owner: string, input: unknown) {
  const body = exportPasswordSchema.parse(input);
  const salt = createPasswordSalt();
  const now = new Date().toISOString();
  const current = await getProvisioningStore().getOwnerSecurity(owner);

  if (current?.exportPasswordHash) {
    throw new AgentProvisioningError("Owner recovery password is already set.", 409);
  }

  const updated = {
    owner,
    exportPasswordSalt: salt,
    exportPasswordHash: hashExportPassword(body.password, salt),
    createdAt: current?.createdAt ?? now,
    updatedAt: now
  };

  await getProvisioningStore().saveOwnerSecurity(updated);
  await appendAuditEvent({
    owner,
    agentId: null,
    type: "agent_export_password_updated",
    message: "Owner recovery password updated.",
    status: "info"
  });

  return getOwnerSecurity(owner);
}

export async function exportAgentSecretKey(owner: string, agentId: string, input: unknown) {
  const current = await requireOwnedAgent(owner, agentId);
  const body = exportPasswordSchema.parse(input);
  const security = await getProvisioningStore().getOwnerSecurity(owner);

  if (!security?.exportPasswordHash || !security.exportPasswordSalt) {
    throw new AgentProvisioningError("Set the owner recovery password before exporting hosted wallets.", 400);
  }

  if (!verifyExportPassword(body.password, security.exportPasswordSalt, security.exportPasswordHash)) {
    throw new AgentProvisioningError("Recovery password is incorrect.", 403);
  }

  const bytes = JSON.parse(decryptText(current.encryptedSecretKey)) as number[];
  await appendAuditEvent({
    owner,
    agentId,
    type: "agent_wallet_exported",
    message: "Agent wallet private key exported by owner.",
    status: "info"
  });

  return {
    publicKey: current.publicKey,
    secretKeyBase58: bs58.encode(Uint8Array.from(bytes)),
    secretKeyBytes: bytes
  };
}

export async function getAgentByApiKey(apiKey: string) {
  return getProvisioningStore().getAgentByApiKeyHash(hashSecret(apiKey));
}

export function decryptAgentKeypair(record: ProvisionedAgentRecord) {
  const bytes = JSON.parse(decryptText(record.encryptedSecretKey)) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

export function toPublicAgent(record: ProvisionedAgentRecord): PublicProvisionedAgent {
  const {
    encryptedSecretKey: _secret,
    apiKeyHash: _hash,
    exportPasswordHash: _legacyExportPasswordHash,
    exportPasswordSalt: _legacySalt,
    ...publicAgent
  } = record;
  return publicAgent;
}

async function requireOwnerExportPassword(owner: string) {
  const security = await getProvisioningStore().getOwnerSecurity(owner);

  if (!security?.exportPasswordHash || !security.exportPasswordSalt) {
    throw new AgentProvisioningError("Set the owner recovery password before creating hosted agent wallets.", 400);
  }
}

async function requireOwnedAgent(owner: string, agentId: string) {
  const agent = await getProvisioningStore().getAgent(agentId);

  if (!agent || agent.owner !== owner) {
    throw new AgentProvisioningError("Agent was not found for this owner.", 404);
  }

  return agent;
}

export class AgentProvisioningError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}
