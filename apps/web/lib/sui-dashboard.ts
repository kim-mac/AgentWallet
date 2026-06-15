export type SuiDashboardCommand = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  command: string;
};

export type SuiOverflowProofItem = {
  title: string;
  detail: string;
};

export type SuiDashboardConfig = {
  packageId: string;
  policyId: string;
  vaultId: string;
  agentAddress: string;
  allowedPoolId: string;
  balanceManagerId: string;
  deepbookPackageId: string;
  lastDeepBookTransactionDigest: string;
  coinType: string;
  tokenTypeLabel: string;
  deepbookBaseType: string;
  deepbookQuoteType: string;
  budgetMist: string;
  expiresAtMs: string;
  spendAmount: string;
  orderQuantity: string;
  limitPrice: string;
};

export type SuiDeepBookMarket = {
  id: string;
  label: string;
  network: "testnet";
  description: string;
  deepbookPackageId: string;
  poolId: string;
  coinType: string;
  tokenTypeLabel: string;
  baseAssetType: string;
  quoteAssetType: string;
  defaultSpendAmount: string;
  defaultOrderQuantity: string;
  defaultLimitPrice: string;
};

export type SuiActivityEvent = {
  id: string;
  digest: string;
  sequence: string;
  type: string;
  timestampMs: string | null;
  summary: string;
  parsedJson: Record<string, unknown>;
};

export type SuiDeepBookOrder = {
  orderId: string;
  market: string;
  side: "buy" | "sell";
  status: "open" | "filled" | "cancelled" | "expired" | "fill observed";
  price: string;
  quantity: string;
  digest: string;
  timestampMs: string | null;
};

export type SuiEventRpcRequest = {
  jsonrpc: "2.0";
  id: 1;
  method: "suix_queryEvents";
  params: [{ MoveModule: { package: string; module: "policy" } }, string | null, number, boolean];
};

export type SuiLaunchStage = "password" | "wallets" | "fund" | "unlock" | "mandate" | "launch" | "console";
export const suiLaunchStages: SuiLaunchStage[] = [
  "password",
  "wallets",
  "fund",
  "unlock",
  "mandate",
  "launch",
  "console"
];

const suiCli = ".\\.tools\\sui-testnet-v1.73.0-windows-x86_64\\sui.exe";
export const agentWalletSuiPackageId =
  "0x768743700b22d533d228719672e17009a48a4dac473ae7f1d1d2733f6c1defa9";
export const deepbookDeepType =
  "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP";
export const suiType = "0x2::sui::SUI";
export const suiGasReserveMist = 50_000_000n;
export const suiDeepBookMarkets: SuiDeepBookMarket[] = [
  {
    id: "deep-sui-testnet",
    label: "DEEP / SUI",
    network: "testnet",
    description: "Verified DeepBook V3 testnet market used by the autonomous strategy demo.",
    deepbookPackageId: "0xbc331f09e5c737d45f074ad2d17c3038421b3b9018699e370d88d94938c53d28",
    poolId: "0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f",
    coinType: suiType,
    tokenTypeLabel: "SUI",
    baseAssetType: deepbookDeepType,
    quoteAssetType: suiType,
    defaultSpendAmount: "100000000",
    defaultOrderQuantity: "10000000",
    defaultLimitPrice: "10000000000"
  }
];
const defaultSuiDashboardConfig: SuiDashboardConfig = {
  packageId: agentWalletSuiPackageId,
  policyId: "",
  vaultId: "",
  agentAddress: "",
  allowedPoolId: "",
  balanceManagerId: "",
  deepbookPackageId: "",
  lastDeepBookTransactionDigest: "",
  coinType: suiType,
  tokenTypeLabel: "SUI",
  deepbookBaseType: deepbookDeepType,
  deepbookQuoteType: suiType,
  budgetMist: "500000000",
  expiresAtMs: "1770000000000",
  spendAmount: "1000000",
  orderQuantity: "1000000",
  limitPrice: "1000000000"
};

export function buildSuiBalanceRpcRequest(owner: string) {
  return {
    jsonrpc: "2.0" as const,
    id: 1 as const,
    method: "suix_getBalance" as const,
    params: [owner.trim(), suiType] as [string, string]
  };
}

export function parseSuiBalanceRpcResponse(response: unknown) {
  if (!response || typeof response !== "object") {
    return "0";
  }

  const result = (response as { result?: unknown }).result;
  if (!result || typeof result !== "object") {
    return "0";
  }

  const totalBalance = (result as { totalBalance?: unknown }).totalBalance;
  return typeof totalBalance === "string" ? totalBalance : "0";
}

export function parseSuiGrpcBalanceResponse(response: unknown) {
  if (!response || typeof response !== "object") {
    return "0";
  }

  const balance = (response as { balance?: unknown }).balance;
  if (!balance || typeof balance !== "object") {
    return "0";
  }

  const value = (balance as { balance?: unknown }).balance;
  return typeof value === "string" ? value : "0";
}

export function getSuiLaunchStage(input: {
  hasPassword: boolean;
  hasWallets: boolean;
  walletsFunded: boolean;
  unlocked: boolean;
  mandateApplied: boolean;
  launched: boolean;
}): SuiLaunchStage {
  if (!input.hasPassword) return "password";
  if (!input.hasWallets) return "wallets";
  if (!input.walletsFunded) return "fund";
  if (!input.unlocked) return "unlock";
  if (!input.mandateApplied) return "mandate";
  if (!input.launched) return "launch";
  return "console";
}

export function canReviewSuiLaunchStage(current: SuiLaunchStage, target: SuiLaunchStage) {
  return suiLaunchStages.indexOf(target) <= suiLaunchStages.indexOf(current);
}

export function getSuiFundingReadiness(input: {
  ownerBalance: string;
  agentBalance: string;
  budgetMist: string;
  coinType: string;
}) {
  const ownerBalance = toSafeBigInt(input.ownerBalance);
  const agentBalance = toSafeBigInt(input.agentBalance);
  const budget = toSafeBigInt(input.budgetMist);
  const requiredOwnerBalance =
    input.coinType.trim() === suiType ? budget + suiGasReserveMist : suiGasReserveMist;
  const requiredAgentBalance = suiGasReserveMist;

  return {
    ready: ownerBalance >= requiredOwnerBalance && agentBalance >= requiredAgentBalance,
    ownerReady: ownerBalance >= requiredOwnerBalance,
    agentReady: agentBalance >= requiredAgentBalance,
    requiredOwnerBalance: requiredOwnerBalance.toString(),
    requiredAgentBalance: requiredAgentBalance.toString()
  };
}

export function getSuiGasReadiness(input: {
  ownerBalance: string;
  agentBalance: string;
}) {
  const ownerBalance = toSafeBigInt(input.ownerBalance);
  const agentBalance = toSafeBigInt(input.agentBalance);
  const requiredBalance = suiGasReserveMist;

  return {
    ready: ownerBalance >= requiredBalance && agentBalance >= requiredBalance,
    ownerReady: ownerBalance >= requiredBalance,
    agentReady: agentBalance >= requiredBalance,
    requiredOwnerBalance: requiredBalance.toString(),
    requiredAgentBalance: requiredBalance.toString()
  };
}

export const suiActivityEventLabels = [
  "PolicyCreated",
  "AgentVaultCreated",
  "AgentBudgetUsed",
  "AgentVaultFunded",
  "AgentVaultReturned",
  "PolicyRevoked"
];

export const suiOverflowProofItems: SuiOverflowProofItem[] = [
  {
    title: "Real DeepBook orders",
    detail: "The agent plan routes through DeepBook after the Move policy releases a capped coin from the vault."
  },
  {
    title: "Self-enforced budget ceiling",
    detail: "Budget, expiry, and allowed pool scope are checked by the Sui Move policy object before spendable funds leave the vault."
  },
  {
    title: "On-chain activity log",
    detail: "Policy, vault, spend, return, and revoke events are emitted on-chain and normalized by the SDK event parser."
  },
  {
    title: "Owner revocation",
    detail: "The owner can revoke the policy object, stopping future agent spends without needing to edit agent code."
  }
];

export function normalizeSuiDashboardConfig(
  value: Partial<SuiDashboardConfig> | null | undefined
): SuiDashboardConfig {
  const source = value ?? {};

  return {
    packageId: trimValue(source.packageId) || defaultSuiDashboardConfig.packageId,
    policyId: trimValue(source.policyId),
    vaultId: trimValue(source.vaultId),
    agentAddress: trimValue(source.agentAddress),
    allowedPoolId: trimValue(source.allowedPoolId),
    balanceManagerId: trimValue(source.balanceManagerId),
    deepbookPackageId: trimValue(source.deepbookPackageId),
    lastDeepBookTransactionDigest: trimValue(source.lastDeepBookTransactionDigest),
    coinType: trimValue(source.coinType) || defaultSuiDashboardConfig.coinType,
    tokenTypeLabel: trimValue(source.tokenTypeLabel) || defaultSuiDashboardConfig.tokenTypeLabel,
    deepbookBaseType: trimValue(source.deepbookBaseType) || defaultSuiDashboardConfig.deepbookBaseType,
    deepbookQuoteType: trimValue(source.deepbookQuoteType) || defaultSuiDashboardConfig.deepbookQuoteType,
    budgetMist: trimValue(source.budgetMist) || defaultSuiDashboardConfig.budgetMist,
    expiresAtMs: trimValue(source.expiresAtMs) || defaultSuiDashboardConfig.expiresAtMs,
    spendAmount: trimValue(source.spendAmount) || defaultSuiDashboardConfig.spendAmount,
    orderQuantity: trimValue(source.orderQuantity) || defaultSuiDashboardConfig.orderQuantity,
    limitPrice: trimValue(source.limitPrice) || defaultSuiDashboardConfig.limitPrice
  };
}

export function applySuiDeepBookMarket(
  configValue: Partial<SuiDashboardConfig> | null | undefined,
  marketId: string
): SuiDashboardConfig {
  const config = normalizeSuiDashboardConfig(configValue);
  const market = suiDeepBookMarkets.find((candidate) => candidate.id === marketId);

  if (!market) {
    return config;
  }

  return {
    ...config,
    allowedPoolId: market.poolId,
    deepbookPackageId: market.deepbookPackageId,
    coinType: market.coinType,
    tokenTypeLabel: market.tokenTypeLabel,
    deepbookBaseType: market.baseAssetType,
    deepbookQuoteType: market.quoteAssetType,
    spendAmount: market.defaultSpendAmount,
    orderQuantity: market.defaultOrderQuantity,
    limitPrice: market.defaultLimitPrice
  };
}

export function findSuiDeepBookMarketId(configValue: Partial<SuiDashboardConfig> | null | undefined) {
  const config = normalizeSuiDashboardConfig(configValue);
  const market = suiDeepBookMarkets.find(
    (candidate) =>
      config.allowedPoolId === candidate.poolId &&
      config.deepbookPackageId === candidate.deepbookPackageId &&
      config.coinType === candidate.coinType &&
      config.deepbookBaseType === candidate.baseAssetType &&
      config.deepbookQuoteType === candidate.quoteAssetType
  );

  return market?.id ?? "custom";
}

export function buildSuiDashboardCommands(
  configValue?: Partial<SuiDashboardConfig> | null
): SuiDashboardCommand[] {
  const config = normalizeSuiDashboardConfig(configValue);
  const packageId = commandValue(config.packageId, "0xpackage");
  const policyId = commandValue(config.policyId, "0xpolicy");
  const vaultId = commandValue(config.vaultId, "0xvault");
  const agentAddress = commandValue(config.agentAddress, "0xagent");
  const allowedPoolId = commandValue(config.allowedPoolId, "0xdeepbook-pool");
  const balanceManagerId = commandValue(config.balanceManagerId, "0xbalance-manager");
  const deepbookPackageId = commandValue(config.deepbookPackageId, "0xdeepbook-package");

  return [
    {
      id: "publish-package",
      title: "Publish Sui policy package",
      eyebrow: "Step 1",
      description: "Deploy the AgentWallet Move package to Sui testnet and copy the package id from the publish output.",
      command: `${suiCli} client publish sui/agent_wallet --gas-budget 300000000`
    },
    {
      id: "create-policy",
      title: "Create owner policy",
      eyebrow: "Step 2",
      description: "Create the policy object with a capped budget, allowed DeepBook pool, expiry, and owner-controlled revocation.",
      command: [
        '$env:SUI_OWNER_PRIVATE_KEY="sui-private-key"',
        `$env:SUI_PACKAGE_ID="${packageId}"`,
        `$env:SUI_AGENT_ADDRESS="${agentAddress}"`,
        `$env:SUI_ALLOWED_POOL_ID="${allowedPoolId}"`,
        `$env:SUI_MAX_BUDGET="${config.budgetMist}"`,
        `$env:SUI_EXPIRES_AT_MS="${config.expiresAtMs}"`,
        "npm run sui:owner -w @agentwallet/sdk -- create-policy"
      ].join("\n")
    },
    {
      id: "create-vault",
      title: "Create agent vault",
      eyebrow: "Step 3",
      description: "Bind the hosted agent address to a vault that can only release funds through the policy object.",
      command: [
        '$env:SUI_OWNER_PRIVATE_KEY="sui-private-key"',
        `$env:SUI_PACKAGE_ID="${packageId}"`,
        `$env:SUI_POLICY_ID="${policyId}"`,
        `$env:SUI_COIN_TYPE="${config.coinType}"`,
        `$env:SUI_TOKEN_TYPE_LABEL="${config.tokenTypeLabel}"`,
        "npm run sui:owner -w @agentwallet/sdk -- create-vault"
      ].join("\n")
    },
    {
      id: "fund-vault",
      title: "Fund agent vault",
      eyebrow: "Step 4",
      description: "Deposit SUI into the policy vault. The agent can only spend this balance through the Move policy.",
      command: [
        '$env:SUI_OWNER_PRIVATE_KEY="sui-private-key"',
        `$env:SUI_PACKAGE_ID="${packageId}"`,
        `$env:SUI_VAULT_ID="${vaultId}"`,
        `$env:SUI_COIN_TYPE="${config.coinType}"`,
        `$env:SUI_DEPOSIT_AMOUNT="${config.budgetMist}"`,
        "npm run sui:owner -w @agentwallet/sdk -- fund-vault"
      ].join("\n")
    },
    {
      id: "create-balance-manager",
      title: "Create DeepBook balance manager",
      eyebrow: "Step 5",
      description: "Create the DeepBook custody object required for non-swap order placement.",
      command: [
        '$env:SUI_OWNER_PRIVATE_KEY="sui-private-key"',
        `$env:SUI_DEEPBOOK_PACKAGE_ID="${deepbookPackageId}"`,
        "npm run sui:deepbook -w @agentwallet/sdk -- create-balance-manager"
      ].join("\n")
    },
    {
      id: "deepbook-order",
      title: "Run DeepBook strategy",
      eyebrow: "Step 6",
      description: "Have the agent execute a budgeted DeepBook limit order plan using the Sui policy and vault objects.",
      command: [
        '$env:SUI_AGENT_PRIVATE_KEY="sui-private-key"',
        `$env:SUI_PACKAGE_ID="${packageId}"`,
        `$env:SUI_POLICY_ID="${policyId}"`,
        `$env:SUI_VAULT_ID="${vaultId}"`,
        `$env:SUI_COIN_TYPE="${config.coinType}"`,
        `$env:SUI_DEEPBOOK_POOL_ID="${allowedPoolId}"`,
        `$env:SUI_DEEPBOOK_BASE_TYPE="${config.deepbookBaseType}"`,
        `$env:SUI_DEEPBOOK_QUOTE_TYPE="${config.deepbookQuoteType}"`,
        `$env:SUI_BALANCE_MANAGER_ID="${balanceManagerId}"`,
        `$env:SUI_DEEPBOOK_PACKAGE_ID="${deepbookPackageId}"`,
        `$env:SUI_ORDER_AMOUNT="${config.spendAmount}"`,
        `$env:SUI_ORDER_PRICE="${config.limitPrice}"`,
        `$env:SUI_ORDER_QUANTITY="${config.orderQuantity}"`,
        '$env:SUI_CLOCK_ID="0x6"',
        "npm run sui:deepbook-demo -w @agentwallet/sdk"
      ].join("\n")
    },
    {
      id: "revoke-policy",
      title: "Revoke agent policy",
      eyebrow: "Step 7",
      description: "Demonstrate owner revocation by disabling future vault spends from the agent.",
      command: [
        '$env:SUI_OWNER_PRIVATE_KEY="sui-private-key"',
        `$env:SUI_PACKAGE_ID="${packageId}"`,
        `$env:SUI_POLICY_ID="${policyId}"`,
        "npm run sui:owner -w @agentwallet/sdk -- revoke-policy"
      ].join("\n")
    }
  ];
}

export function buildSuiEventRpcRequest(configValue: Pick<SuiDashboardConfig, "packageId">): SuiEventRpcRequest {
  const packageId = trimValue(configValue.packageId);

  if (!packageId) {
    throw new Error("Sui package id is required to fetch activity.");
  }

  return {
    jsonrpc: "2.0",
    id: 1,
    method: "suix_queryEvents",
    params: [{ MoveModule: { package: packageId, module: "policy" } }, null, 50, true]
  };
}

export function buildSuiDeepBookEventRpcRequest(packageId: string, module: "pool") {
  return {
    jsonrpc: "2.0" as const,
    id: 1 as const,
    method: "suix_queryEvents" as const,
    params: [
      { MoveModule: { package: packageId.trim(), module } },
      null,
      50,
      true
    ] as [{ MoveModule: { package: string; module: "pool" } }, null, number, boolean]
  };
}

export function buildSuiTransactionBlockRpcRequest(digest: string) {
  return {
    jsonrpc: "2.0" as const,
    id: 1 as const,
    method: "sui_getTransactionBlock" as const,
    params: [digest.trim(), { showEvents: true }] as [string, { showEvents: true }]
  };
}

export function parseSuiDeepBookOrders(
  responses: unknown[],
  filters: { balanceManagerId: string; poolId: string; marketLabel: string }
): SuiDeepBookOrder[] {
  const manager = filters.balanceManagerId.toLowerCase();
  const pool = filters.poolId.toLowerCase();
  const events = responses
    .flatMap((response) => getRpcEvents(response))
    .map((event) => normalizeDeepBookEvent(event, manager))
    .filter((event): event is NonNullable<ReturnType<typeof normalizeDeepBookEvent>> => Boolean(event))
    .filter((event) => (!manager || event.managerIds.includes(manager)) && (!pool || event.poolId === pool))
    .sort((left, right) => Number(left.timestampMs ?? "0") - Number(right.timestampMs ?? "0"));
  const orders = new Map<string, SuiDeepBookOrder>();

  for (const event of events) {
    for (const orderId of event.orderIds) {
      const previous = orders.get(orderId);
      orders.set(orderId, {
        orderId,
        market: filters.marketLabel,
        side: event.side ?? previous?.side ?? "buy",
        status: event.status,
        price: event.price || previous?.price || "unknown",
        quantity: event.quantity || previous?.quantity || "unknown",
        digest: event.digest,
        timestampMs: event.timestampMs
      });
    }
  }

  return [...orders.values()].sort(
    (left, right) => Number(right.timestampMs ?? "0") - Number(left.timestampMs ?? "0")
  );
}

export function resolveSuiActivityConfig(
  override: unknown,
  current: SuiDashboardConfig
): SuiDashboardConfig {
  if (
    override &&
    typeof override === "object" &&
    "packageId" in override &&
    typeof (override as { packageId?: unknown }).packageId === "string"
  ) {
    return normalizeSuiDashboardConfig(override as Partial<SuiDashboardConfig>);
  }

  return current;
}

export function parseSuiEventRpcResponse(
  response: unknown,
  filters: Partial<Pick<SuiDashboardConfig, "policyId" | "vaultId" | "agentAddress">> = {}
): SuiActivityEvent[] {
  const events = getRpcEvents(response);
  const normalizedFilters = {
    policyId: trimValue(filters.policyId),
    vaultId: trimValue(filters.vaultId),
    agentAddress: trimValue(filters.agentAddress)
  };

  return events
    .map((event) => normalizeSuiEvent(event))
    .filter((event): event is SuiActivityEvent => Boolean(event))
    .filter((event) => eventMatchesFilters(event, normalizedFilters));
}

export function mergeSuiActivityIntoConfig(
  configValue: Partial<SuiDashboardConfig> | null | undefined,
  events: SuiActivityEvent[]
): SuiDashboardConfig {
  const config = normalizeSuiDashboardConfig(configValue);
  const strategyDigest =
    events.find((event) => event.type === "AgentBudgetUsed" && event.digest)?.digest ||
    config.lastDeepBookTransactionDigest;
  const vaultCreated = events.find(
    (event) =>
      event.type === "AgentVaultCreated" &&
      getFirstString(event.parsedJson, ["policy_id", "policy", "policyId"]) &&
      getFirstString(event.parsedJson, ["vault_id", "vault", "vaultId"])
  );

  if (vaultCreated) {
    return {
      ...config,
      policyId: getFirstString(vaultCreated.parsedJson, ["policy_id", "policy", "policyId"])!,
      vaultId: getFirstString(vaultCreated.parsedJson, ["vault_id", "vault", "vaultId"])!,
      lastDeepBookTransactionDigest: strategyDigest
    };
  }

  const policyId =
    config.policyId ||
    events
      .map((event) => getFirstString(event.parsedJson, ["policy_id", "policy", "policyId"]))
      .find((value): value is string => Boolean(value)) ||
    "";

  return { ...config, policyId, lastDeepBookTransactionDigest: strategyDigest };
}

function trimValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toSafeBigInt(value: unknown) {
  try {
    return BigInt(trimValue(value) || "0");
  } catch {
    return 0n;
  }
}

function commandValue(value: string, fallback: string) {
  return value || fallback;
}

function getRpcEvents(response: unknown): unknown[] {
  if (!response || typeof response !== "object") {
    return [];
  }

  const result = (response as { result?: unknown }).result;
  if (!result || typeof result !== "object") {
    return [];
  }

  const data = (result as { data?: unknown }).data;
  if (Array.isArray(data)) {
    return data;
  }

  const events = (result as { events?: unknown }).events;
  return Array.isArray(events) ? events : [];
}

function normalizeSuiEvent(event: unknown): SuiActivityEvent | null {
  if (!event || typeof event !== "object") {
    return null;
  }

  const source = event as {
    id?: { txDigest?: unknown; eventSeq?: unknown };
    type?: unknown;
    timestampMs?: unknown;
    parsedJson?: unknown;
  };
  const digest = typeof source.id?.txDigest === "string" ? source.id.txDigest : "";
  const sequence = typeof source.id?.eventSeq === "string" ? source.id.eventSeq : "0";
  const eventType = typeof source.type === "string" ? source.type.split("::").pop() ?? source.type : "UnknownEvent";
  const parsedJson =
    source.parsedJson && typeof source.parsedJson === "object"
      ? (source.parsedJson as Record<string, unknown>)
      : {};
  const policyRef = getFirstString(parsedJson, ["policy", "policy_id", "policyId"]) ?? "policy";

  return {
    id: digest ? `${digest}:${sequence}` : `${eventType}:${sequence}`,
    digest,
    sequence,
    type: eventType,
    timestampMs: typeof source.timestampMs === "string" ? source.timestampMs : null,
    summary: `${eventType} for ${policyRef}`,
    parsedJson
  };
}

function normalizeDeepBookEvent(event: unknown, selectedManager: string) {
  if (!event || typeof event !== "object") {
    return null;
  }

  const source = event as {
    id?: { txDigest?: unknown };
    type?: unknown;
    parsedJson?: unknown;
  };
  const parsedJson =
    source.parsedJson && typeof source.parsedJson === "object"
      ? (source.parsedJson as Record<string, unknown>)
      : {};
  const type = typeof source.type === "string" ? source.type.split("::").pop() ?? "" : "";
  const statusByType: Record<string, SuiDeepBookOrder["status"]> = {
    OrderPlaced: "open",
    OrderFilled: "fill observed",
    OrderFullyFilled: "filled",
    OrderCanceled: "cancelled",
    OrderExpired: "expired"
  };
  const status = statusByType[type];
  if (!status) {
    return null;
  }

  const orderIds =
    type === "OrderFilled"
      ? [
          getFirstString(parsedJson, ["maker_balance_manager_id"])?.toLowerCase() === selectedManager
            ? getFirstString(parsedJson, ["maker_order_id"])
            : null,
          getFirstString(parsedJson, ["taker_balance_manager_id"])?.toLowerCase() === selectedManager
            ? getFirstString(parsedJson, ["taker_order_id"])
            : null
        ].filter((value): value is string => Boolean(value))
      : getStringValues(parsedJson, ["order_id"]);
  if (!orderIds.length) {
    return null;
  }

  const isBid = getBoolean(parsedJson, type === "OrderFilled" ? "taker_is_bid" : "is_bid");
  return {
    digest: typeof source.id?.txDigest === "string" ? source.id.txDigest : "",
    orderIds,
    managerIds: getStringValues(parsedJson, [
      "balance_manager_id",
      "maker_balance_manager_id",
      "taker_balance_manager_id"
    ]).map((value) => value.toLowerCase()),
    poolId: (getFirstString(parsedJson, ["pool_id"]) ?? "").toLowerCase(),
    side: isBid === null ? null : isBid ? ("buy" as const) : ("sell" as const),
    status,
    price: getFirstString(parsedJson, ["price"]) ?? "",
    quantity:
      getFirstString(parsedJson, ["placed_quantity", "original_quantity", "base_quantity"]) ?? "",
    timestampMs: getFirstString(parsedJson, ["timestamp"]) ?? null
  };
}

function getStringValues(source: Record<string, unknown>, keys: string[]) {
  return keys
    .map((key) => source[key])
    .filter((value): value is string => typeof value === "string" && Boolean(value));
}

function getBoolean(source: Record<string, unknown>, key: string) {
  return typeof source[key] === "boolean" ? source[key] : null;
}

function eventMatchesFilters(
  event: SuiActivityEvent,
  filters: Pick<SuiDashboardConfig, "policyId" | "vaultId" | "agentAddress">
) {
  const parsed = lowerCaseStringValues(event.parsedJson);
  const matchedFilters: boolean[] = [];

  if (filters.policyId && hasAnyKey(parsed, ["policy", "policy_id", "policyId"])) {
    matchedFilters.push(valueMatches(parsed, ["policy", "policy_id", "policyId"], filters.policyId));
  }

  if (filters.vaultId && hasAnyKey(parsed, ["vault", "vault_id", "vaultId"])) {
    matchedFilters.push(valueMatches(parsed, ["vault", "vault_id", "vaultId"], filters.vaultId));
  }

  if (filters.agentAddress && hasAnyKey(parsed, ["agent", "agent_address", "agentAddress"])) {
    matchedFilters.push(valueMatches(parsed, ["agent", "agent_address", "agentAddress"], filters.agentAddress));
  }

  return matchedFilters.length === 0 || matchedFilters.every(Boolean);
}

function getFirstString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }

  return null;
}

function lowerCaseStringValues(source: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(source)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, value]) => [key, value.toLowerCase()])
  );
}

function hasAnyKey(source: Record<string, string>, keys: string[]) {
  return keys.some((key) => key in source);
}

function valueMatches(source: Record<string, string>, keys: string[], expected: string) {
  const normalizedExpected = expected.toLowerCase();
  return keys.some((key) => source[key] === normalizedExpected);
}
