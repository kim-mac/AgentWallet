import { Keypair } from "@solana/web3.js";
import { z } from "zod";
import {
  createAgentApiKey,
  createId,
  createTelegramLinkCode,
  decryptText,
  encryptText,
  hashSecret
} from "./provisioning-crypto";
import {
  getProvisioningStore,
  type ProvisionedAgentRecord
} from "./provisioning-store";
import { defaultAgentSpendProgramId } from "./solana-devnet";
import { appendAuditEvent } from "./audit-log";

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

export type PublicProvisionedAgent = Omit<
  ProvisionedAgentRecord,
  "encryptedSecretKey" | "apiKeyHash"
>;

export async function createProvisionedAgent(owner: string, input: unknown) {
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

export async function getAgentByApiKey(apiKey: string) {
  return getProvisioningStore().getAgentByApiKeyHash(hashSecret(apiKey));
}

export function decryptAgentKeypair(record: ProvisionedAgentRecord) {
  const bytes = JSON.parse(decryptText(record.encryptedSecretKey)) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

export function toPublicAgent(record: ProvisionedAgentRecord): PublicProvisionedAgent {
  const { encryptedSecretKey: _secret, apiKeyHash: _hash, ...publicAgent } = record;
  return publicAgent;
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
