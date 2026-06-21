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
  orderSide: "bid" | "ask";
  orderExecution: "limit" | "market";
};

export type SuiDeepBookMarket = {
  id: string;
  deepbookPoolKey: "DEEP_SUI" | "SUI_DBUSDC";
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
  defaultOrderSide?: "bid" | "ask";
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
  poolId: string;
  side: "buy" | "sell";
  execution: "limit" | "market" | "unknown";
  assetFlow: string;
  baseAsset: string;
  quoteAsset: string;
  baseQuantity: string;
  quoteQuantity: string;
  amountEvidence: string;
  status: "submitted" | "open" | "partially filled" | "filled" | "unfilled" | "cancelled" | "expired";
  settlementEvidence: "transaction only" | "deepbook event" | "balance change";
  isSettled: boolean;
  price: string;
  quantity: string;
  digest: string;
  transactionUrl: string;
  timestampMs: string | null;
};

export type SuiProofSummary = {
  status: {
    label: "Active" | "Expired" | "Revoked" | "Draft";
    tone: "initialized" | "pending" | "paused";
    detail: string;
  };
  budget: {
    used: string;
    remaining: string;
    max: string;
    percentUsed: number;
  };
  latestOrder: {
    headline: string;
    evidence: string;
    digest: string;
    url: string;
  } | null;
  proofs: Array<{
    label: string;
    state: "proven" | "pending";
    detail: string;
    digest?: string;
  }>;
};

export type SuiPolicyExecutionBlocker = {
  code:
    | "POLICY_REVOKED"
    | "POLICY_EXPIRED"
    | "BUDGET_EXHAUSTED"
    | "AMOUNT_EXCEEDS_REMAINING_BUDGET";
  remainingBudget: string;
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
export const deepbookTestnetUsdcType =
  "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC";
export const suiGasReserveMist = 50_000_000n;
export const suiDeepBookMarkets: SuiDeepBookMarket[] = [
  {
    id: "deep-sui-testnet",
    deepbookPoolKey: "DEEP_SUI",
    label: "DEEP / SUI",
    network: "testnet",
    description: "Verified DeepBook V3 testnet market used by the autonomous strategy demo.",
    deepbookPackageId: "0xbc331f09e5c737d45f074ad2d17c3038421b3b9018699e370d88d94938c53d28",
    poolId: "0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f",
    coinType: suiType,
    tokenTypeLabel: "SUI",
    baseAssetType: deepbookDeepType,
    quoteAssetType: suiType,
    defaultSpendAmount: "500000000",
    defaultOrderQuantity: "10000000",
    defaultLimitPrice: "10000000000"
  },
  {
    id: "sui-usdc-testnet",
    deepbookPoolKey: "SUI_DBUSDC",
    label: "SUI / USDC",
    network: "testnet",
    description: "Verified DeepBook V3 testnet SUI/DBUSDC market for SUI-funded agent swaps into USDC.",
    deepbookPackageId: "0xbc331f09e5c737d45f074ad2d17c3038421b3b9018699e370d88d94938c53d28",
    poolId: "0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5",
    coinType: suiType,
    tokenTypeLabel: "SUI",
    baseAssetType: suiType,
    quoteAssetType: deepbookTestnetUsdcType,
    defaultSpendAmount: "1000000000",
    defaultOrderQuantity: "1000000000",
    defaultLimitPrice: "700000",
    defaultOrderSide: "ask"
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
  limitPrice: "1000000000",
  orderSide: "bid",
  orderExecution: "limit"
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
  return parseSuiGrpcCoinBalanceResponse(response);
}

export function parseSuiGrpcCoinBalanceResponse(response: unknown) {
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
  const vaultFunding = toSafeBigInt(input.budgetMist);
  const requiredOwnerBalance =
    input.coinType.trim() === suiType ? vaultFunding + suiGasReserveMist : suiGasReserveMist;
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

export function getSuiBudgetMetrics(
  maxBudgetValue: string,
  events: SuiActivityEvent[],
  policyId = ""
) {
  const maxBudget = toSafeBigInt(maxBudgetValue);
  const latestBudgetEvent = events
    .filter(
      (event) =>
        event.type === "AgentBudgetUsed" && suiEventMatchesPolicy(event, policyId)
    )
    .sort((left, right) => Number(right.timestampMs ?? "0") - Number(left.timestampMs ?? "0"))
    .find((event) => getFirstString(event.parsedJson, ["remaining_budget", "remainingBudget"]));
  const reportedRemaining = latestBudgetEvent
    ? toSafeBigInt(getFirstString(latestBudgetEvent.parsedJson, ["remaining_budget", "remainingBudget"]))
    : maxBudget;
  const remainingBudget = reportedRemaining > maxBudget ? maxBudget : reportedRemaining;
  const usedBudget = maxBudget > remainingBudget ? maxBudget - remainingBudget : 0n;

  return {
    maxBudget: maxBudget.toString(),
    usedBudget: usedBudget.toString(),
    remainingBudget: remainingBudget.toString()
  };
}

export function getSuiPolicyExecutionBlocker(
  configValue: Partial<SuiDashboardConfig> | null | undefined,
  events: SuiActivityEvent[],
  requestedAmount: string,
  nowMs = Date.now()
): SuiPolicyExecutionBlocker | null {
  const config = normalizeSuiDashboardConfig(configValue);
  const budget = getSuiBudgetMetrics(config.budgetMist, events, config.policyId);

  if (findLatestSuiPolicyEvent(events, "PolicyRevoked", config.policyId)) {
    return { code: "POLICY_REVOKED", remainingBudget: budget.remainingBudget };
  }

  if (getSuiPolicyExpiryState(config.expiresAtMs, nowMs).expired) {
    return { code: "POLICY_EXPIRED", remainingBudget: budget.remainingBudget };
  }

  const remainingBudget = toSafeBigInt(budget.remainingBudget);
  if (remainingBudget === 0n) {
    return { code: "BUDGET_EXHAUSTED", remainingBudget: budget.remainingBudget };
  }

  if (toSafeBigInt(requestedAmount) > remainingBudget) {
    return {
      code: "AMOUNT_EXCEEDS_REMAINING_BUDGET",
      remainingBudget: budget.remainingBudget
    };
  }

  return null;
}

export function formatSuiTokenAmount(value: string, tokenLabel: string) {
  const normalizedLabel = tokenLabel.trim().toUpperCase();
  const decimals = normalizedLabel === "USDC" || normalizedLabel === "DEEP" ? 6 : 9;
  const amount = toSafeBigInt(value);
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  const formatted = fraction ? `${whole}.${fraction}` : whole.toString();

  return `${formatted} ${normalizedLabel || "TOKEN"}`;
}

export function getSuiPolicyExpiryState(expiresAtMs: string, nowMs = Date.now()) {
  const expiresAt = Number(expiresAtMs);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
    return { expired: true, label: "Expired" };
  }

  const remainingSeconds = Math.max(0, Math.ceil((expiresAt - nowMs) / 1000));
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const label = hours > 0
    ? `Expires in ${hours}h ${minutes}m`
    : `Expires in ${minutes}m ${seconds}s`;

  return { expired: false, label };
}

export function getSuiProofSummary(
  configValue: Partial<SuiDashboardConfig> | null | undefined,
  events: SuiActivityEvent[],
  orders: SuiDeepBookOrder[],
  nowMs = Date.now()
): SuiProofSummary {
  const config = normalizeSuiDashboardConfig(configValue);
  const budgetMetrics = getSuiBudgetMetrics(config.budgetMist, events, config.policyId);
  const maxBudget = toSafeBigInt(budgetMetrics.maxBudget);
  const usedBudget = toSafeBigInt(budgetMetrics.usedBudget);
  const percentUsed = maxBudget > 0n ? Number((usedBudget * 100n) / maxBudget) : 0;
  const expiryState = getSuiPolicyExpiryState(config.expiresAtMs, nowMs);
  const policyCreated = findLatestSuiEvent(events, "PolicyCreated");
  const vaultCreated = findLatestSuiEvent(events, "AgentVaultCreated");
  const vaultFunded = findLatestSuiEvent(events, "AgentVaultFunded");
  const budgetUsed = findLatestSuiPolicyEvent(events, "AgentBudgetUsed", config.policyId);
  const revoked = findLatestSuiPolicyEvent(events, "PolicyRevoked", config.policyId);
  const latestOrder = orders[0] ?? null;
  const policyReady = Boolean(config.policyId || policyCreated);
  const vaultReady = Boolean(config.vaultId || vaultCreated);
  const managerReady = Boolean(config.balanceManagerId);

  const status = revoked
    ? {
        label: "Revoked" as const,
        tone: "paused" as const,
        detail: "Owner revoked this policy on-chain. Future agent actions are blocked."
      }
    : expiryState.expired
      ? {
          label: "Expired" as const,
          tone: "paused" as const,
          detail: "The mandate time window has ended. Create a new policy before the agent spends again."
        }
      : policyReady
        ? {
            label: "Active" as const,
            tone: "initialized" as const,
            detail: `Move policy enforced. ${expiryState.label}.`
          }
        : {
            label: "Draft" as const,
            tone: "pending" as const,
            detail: "Create the Sui policy object to begin the on-chain proof."
          };

  return {
    status,
    budget: {
      used: formatSuiTokenAmount(budgetMetrics.usedBudget, config.tokenTypeLabel),
      remaining: formatSuiTokenAmount(budgetMetrics.remainingBudget, config.tokenTypeLabel),
      max: formatSuiTokenAmount(budgetMetrics.maxBudget, config.tokenTypeLabel),
      percentUsed: Math.min(100, Math.max(0, percentUsed))
    },
    latestOrder: latestOrder
      ? {
          headline: `${capitalize(latestOrder.execution)} ${latestOrder.side} on ${latestOrder.market}`,
          evidence: latestOrder.amountEvidence,
          digest: latestOrder.digest,
          url: latestOrder.transactionUrl
        }
      : null,
    proofs: [
      {
        label: "Policy object",
        state: policyReady ? "proven" : "pending",
        detail: policyReady ? "Owner-created Move policy exists on testnet." : "Create the owner policy object.",
        digest: policyCreated?.digest
      },
      {
        label: "Vault funded",
        state: vaultReady && Boolean(vaultFunded) ? "proven" : "pending",
        detail: vaultReady && vaultFunded
          ? "The policy vault has received owner funds."
          : "Create and fund the policy vault.",
        digest: vaultFunded?.digest
      },
      {
        label: "DeepBook order",
        state: latestOrder ? "proven" : "pending",
        detail: latestOrder
          ? `${latestOrder.execution === "market" ? "Market" : latestOrder.execution === "limit" ? "Limit" : "DeepBook"} order observed for ${latestOrder.assetFlow}.`
          : managerReady
            ? "Run an agent order and refresh DeepBook evidence."
            : "Create the agent DeepBook manager first.",
        digest: latestOrder?.digest
      },
      {
        label: "Budget enforced",
        state: budgetUsed ? "proven" : "pending",
        detail: budgetUsed
          ? `Used ${formatSuiTokenAmount(budgetMetrics.usedBudget, config.tokenTypeLabel)} of ${formatSuiTokenAmount(budgetMetrics.maxBudget, config.tokenTypeLabel)}.`
          : "Submit an agent action to emit AgentBudgetUsed.",
        digest: budgetUsed?.digest
      },
      {
        label: "Owner revocation",
        state: revoked ? "proven" : "pending",
        detail: revoked
          ? "Owner revocation event is on-chain."
          : "Revoke the policy to prove owner control.",
        digest: revoked?.digest
      }
    ]
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
    limitPrice: trimValue(source.limitPrice) || defaultSuiDashboardConfig.limitPrice,
    orderSide: source.orderSide === "ask" ? "ask" : "bid",
    orderExecution: source.orderExecution === "market" ? "market" : "limit"
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
    limitPrice: market.defaultLimitPrice,
    orderSide: market.defaultOrderSide ?? config.orderSide
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
    params: [
      digest.trim(),
      {
        showEvents: true,
        showObjectChanges: true,
        showBalanceChanges: true
      }
    ] as [string, { showEvents: true; showObjectChanges: true; showBalanceChanges: true }]
  };
}

export function parseSuiDeepBookOrders(
  responses: unknown[],
  filters: {
    balanceManagerId: string;
    poolId: string;
    marketLabel: string;
    transactionDigest?: string;
    executionHint?: "limit" | "market";
    sideHint?: "buy" | "sell";
    balanceOwnerAddress?: string;
  }
): SuiDeepBookOrder[] {
  const manager = filters.balanceManagerId.toLowerCase();
  const pool = filters.poolId.toLowerCase();
  const hintedDigest = trimValue(filters.transactionDigest);
  const events = responses
    .flatMap((response) => getRpcEvents(response))
    .map((event) => normalizeDeepBookEvent(event, manager))
    .filter((event): event is NonNullable<ReturnType<typeof normalizeDeepBookEvent>> => Boolean(event))
    .filter(
      (event) =>
        (!manager ||
          event.managerIds.includes(manager) ||
          Boolean(
            hintedDigest &&
              event.digest === hintedDigest &&
              event.managerIds.length === 0
          )) &&
        (!pool || event.poolId === pool)
    )
    .sort((left, right) => Number(left.timestampMs ?? "0") - Number(right.timestampMs ?? "0"));
  const orders = new Map<string, SuiDeepBookOrder>();
  const marketAssets = getSuiMarketAssets(filters.marketLabel);

  for (const event of events) {
    for (const orderId of event.orderIds) {
      const previous = orders.get(orderId);
      const side = event.side ?? previous?.side ?? "buy";
      const baseQuantity = event.baseQuantity || previous?.baseQuantity || event.quantity || previous?.quantity || "";
      const quoteQuantity = event.quoteQuantity || previous?.quoteQuantity || "";
      orders.set(orderId, {
        orderId,
        market: filters.marketLabel,
        poolId: event.poolId || previous?.poolId || filters.poolId,
        side,
        execution:
          event.execution ??
          previous?.execution ??
          (hintedDigest && event.digest === hintedDigest ? filters.executionHint : undefined) ??
          "unknown",
        assetFlow: describeSuiOrderAssetFlow(filters.marketLabel, side),
        baseAsset: marketAssets.base,
        quoteAsset: marketAssets.quote,
        baseQuantity,
        quoteQuantity,
        amountEvidence: describeSuiOrderAmountEvidence({
          side,
          baseAsset: marketAssets.base,
          quoteAsset: marketAssets.quote,
          baseQuantity,
          quoteQuantity
        }),
        status: mergeSuiOrderStatus(previous?.status, event.status),
        settlementEvidence: "deepbook event",
        isSettled: mergeSuiOrderStatus(previous?.status, event.status) === "filled",
        price: event.price || previous?.price || "unknown",
        quantity: event.quantity || previous?.quantity || "unknown",
        digest: event.digest,
        transactionUrl: event.digest ? `https://suiexplorer.com/txblock/${event.digest}?network=testnet` : "",
        timestampMs: event.timestampMs
      });
    }
  }

  const hasHintedTransactionEvidence = [...orders.values()].some(
    (order) => order.digest === hintedDigest
  );
  if (hintedDigest && filters.executionHint && !hasHintedTransactionEvidence) {
    const swapEvidence = getExactTransactionExecutionEvidence(responses, {
      digest: hintedDigest,
      poolId: pool,
      marketLabel: filters.marketLabel,
      execution: filters.executionHint,
      sideHint: filters.sideHint,
      balanceOwnerAddress: filters.balanceOwnerAddress
    });
    if (swapEvidence) {
      orders.set(swapEvidence.orderId, swapEvidence);
    }
  }

  return [...orders.values()].sort(
    (left, right) => Number(right.timestampMs ?? "0") - Number(left.timestampMs ?? "0")
  );
}

export function describeSuiOrderAssetFlow(marketLabel: string, side: "buy" | "sell") {
  const { base, quote } = getSuiMarketAssets(marketLabel);

  return side === "buy" ? `${quote} -> ${base}` : `${base} -> ${quote}`;
}

export function describeSuiSettlementEvidence(order: SuiDeepBookOrder | null | undefined) {
  if (!order) {
    return "Transaction confirmed, but settlement evidence is not indexed yet. Refresh Agent orders before treating it as filled.";
  }

  if (order.status === "filled") {
    return `Swap filled and verified by ${order.settlementEvidence}: ${order.amountEvidence}.`;
  }

  if (order.status === "partially filled") {
    return `Partial fill verified by DeepBook event: ${order.amountEvidence}. The order is not fully settled.`;
  }

  if (order.status === "open") {
    return "Limit order is open on DeepBook. No swap settlement has occurred yet.";
  }

  if (order.status === "unfilled") {
    const receivedAsset = order.side === "buy" ? order.baseAsset : order.quoteAsset;
    return `Transaction confirmed, but no ${receivedAsset} was received. The market swap was not filled.`;
  }

  if (order.status === "submitted") {
    return "Transaction confirmed, but DeepBook order evidence is still indexing. Refresh Agent orders before treating it as filled.";
  }

  return `DeepBook reports this order as ${order.status}. No completed swap settlement was verified.`;
}

function describeSuiOrderAmountEvidence(input: {
  side: "buy" | "sell";
  baseAsset: string;
  quoteAsset: string;
  baseQuantity: string;
  quoteQuantity: string;
}) {
  if (input.baseQuantity && input.quoteQuantity) {
    return input.side === "buy"
      ? `${input.quoteQuantity} ${input.quoteAsset} -> ${input.baseQuantity} ${input.baseAsset}`
      : `${input.baseQuantity} ${input.baseAsset} -> ${input.quoteQuantity} ${input.quoteAsset}`;
  }

  if (input.baseQuantity) {
    return input.side === "buy"
      ? `${input.baseQuantity} ${input.baseAsset} requested with ${input.quoteAsset}`
      : `${input.baseQuantity} ${input.baseAsset} offered for ${input.quoteAsset}`;
  }

  return `Amount pending for ${input.side === "buy" ? `${input.quoteAsset} -> ${input.baseAsset}` : `${input.baseAsset} -> ${input.quoteAsset}`}`;
}

function getExactTransactionExecutionEvidence(
  responses: unknown[],
  input: {
    digest: string;
    poolId: string;
    marketLabel: string;
    execution: "limit" | "market";
    sideHint?: "buy" | "sell";
    balanceOwnerAddress?: string;
  }
): SuiDeepBookOrder | null {
  const tx = responses
    .map((response) => getRpcTransactionResult(response))
    .find((result) => trimValue((result as { digest?: unknown })?.digest) === input.digest);
  if (!tx) {
    return null;
  }

  const events = getRpcEvents({ result: tx });
  const budgetEvent = events
    .map((event) => normalizeSuiEvent(event))
    .find((event) => event?.type === "AgentBudgetUsed" && trimValue(getFirstString(event.parsedJson, ["pool_id", "poolId"]))?.toLowerCase() === input.poolId);
  if (!budgetEvent) {
    return null;
  }

  const { base, quote } = getSuiMarketAssets(input.marketLabel);
  const side = input.sideHint ?? "buy";
  const amount = getFirstString(budgetEvent.parsedJson, ["amount"]) || "";
  const timestampMs =
    budgetEvent.timestampMs ||
    getFirstString(budgetEvent.parsedJson, ["timestamp_ms", "timestampMs", "timestamp"]) ||
    getFirstString(tx as Record<string, unknown>, ["timestampMs"]) ||
    "";
  const receivedAsset = side === "buy" ? base : quote;
  const receivedAmount = getPositiveBalanceChangeForToken(
    tx,
    receivedAsset,
    input.balanceOwnerAddress
  );
  const filled = Boolean(receivedAmount);
  const baseQuantity = side === "buy" ? receivedAmount : amount;
  const quoteQuantity = side === "buy" ? amount : receivedAmount;
  const assetFlow = describeSuiOrderAssetFlow(input.marketLabel, side);

  return {
    orderId: input.digest,
    market: input.marketLabel,
    poolId: input.poolId,
    side,
    execution: input.execution,
    assetFlow,
    baseAsset: base,
    quoteAsset: quote,
    baseQuantity,
    quoteQuantity,
    amountEvidence: filled
      ? side === "buy"
        ? `${amount || "Market"} ${quote} -> ${receivedAmount} ${base}`
        : `${amount || "Market"} ${base} -> ${receivedAmount} ${quote}`
      : input.execution === "limit" && amount
        ? `${amount} ${side === "buy" ? quote : base} submitted; awaiting DeepBook order evidence`
        : amount
        ? side === "buy"
          ? `${amount} ${quote} submitted; no ${base} filled`
          : `${amount} ${base} submitted; no ${quote} filled`
        : `No ${receivedAsset} filled`,
    status: filled ? "filled" : input.execution === "market" ? "unfilled" : "submitted",
    settlementEvidence: filled ? "balance change" : "transaction only",
    isSettled: filled,
    price: input.execution === "market" ? "market" : "pending index",
    quantity: input.execution === "market" ? "market" : amount || "pending index",
    digest: input.digest,
    transactionUrl: `https://suiexplorer.com/txblock/${input.digest}?network=testnet`,
    timestampMs
  };
}

function mergeSuiOrderStatus(
  previous: SuiDeepBookOrder["status"] | undefined,
  next: SuiDeepBookOrder["status"]
): SuiDeepBookOrder["status"] {
  if (previous === "filled" || next === "filled") {
    return "filled";
  }

  if (previous === "partially filled" || next === "partially filled") {
    return "partially filled";
  }

  return next;
}

function getPositiveBalanceChangeForToken(
  tx: unknown,
  tokenLabel: string,
  balanceOwnerAddress?: string
) {
  if (!tx || typeof tx !== "object") {
    return "";
  }

  const changes = Array.isArray((tx as { balanceChanges?: unknown }).balanceChanges)
    ? (tx as { balanceChanges: unknown[] }).balanceChanges
    : [];
  for (const change of changes) {
    if (!change || typeof change !== "object") {
      continue;
    }

    const coinType = trimValue((change as { coinType?: unknown }).coinType);
    const amount = trimValue((change as { amount?: unknown }).amount);
    const ownerAddress = getSuiBalanceChangeOwnerAddress(change);
    if (
      !coinTypeMatchesLabel(coinType, tokenLabel) ||
      !amount ||
      (balanceOwnerAddress && ownerAddress.toLowerCase() !== balanceOwnerAddress.toLowerCase())
    ) {
      continue;
    }

    try {
      if (BigInt(amount) > 0n) {
        return amount;
      }
    } catch {
      continue;
    }
  }

  return "";
}

function getSuiBalanceChangeOwnerAddress(change: object) {
  const owner = (change as { owner?: unknown }).owner;
  if (typeof owner === "string") {
    return owner;
  }
  if (!owner || typeof owner !== "object") {
    return "";
  }

  return trimValue(
    (owner as { AddressOwner?: unknown; addressOwner?: unknown }).AddressOwner ??
      (owner as { addressOwner?: unknown }).addressOwner
  );
}

function getRpcTransactionResult(response: unknown) {
  if (!response || typeof response !== "object") {
    return null;
  }

  const result = (response as { result?: unknown }).result;
  return result && typeof result === "object" ? result : null;
}

function coinTypeMatchesLabel(coinType: string, tokenLabel: string) {
  if (tokenLabel.toLowerCase() === "usdc" && /::DBUSDC::DBUSDC$/i.test(coinType)) {
    return true;
  }

  return new RegExp(`::${escapeRegExp(tokenLabel)}(?:>|::|$)`, "i").test(coinType);
}

function getSuiMarketAssets(marketLabel: string) {
  const [baseRaw, quoteRaw] = marketLabel.split("/").map((part) => part.trim()).filter(Boolean);
  return {
    base: baseRaw || "base",
    quote: quoteRaw || "quote"
  };
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

function findLatestSuiEvent(events: SuiActivityEvent[], type: string) {
  return [...events]
    .filter((event) => event.type === type)
    .sort((left, right) => Number(right.timestampMs ?? "0") - Number(left.timestampMs ?? "0"))[0] ?? null;
}

function findLatestSuiPolicyEvent(events: SuiActivityEvent[], type: string, policyId: string) {
  return findLatestSuiEvent(
    events.filter((event) => suiEventMatchesPolicy(event, policyId)),
    type
  );
}

function suiEventMatchesPolicy(event: SuiActivityEvent, policyId: string) {
  const normalizedPolicyId = policyId.trim().toLowerCase();
  if (!normalizedPolicyId) {
    return true;
  }

  const eventPolicyId = getFirstString(event.parsedJson, ["policy_id", "policy", "policyId"]);
  return !eventPolicyId || eventPolicyId.toLowerCase() === normalizedPolicyId;
}

function capitalize(value: string) {
  if (!value) {
    return "Unknown";
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    OrderFilled: "partially filled",
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
        ]
          .filter((value): value is string => Boolean(value))
          .concat(
            getStringValues(parsedJson, ["taker_order_id", "maker_order_id"]).filter(
              (orderId) => !hasMatchingManagerIds(parsedJson, selectedManager) && Boolean(orderId)
            )
          )
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
    execution: parseDeepBookExecution(getFirstString(parsedJson, ["order_type", "orderType"])),
    status,
    price: getFirstString(parsedJson, ["price"]) ?? "",
    quantity: getFirstString(parsedJson, ["placed_quantity", "original_quantity", "base_quantity"]) ?? "",
    baseQuantity: getFirstString(parsedJson, ["placed_quantity", "original_quantity", "base_quantity"]) ?? "",
    quoteQuantity: getFirstString(parsedJson, ["quote_quantity", "cumulative_quote_quantity"]) ?? "",
    timestampMs: getFirstString(parsedJson, ["timestamp"]) ?? null
  };
}

function hasMatchingManagerIds(parsedJson: Record<string, unknown>, selectedManager: string) {
  if (!selectedManager) {
    return false;
  }

  return getStringValues(parsedJson, [
    "balance_manager_id",
    "maker_balance_manager_id",
    "taker_balance_manager_id"
  ])
    .map((value) => value.toLowerCase())
    .includes(selectedManager);
}

function parseDeepBookExecution(value: string | null | undefined): "limit" | "market" | null {
  if (value === "1" || value === "2") {
    return "market";
  }

  if (value === "0" || value === "3") {
    return "limit";
  }

  return null;
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
