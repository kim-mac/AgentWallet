export type SuiRawEventLike = {
  type?: string | null;
  parsedJson?: unknown;
};

export type SuiObjectChangeLike = {
  type?: string | null;
  objectId?: string | null;
  objectType?: string | null;
};

export type SuiTransactionActivityLike = {
  digest?: string;
  events?: unknown[] | null;
  objectChanges?: SuiObjectChangeLike[] | null;
};

export type SuiAgentWalletActivityEvent =
  | {
      kind: "policy_created";
      packageId: string;
      policyId: string;
      owner: string;
      agent: string;
      maxBudget: string;
      expiresAtMs: string;
    }
  | {
      kind: "vault_created";
      packageId: string;
      policyId: string;
      vaultId: string;
      tokenType: string;
    }
  | {
      kind: "budget_used";
      packageId: string;
      policyId: string;
      vaultId: string;
      owner: string;
      agent: string;
      poolId: string;
      amount: string;
      remainingBudget: string;
      action: string;
      actionCount: string;
      timestampMs: string;
    }
  | {
      kind: "vault_funded";
      packageId: string;
      policyId: string;
      vaultId: string;
      amount: string;
    }
  | {
      kind: "vault_returned";
      packageId: string;
      policyId: string;
      vaultId: string;
      amount: string;
    }
  | {
      kind: "policy_revoked";
      packageId: string;
      policyId: string;
      owner: string;
    };

export type SuiAgentWalletObjectIds = {
  policyIds: string[];
  vaultIds: string[];
};

export type SuiAgentWalletActivitySummary = {
  digest?: string;
  objectIds: SuiAgentWalletObjectIds;
  events: SuiAgentWalletActivityEvent[];
};

export function parseSuiAgentWalletEvents(events: unknown[] | null | undefined) {
  const parsed: SuiAgentWalletActivityEvent[] = [];

  for (const event of events ?? []) {
    const rawEvent = asRecord(event);
    if (!rawEvent) {
      continue;
    }

    const type = typeof rawEvent.type === "string" ? rawEvent.type : "";
    const typeParts = parseMoveEventType(type);

    if (!typeParts || typeParts.module !== "policy") {
      continue;
    }

    const json = asRecord(rawEvent.parsedJson);
    if (!json) {
      continue;
    }

    const normalized = normalizeAgentWalletEvent(typeParts.packageId, typeParts.name, json);
    if (normalized) {
      parsed.push(normalized);
    }
  }

  return parsed;
}

export function extractSuiAgentWalletObjectIds(
  transaction: Pick<SuiTransactionActivityLike, "objectChanges">
): SuiAgentWalletObjectIds {
  const policyIds: string[] = [];
  const vaultIds: string[] = [];

  for (const change of transaction.objectChanges ?? []) {
    if (change.type !== "created" || !change.objectId || !change.objectType) {
      continue;
    }

    if (change.objectType.includes("::policy::AgentPolicy")) {
      policyIds.push(change.objectId);
    }

    if (change.objectType.includes("::policy::AgentVault")) {
      vaultIds.push(change.objectId);
    }
  }

  return { policyIds, vaultIds };
}

export function summarizeSuiAgentWalletActivity(
  transaction: SuiTransactionActivityLike
): SuiAgentWalletActivitySummary {
  return {
    digest: transaction.digest,
    objectIds: extractSuiAgentWalletObjectIds(transaction),
    events: parseSuiAgentWalletEvents(transaction.events)
  };
}

function normalizeAgentWalletEvent(
  packageId: string,
  name: string,
  json: Record<string, unknown>
): SuiAgentWalletActivityEvent | null {
  if (name === "PolicyCreated") {
    return {
      kind: "policy_created",
      packageId,
      policyId: readString(json, "policy_id"),
      owner: readString(json, "owner"),
      agent: readString(json, "agent"),
      maxBudget: readString(json, "max_budget"),
      expiresAtMs: readString(json, "expires_at_ms")
    };
  }

  if (name === "AgentVaultCreated") {
    return {
      kind: "vault_created",
      packageId,
      policyId: readString(json, "policy_id"),
      vaultId: readString(json, "vault_id"),
      tokenType: readBytesAsText(json, "token_type")
    };
  }

  if (name === "AgentBudgetUsed") {
    return {
      kind: "budget_used",
      packageId,
      policyId: readString(json, "policy_id"),
      vaultId: readString(json, "vault_id"),
      owner: readString(json, "owner"),
      agent: readString(json, "agent"),
      poolId: readString(json, "pool_id"),
      amount: readString(json, "amount"),
      remainingBudget: readString(json, "remaining_budget"),
      action: readBytesAsText(json, "action"),
      actionCount: readString(json, "action_count"),
      timestampMs: readString(json, "timestamp_ms")
    };
  }

  if (name === "AgentVaultFunded") {
    return {
      kind: "vault_funded",
      packageId,
      policyId: readString(json, "policy_id"),
      vaultId: readString(json, "vault_id"),
      amount: readString(json, "amount")
    };
  }

  if (name === "AgentVaultReturned") {
    return {
      kind: "vault_returned",
      packageId,
      policyId: readString(json, "policy_id"),
      vaultId: readString(json, "vault_id"),
      amount: readString(json, "amount")
    };
  }

  if (name === "PolicyRevoked") {
    return {
      kind: "policy_revoked",
      packageId,
      policyId: readString(json, "policy_id"),
      owner: readString(json, "owner")
    };
  }

  return null;
}

function parseMoveEventType(type: string) {
  const parts = type.split("::");
  if (parts.length < 3) {
    return null;
  }

  return {
    packageId: parts[0]!,
    module: parts[1]!,
    name: parts[2]!
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(json: Record<string, unknown>, key: string) {
  const value = json[key];
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return value.toString();
  }

  return "";
}

function readBytesAsText(json: Record<string, unknown>, key: string) {
  const value = json[key];
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return new TextDecoder().decode(Uint8Array.from(value.map((byte) => Number(byte))));
  }

  return "";
}
