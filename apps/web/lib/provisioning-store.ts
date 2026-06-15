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
  exportPasswordHash?: string | null;
  exportPasswordSalt?: string | null;
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

export type OwnerSecurityRecord = {
  owner: string;
  exportPasswordHash: string | null;
  exportPasswordSalt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TelegramLinkRecord = {
  code: string;
  agentId: string;
  owner: string;
  expiresAt: string;
};

export type AuditEventRecord = {
  id: string;
  owner: string;
  agentId: string | null;
  type: string;
  message: string;
  status: "approved" | "rejected" | "info";
  signature?: string;
  explorerUrl?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ApprovalRecord = {
  id: string;
  owner: string;
  agentId: string;
  agentPublicKey: string;
  programId: string;
  policyPda: string;
  recipient: string;
  tokenMint: string;
  amount: string;
  decimals: number;
  reason: string;
  status: "pending" | "approved" | "executed" | "rejected" | "execution_failed";
  paymentIntentPda: string | null;
  approvalSignature: string | null;
  executionSignature: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ProvisioningStore = {
  saveChallenge(record: OwnerChallengeRecord): Promise<void>;
  getChallenge(owner: string): Promise<OwnerChallengeRecord | null>;
  deleteChallenge(owner: string): Promise<void>;
  saveOwnerSecurity(record: OwnerSecurityRecord): Promise<void>;
  getOwnerSecurity(owner: string): Promise<OwnerSecurityRecord | null>;
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
  saveApproval(record: ApprovalRecord): Promise<void>;
  getApproval(approvalId: string): Promise<ApprovalRecord | null>;
  listApprovals(owner: string, agentId?: string): Promise<ApprovalRecord[]>;
  appendAuditEvent(record: AuditEventRecord): Promise<void>;
  listAuditEvents(owner: string, agentId?: string): Promise<AuditEventRecord[]>;
};

type MemoryProvisioningState = {
  challenges: Map<string, OwnerChallengeRecord>;
  ownerSecurity: Map<string, OwnerSecurityRecord>;
  agents: Map<string, ProvisionedAgentRecord>;
  ownerAgents: Map<string, Set<string>>;
  apiKeys: Map<string, string>;
  telegramLinks: Map<string, TelegramLinkRecord>;
  telegramChats: Map<string, string>;
  approvals: Map<string, ApprovalRecord>;
  ownerApprovals: Map<string, string[]>;
  agentApprovals: Map<string, string[]>;
  auditEvents: Map<string, AuditEventRecord>;
  ownerAuditEvents: Map<string, string[]>;
  agentAuditEvents: Map<string, string[]>;
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
  memory.ownerSecurity.clear();
  memory.agents.clear();
  memory.ownerAgents.clear();
  memory.apiKeys.clear();
  memory.telegramLinks.clear();
  memory.telegramChats.clear();
  memory.approvals.clear();
  memory.ownerApprovals.clear();
  memory.agentApprovals.clear();
  memory.auditEvents.clear();
  memory.ownerAuditEvents.clear();
  memory.agentAuditEvents.clear();
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
  async saveOwnerSecurity(record) {
    memory.ownerSecurity.set(record.owner, record);
  },
  async getOwnerSecurity(owner) {
    return memory.ownerSecurity.get(owner) ?? null;
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
    const previousAgentId = memory.telegramChats.get(chatId);
    if (previousAgentId && previousAgentId !== agentId) {
      const previousAgent = memory.agents.get(previousAgentId);
      if (previousAgent) {
        memory.agents.set(previousAgentId, {
          ...previousAgent,
          telegramChatId: null,
          updatedAt: new Date().toISOString()
        });
      }
    }
    if (agent.telegramChatId && agent.telegramChatId !== chatId) {
      memory.telegramChats.delete(agent.telegramChatId);
    }
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
  },
  async saveApproval(record) {
    memory.approvals.set(record.id, record);
    memory.ownerApprovals.set(record.owner, prependUnique(memory.ownerApprovals.get(record.owner), record.id));
    memory.agentApprovals.set(record.agentId, prependUnique(memory.agentApprovals.get(record.agentId), record.id));
  },
  async getApproval(approvalId) {
    return memory.approvals.get(approvalId) ?? null;
  },
  async listApprovals(owner, agentId) {
    const approvalIds = agentId
      ? memory.agentApprovals.get(agentId) ?? []
      : memory.ownerApprovals.get(owner) ?? [];

    return approvalIds
      .map((approvalId) => memory.approvals.get(approvalId))
      .filter((approval): approval is ApprovalRecord => Boolean(approval && approval.owner === owner))
      .slice(0, 50);
  },
  async appendAuditEvent(record) {
    memory.auditEvents.set(record.id, record);
    memory.ownerAuditEvents.set(record.owner, [
      record.id,
      ...(memory.ownerAuditEvents.get(record.owner) ?? [])
    ]);
    if (record.agentId) {
      memory.agentAuditEvents.set(record.agentId, [
        record.id,
        ...(memory.agentAuditEvents.get(record.agentId) ?? [])
      ]);
    }
  },
  async listAuditEvents(owner, agentId) {
    const eventIds = agentId
      ? memory.agentAuditEvents.get(agentId) ?? []
      : memory.ownerAuditEvents.get(owner) ?? [];

    return eventIds
      .map((eventId) => memory.auditEvents.get(eventId))
      .filter((event): event is AuditEventRecord => Boolean(event && event.owner === owner))
      .slice(0, 50);
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
  async saveOwnerSecurity(record) {
    await getRedis().set(ownerSecurityKey(record.owner), record);
  },
  async getOwnerSecurity(owner) {
    return getRedis().get<OwnerSecurityRecord>(ownerSecurityKey(owner));
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
    const client = getRedis();
    const previousAgentId = await client.get<string>(telegramChatKey(chatId));
    if (previousAgentId && previousAgentId !== agentId) {
      const previousAgent = await this.getAgent(previousAgentId);
      if (previousAgent) {
        await client.set(agentKey(previousAgentId), {
          ...previousAgent,
          telegramChatId: null,
          updatedAt: new Date().toISOString()
        });
      }
    }
    if (agent.telegramChatId && agent.telegramChatId !== chatId) {
      await client.del(telegramChatKey(agent.telegramChatId));
    }
    const updated = { ...agent, telegramChatId: chatId, updatedAt: new Date().toISOString() };
    await this.saveAgent(updated);
    await client.set(telegramChatKey(chatId), agentId);
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
  },
  async saveApproval(record) {
    const client = getRedis();
    await client.set(approvalKey(record.id), record);
    await client.lrem(ownerApprovalsKey(record.owner), 0, record.id);
    await client.lpush(ownerApprovalsKey(record.owner), record.id);
    await client.ltrim(ownerApprovalsKey(record.owner), 0, 99);
    await client.lrem(agentApprovalsKey(record.agentId), 0, record.id);
    await client.lpush(agentApprovalsKey(record.agentId), record.id);
    await client.ltrim(agentApprovalsKey(record.agentId), 0, 99);
  },
  async getApproval(approvalId) {
    return getRedis().get<ApprovalRecord>(approvalKey(approvalId));
  },
  async listApprovals(owner, agentId) {
    const client = getRedis();
    const approvalIds = agentId
      ? await client.lrange<string>(agentApprovalsKey(agentId), 0, 49)
      : await client.lrange<string>(ownerApprovalsKey(owner), 0, 49);
    const approvals = await Promise.all(
      (approvalIds ?? []).map((approvalId) => client.get<ApprovalRecord>(approvalKey(approvalId)))
    );
    return approvals.filter((approval): approval is ApprovalRecord => Boolean(approval && approval.owner === owner));
  },
  async appendAuditEvent(record) {
    const client = getRedis();
    await client.set(auditEventKey(record.id), record);
    await client.lpush(ownerAuditKey(record.owner), record.id);
    await client.ltrim(ownerAuditKey(record.owner), 0, 99);
    if (record.agentId) {
      await client.lpush(agentAuditKey(record.agentId), record.id);
      await client.ltrim(agentAuditKey(record.agentId), 0, 99);
    }
  },
  async listAuditEvents(owner, agentId) {
    const client = getRedis();
    const eventIds = agentId
      ? await client.lrange<string>(agentAuditKey(agentId), 0, 49)
      : await client.lrange<string>(ownerAuditKey(owner), 0, 49);
    const events = await Promise.all((eventIds ?? []).map((eventId) => client.get<AuditEventRecord>(auditEventKey(eventId))));
    return events.filter((event): event is AuditEventRecord => Boolean(event && event.owner === owner));
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
    ownerSecurity: new Map<string, OwnerSecurityRecord>(),
    agents: new Map<string, ProvisionedAgentRecord>(),
    ownerAgents: new Map<string, Set<string>>(),
    apiKeys: new Map<string, string>(),
    telegramLinks: new Map<string, TelegramLinkRecord>(),
    telegramChats: new Map<string, string>(),
    approvals: new Map<string, ApprovalRecord>(),
    ownerApprovals: new Map<string, string[]>(),
    agentApprovals: new Map<string, string[]>(),
    auditEvents: new Map<string, AuditEventRecord>(),
    ownerAuditEvents: new Map<string, string[]>(),
    agentAuditEvents: new Map<string, string[]>()
  };

  return globalState.__agentspendProvisioningMemory;
}

function requireAgent(agent: ProvisionedAgentRecord | undefined | null, agentId: string) {
  if (!agent) {
    throw new Error(`Agent ${agentId} was not found.`);
  }
  return agent;
}

function prependUnique(current: string[] | undefined, value: string) {
  return [value, ...(current ?? []).filter((item) => item !== value)].slice(0, 100);
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

function ownerSecurityKey(owner: string) {
  return `agentwallet:owner:${owner}:security`;
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

function approvalKey(approvalId: string) {
  return `agentwallet:approval:${approvalId}`;
}

function ownerApprovalsKey(owner: string) {
  return `agentwallet:owner:${owner}:approvals`;
}

function agentApprovalsKey(agentId: string) {
  return `agentwallet:agent:${agentId}:approvals`;
}

function auditEventKey(eventId: string) {
  return `agentwallet:audit:${eventId}`;
}

function ownerAuditKey(owner: string) {
  return `agentwallet:owner:${owner}:audit`;
}

function agentAuditKey(agentId: string) {
  return `agentwallet:agent:${agentId}:audit`;
}
