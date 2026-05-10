import { Redis } from "@upstash/redis";
import { getServerEnv } from "./server-wallet";

export type ProvisionedAgentRecord = {
  id: string;
  owner: string;
  name: string;
  publicKey: string;
  encryptedSecretKey: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
  programId: string;
  policyPda: string | null;
  tokenMint: string;
  decimals: number;
  createdAt: string;
  updatedAt: string;
  telegramChatId: string | null;
};

export type OwnerChallengeRecord = {
  owner: string;
  nonce: string;
  message: string;
  expiresAt: string;
};

export type TelegramLinkRecord = {
  code: string;
  agentId: string;
  owner: string;
  expiresAt: string;
};

export type ProvisioningStore = {
  saveChallenge(record: OwnerChallengeRecord): Promise<void>;
  getChallenge(owner: string): Promise<OwnerChallengeRecord | null>;
  deleteChallenge(owner: string): Promise<void>;
  saveAgent(record: ProvisionedAgentRecord): Promise<void>;
  getAgent(agentId: string): Promise<ProvisionedAgentRecord | null>;
  listOwnerAgents(owner: string): Promise<ProvisionedAgentRecord[]>;
  getAgentByApiKeyHash(apiKeyHash: string): Promise<ProvisionedAgentRecord | null>;
  deleteApiKeyHash(apiKeyHash: string): Promise<void>;
  saveTelegramLink(record: TelegramLinkRecord): Promise<void>;
  consumeTelegramLink(code: string): Promise<TelegramLinkRecord | null>;
  getAgentByTelegramChat(chatId: string): Promise<ProvisionedAgentRecord | null>;
  linkTelegramChat(agentId: string, chatId: string): Promise<ProvisionedAgentRecord>;
  unlinkTelegramChat(agentId: string): Promise<ProvisionedAgentRecord>;
};

type MemoryProvisioningState = {
  challenges: Map<string, OwnerChallengeRecord>;
  agents: Map<string, ProvisionedAgentRecord>;
  ownerAgents: Map<string, Set<string>>;
  apiKeys: Map<string, string>;
  telegramLinks: Map<string, TelegramLinkRecord>;
  telegramChats: Map<string, string>;
};

const memory = getMemoryState();

let redis: Redis | null = null;

export function getProvisioningStore(): ProvisioningStore {
  if (getServerEnv("AGENTSPEND_STORAGE_DRIVER") === "memory" || process.env.NODE_ENV === "test") {
    return memoryStore;
  }

  return redisStore;
}

export function resetMemoryProvisioningStore() {
  memory.challenges.clear();
  memory.agents.clear();
  memory.ownerAgents.clear();
  memory.apiKeys.clear();
  memory.telegramLinks.clear();
  memory.telegramChats.clear();
}

const memoryStore: ProvisioningStore = {
  async saveChallenge(record) {
    memory.challenges.set(record.owner, record);
  },
  async getChallenge(owner) {
    return memory.challenges.get(owner) ?? null;
  },
  async deleteChallenge(owner) {
    memory.challenges.delete(owner);
  },
  async saveAgent(record) {
    memory.agents.set(record.id, record);
    const agentIds = memory.ownerAgents.get(record.owner) ?? new Set<string>();
    agentIds.add(record.id);
    memory.ownerAgents.set(record.owner, agentIds);
    memory.apiKeys.set(record.apiKeyHash, record.id);
    if (record.telegramChatId) {
      memory.telegramChats.set(record.telegramChatId, record.id);
    }
  },
  async getAgent(agentId) {
    return memory.agents.get(agentId) ?? null;
  },
  async listOwnerAgents(owner) {
    return [...(memory.ownerAgents.get(owner) ?? new Set<string>())]
      .map((agentId) => memory.agents.get(agentId))
      .filter((agent): agent is ProvisionedAgentRecord => Boolean(agent));
  },
  async getAgentByApiKeyHash(apiKeyHash) {
    const agentId = memory.apiKeys.get(apiKeyHash);
    return agentId ? memory.agents.get(agentId) ?? null : null;
  },
  async deleteApiKeyHash(apiKeyHash) {
    memory.apiKeys.delete(apiKeyHash);
  },
  async saveTelegramLink(record) {
    memory.telegramLinks.set(record.code, record);
  },
  async consumeTelegramLink(code) {
    const record = memory.telegramLinks.get(code.toUpperCase()) ?? null;
    memory.telegramLinks.delete(code.toUpperCase());
    return record;
  },
  async getAgentByTelegramChat(chatId) {
    const agentId = memory.telegramChats.get(chatId);
    return agentId ? memory.agents.get(agentId) ?? null : null;
  },
  async linkTelegramChat(agentId, chatId) {
    const agent = requireAgent(memory.agents.get(agentId), agentId);
    const updated = { ...agent, telegramChatId: chatId, updatedAt: new Date().toISOString() };
    memory.agents.set(agentId, updated);
    memory.telegramChats.set(chatId, agentId);
    return updated;
  },
  async unlinkTelegramChat(agentId) {
    const agent = requireAgent(memory.agents.get(agentId), agentId);
    if (agent.telegramChatId) {
      memory.telegramChats.delete(agent.telegramChatId);
    }
    const updated = { ...agent, telegramChatId: null, updatedAt: new Date().toISOString() };
    memory.agents.set(agentId, updated);
    return updated;
  }
};

const redisStore: ProvisioningStore = {
  async saveChallenge(record) {
    await getRedis().set(challengeKey(record.owner), record, { ex: secondsUntil(record.expiresAt) });
  },
  async getChallenge(owner) {
    return getRedis().get<OwnerChallengeRecord>(challengeKey(owner));
  },
  async deleteChallenge(owner) {
    await getRedis().del(challengeKey(owner));
  },
  async saveAgent(record) {
    const client = getRedis();
    await client.set(agentKey(record.id), record);
    await client.sadd(ownerAgentsKey(record.owner), record.id);
    await client.set(apiKey(record.apiKeyHash), record.id);
    if (record.telegramChatId) {
      await client.set(telegramChatKey(record.telegramChatId), record.id);
    }
  },
  async getAgent(agentId) {
    return getRedis().get<ProvisionedAgentRecord>(agentKey(agentId));
  },
  async listOwnerAgents(owner) {
    const agentIds = await getRedis().smembers<string[]>(ownerAgentsKey(owner));
    const agents = await Promise.all((agentIds ?? []).map((agentId) => this.getAgent(agentId)));
    return agents.filter((agent): agent is ProvisionedAgentRecord => Boolean(agent));
  },
  async getAgentByApiKeyHash(apiKeyHash) {
    const agentId = await getRedis().get<string>(apiKey(apiKeyHash));
    return agentId ? this.getAgent(agentId) : null;
  },
  async deleteApiKeyHash(apiKeyHash) {
    await getRedis().del(apiKey(apiKeyHash));
  },
  async saveTelegramLink(record) {
    await getRedis().set(telegramLinkKey(record.code), record, { ex: secondsUntil(record.expiresAt) });
  },
  async consumeTelegramLink(code) {
    const key = telegramLinkKey(code);
    const record = await getRedis().get<TelegramLinkRecord>(key);
    await getRedis().del(key);
    return record;
  },
  async getAgentByTelegramChat(chatId) {
    const agentId = await getRedis().get<string>(telegramChatKey(chatId));
    return agentId ? this.getAgent(agentId) : null;
  },
  async linkTelegramChat(agentId, chatId) {
    const agent = requireAgent(await this.getAgent(agentId), agentId);
    const updated = { ...agent, telegramChatId: chatId, updatedAt: new Date().toISOString() };
    await this.saveAgent(updated);
    await getRedis().set(telegramChatKey(chatId), agentId);
    return updated;
  },
  async unlinkTelegramChat(agentId) {
    const agent = requireAgent(await this.getAgent(agentId), agentId);
    if (agent.telegramChatId) {
      await getRedis().del(telegramChatKey(agent.telegramChatId));
    }
    const updated = { ...agent, telegramChatId: null, updatedAt: new Date().toISOString() };
    await this.saveAgent(updated);
    return updated;
  }
};

function getRedis() {
  if (redis) {
    return redis;
  }

  const url = getServerEnv("UPSTASH_REDIS_REST_URL") ?? getServerEnv("KV_REST_API_URL");
  const token = getServerEnv("UPSTASH_REDIS_REST_TOKEN") ?? getServerEnv("KV_REST_API_TOKEN");

  if (!url || !token) {
    throw new Error(
      "Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from Vercel Marketplace Redis."
    );
  }

  redis = new Redis({ url, token });
  return redis;
}

function getMemoryState(): MemoryProvisioningState {
  const globalState = globalThis as typeof globalThis & {
    __agentspendProvisioningMemory?: MemoryProvisioningState;
  };

  globalState.__agentspendProvisioningMemory ??= {
    challenges: new Map<string, OwnerChallengeRecord>(),
    agents: new Map<string, ProvisionedAgentRecord>(),
    ownerAgents: new Map<string, Set<string>>(),
    apiKeys: new Map<string, string>(),
    telegramLinks: new Map<string, TelegramLinkRecord>(),
    telegramChats: new Map<string, string>()
  };

  return globalState.__agentspendProvisioningMemory;
}

function requireAgent(agent: ProvisionedAgentRecord | undefined | null, agentId: string) {
  if (!agent) {
    throw new Error(`Agent ${agentId} was not found.`);
  }
  return agent;
}

function secondsUntil(isoDate: string) {
  return Math.max(1, Math.floor((new Date(isoDate).getTime() - Date.now()) / 1000));
}

function challengeKey(owner: string) {
  return `agentspend:challenge:${owner}`;
}

function agentKey(agentId: string) {
  return `agentspend:agent:${agentId}`;
}

function ownerAgentsKey(owner: string) {
  return `agentspend:owner:${owner}:agents`;
}

function apiKey(apiKeyHash: string) {
  return `agentspend:api:${apiKeyHash}`;
}

function telegramLinkKey(code: string) {
  return `agentspend:telegram-link:${code.toUpperCase()}`;
}

function telegramChatKey(chatId: string) {
  return `agentspend:telegram-chat:${chatId}`;
}
