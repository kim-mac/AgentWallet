import {
  buildSuiCreatePolicyPlan,
  buildSuiCreateVaultPlan,
  buildSuiCreateDeepBookBalanceManagerPlan,
  buildSuiDeepBookLimitOrderPlan,
  buildSuiDepositVaultPlan,
  buildSuiRevokePolicyPlan,
  createSuiTransaction,
  type SuiPtbPlan
} from "@agentwallet/sdk";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { SuiDashboardConfig } from "./sui-dashboard";
import { deepbookDeepType, normalizeSuiDashboardConfig } from "./sui-dashboard";
import { explainSuiTransactionError } from "./sui-errors";

export type SuiDashboardActionId =
  | "create-policy"
  | "create-vault"
  | "fund-vault"
  | "create-balance-manager"
  | "run-deepbook-strategy"
  | "revoke-policy";

export type SuiAutonomousDemoStep = SuiDashboardActionId | "prove-budget-ceiling";

export type SuiParsedAgentMandate = {
  budgetLabel: string;
  maxBudget: string;
  allowedProtocol: "DeepBook";
  expiresAtMs: string;
  durationLabel: string;
};

export type SuiDashboardActionPlan = {
  id: SuiDashboardActionId;
  label: string;
  signerRole: "owner" | "agent";
  plan: SuiPtbPlan;
};

export type SuiDashboardActionResult =
  | {
      ok: true;
      digest: string;
      status: "success";
      explorerUrl: string;
      raw: unknown;
    }
  | {
      ok: false;
      digest?: string;
      status?: string;
      error: string;
      explorerUrl?: string;
      raw?: unknown;
    };

const suiExplorerBaseUrl = "https://suiexplorer.com";
const suiTestnetFullnodeUrl = "https://fullnode.testnet.sui.io:443";
const defaultDeepBookClockId = "0x6";

export function buildSuiDashboardActionPlan(
  action: SuiDashboardActionId,
  configValue: Partial<SuiDashboardConfig> | null | undefined
): SuiDashboardActionPlan {
  const config = normalizeSuiDashboardConfig(configValue);

  if (action === "create-policy") {
    return {
      id: action,
      label: "Create Sui policy",
      signerRole: "owner",
      plan: buildSuiCreatePolicyPlan({
        packageId: config.packageId,
        agent: config.agentAddress,
        maxBudget: config.budgetMist,
        allowedPoolId: config.allowedPoolId,
        expiresAtMs: config.expiresAtMs
      })
    };
  }

  if (action === "create-vault") {
    return {
      id: action,
      label: "Create Sui vault",
      signerRole: "owner",
      plan: buildSuiCreateVaultPlan({
        packageId: config.packageId,
        policyId: config.policyId,
        coinType: config.coinType,
        tokenTypeLabel: config.tokenTypeLabel
      })
    };
  }

  if (action === "fund-vault") {
    return {
      id: action,
      label: "Fund Sui vault",
      signerRole: "owner",
      plan: buildSuiDepositVaultPlan({
        packageId: config.packageId,
        vaultId: config.vaultId,
        coinType: config.coinType,
        amount: config.budgetMist
      })
    };
  }

  if (action === "create-balance-manager") {
    return {
      id: action,
      label: "Create DeepBook balance manager",
      signerRole: "agent",
      plan: buildSuiCreateDeepBookBalanceManagerPlan({
        deepBookPackageId: config.deepbookPackageId
      })
    };
  }

  if (action === "run-deepbook-strategy") {
    return {
      id: action,
      label: "Run autonomous DeepBook strategy",
      signerRole: "agent",
      plan: buildSuiDeepBookLimitOrderPlan({
        packageId: config.packageId,
        policyId: config.policyId,
        vaultId: config.vaultId,
        coinType: config.coinType,
        amount: config.spendAmount,
        poolId: config.allowedPoolId,
        deepBookPackageId: config.deepbookPackageId,
        balanceManagerId: config.balanceManagerId,
        baseAssetType: config.deepbookBaseType,
        quoteAssetType: config.deepbookQuoteType,
        deepFeeAssetType: deepbookDeepType,
        orderType: config.orderSide,
        execution: config.orderExecution,
        price: config.limitPrice,
        quantity: config.orderQuantity,
        clockId: defaultDeepBookClockId,
        settleToAddress: config.agentAddress
      })
    };
  }

  return {
    id: action,
    label: "Revoke Sui policy",
    signerRole: "owner",
    plan: buildSuiRevokePolicyPlan({
      packageId: config.packageId,
      policyId: config.policyId
    })
  };
}

export function parseSuiAgentMandate(input: string): SuiParsedAgentMandate {
  const normalized = input.trim();
  const budgetMatch = normalized.match(/max\s+([\d,.]+)\s*([a-zA-Z]+)/i);
  const durationMatch = normalized.match(
    /expires?\s+(?:in\s+)?(\d+)\s*(m(?:in(?:ute)?s?)?|h(?:our)?s?)/i
  );
  const budgetAmount = budgetMatch?.[1]?.replace(/,/g, "") ?? "500";
  const tokenLabel = (budgetMatch?.[2] ?? "USDC").toUpperCase();
  const durationValue = durationMatch?.[1] ? Number(durationMatch[1]) : 24;
  const durationUnit = durationMatch?.[2]?.toLowerCase().startsWith("m") ? "minute" : "hour";
  const durationMs = durationValue * (durationUnit === "minute" ? 60_000 : 3_600_000);
  const decimals = tokenLabel === "USDC" ? 6 : 9;
  const parsedAmount = Number(budgetAmount);
  const scaledBudget = Number.isFinite(parsedAmount)
    ? BigInt(Math.round(parsedAmount * 10 ** decimals)).toString()
    : "500000000";

  return {
    budgetLabel: `${budgetAmount} ${tokenLabel}`,
    maxBudget: scaledBudget,
    allowedProtocol: "DeepBook",
    expiresAtMs: String(durationMs),
    durationLabel: `${durationValue} ${durationUnit}${durationValue === 1 ? "" : "s"}`
  };
}

export function buildSuiAutonomousDemoSteps(
  configValue: Partial<SuiDashboardConfig> | null | undefined,
  state?: { vaultFunded?: boolean }
): SuiAutonomousDemoStep[] {
  const config = normalizeSuiDashboardConfig(configValue);
  const steps: SuiAutonomousDemoStep[] = [];

  if (!config.policyId) {
    steps.push("create-policy");
  }

  if (!config.vaultId) {
    steps.push("create-vault", "fund-vault");
  } else if (state?.vaultFunded === false) {
    steps.push("fund-vault");
  }

  if (!config.balanceManagerId) {
    steps.push("create-balance-manager");
  }

  return steps;
}

export function buildSuiOverBudgetConfig(
  configValue: Partial<SuiDashboardConfig> | null | undefined
): SuiDashboardConfig {
  const config = normalizeSuiDashboardConfig(configValue);
  return {
    ...config,
    spendAmount: (BigInt(config.budgetMist) + 1n).toString()
  };
}

export function describeSuiBudgetProofRejection(error: string) {
  if (
    (error.includes("record_budget_use") && error.includes("abort code: 6")) ||
    error === "Rejected: this action exceeds the policy's remaining budget."
  ) {
    return "Budget ceiling verified: the Move policy blocked the deliberate over-budget action.";
  }

  return `Budget ceiling test rejected on-chain: ${error}`;
}

export async function submitSuiDashboardAction(input: {
  action: SuiDashboardActionId;
  config: SuiDashboardConfig;
  privateKey: string;
}): Promise<SuiDashboardActionResult> {
  const prepared = buildSuiDashboardActionPlan(input.action, input.config);
  const decoded = decodeSuiPrivateKey(input.privateKey);

  if (decoded.scheme !== "ED25519") {
    throw new Error(`Unsupported Sui private key scheme: ${decoded.scheme}. Use an ED25519 key.`);
  }

  const signer = Ed25519Keypair.fromSecretKey(decoded.secretKey);
  const client = new SuiGrpcClient({
    network: "testnet",
    baseUrl: suiTestnetFullnodeUrl
  });
  const transaction = createSuiTransaction(prepared.plan);

  try {
    const submitted = await client.signAndExecuteTransaction({
      signer,
      transaction,
      include: { effects: true, events: true, objectTypes: true }
    });
    const submittedTransaction = unwrapSuiTransactionResult(submitted);
    const raw = await client.waitForTransaction({
      digest: submittedTransaction.digest,
      include: { effects: true, events: true, objectTypes: true }
    });
    const rawTransaction = unwrapSuiTransactionResult(raw);
    const status = rawTransaction.status?.success ? "success" : "failure";
    const explorerUrl = buildSuiExplorerUrl(submittedTransaction.digest);

    if (status === "success") {
      return {
        ok: true,
        digest: submittedTransaction.digest,
        status: "success",
        explorerUrl,
        raw: rawTransaction
      };
    }

    return {
      ok: false,
      digest: submittedTransaction.digest,
      status,
      error: explainSuiTransactionError(
        stringifySuiExecutionError(rawTransaction.status?.error) ?? "Sui transaction failed."
      ),
      explorerUrl,
      raw: rawTransaction
    };
  } catch (error) {
    return {
      ok: false,
      error: explainSuiTransactionError(
        error instanceof Error ? error.message : "Sui transaction submission failed."
      )
    };
  }
}

export function mergeSuiActionResultIntoConfig(
  configValue: SuiDashboardConfig,
  result: SuiDashboardActionResult
): SuiDashboardConfig {
  if (!result.ok) {
    return configValue;
  }

  const policyId = getCreatedObjectId(result.raw, "::policy::AgentPolicy") ?? getEventObjectId(result.raw, "policy_id");
  const vaultId = getCreatedObjectId(result.raw, "::policy::AgentVault") ?? getEventObjectId(result.raw, "vault_id");
  const balanceManagerId = getEventObjectId(result.raw, "balance_manager_id");

  return normalizeSuiDashboardConfig({
    ...configValue,
    policyId: policyId ?? configValue.policyId,
    vaultId: vaultId ?? configValue.vaultId,
    balanceManagerId: balanceManagerId ?? configValue.balanceManagerId
  });
}

function getCreatedObjectId(result: unknown, objectTypeFragment: string) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const source = result as {
    objectChanges?: unknown;
    objectTypes?: unknown;
    effects?: { changedObjects?: unknown };
  };
  const objectChanges = Array.isArray(source.objectChanges) ? source.objectChanges : [];

  for (const change of objectChanges) {
    if (!change || typeof change !== "object") {
      continue;
    }

    const source = change as { type?: unknown; objectId?: unknown; objectType?: unknown };
    if (
      source.type === "created" &&
      typeof source.objectId === "string" &&
      typeof source.objectType === "string" &&
      source.objectType.includes(objectTypeFragment)
    ) {
      return source.objectId;
    }
  }

  const changedObjects = Array.isArray(source.effects?.changedObjects) ? source.effects.changedObjects : [];
  const objectTypes =
    source.objectTypes && typeof source.objectTypes === "object"
      ? (source.objectTypes as Record<string, unknown>)
      : {};

  for (const change of changedObjects) {
    if (!change || typeof change !== "object") {
      continue;
    }

    const changed = change as { objectId?: unknown; idOperation?: unknown };
    const objectType = typeof changed.objectId === "string" ? objectTypes[changed.objectId] : undefined;
    if (
      changed.idOperation === "Created" &&
      typeof changed.objectId === "string" &&
      typeof objectType === "string" &&
      objectType.includes(objectTypeFragment)
    ) {
      return changed.objectId;
    }
  }

  return null;
}

function getEventObjectId(result: unknown, key: string) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const events = (result as { events?: unknown }).events;
  if (!Array.isArray(events)) {
    return null;
  }

  for (const event of events) {
    if (!event || typeof event !== "object") {
      continue;
    }

    const eventSource = event as { parsedJson?: unknown; json?: unknown };
    const eventJson = eventSource.parsedJson ?? eventSource.json;
    if (!eventJson || typeof eventJson !== "object") {
      continue;
    }

    const value = (eventJson as Record<string, unknown>)[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }

  return null;
}

function buildSuiExplorerUrl(digest: string) {
  return `${suiExplorerBaseUrl}/txblock/${digest}?network=testnet`;
}

function unwrapSuiTransactionResult(result: unknown): {
  digest: string;
  status?: { success?: boolean; error?: unknown };
  events?: unknown[];
  objectChanges?: unknown[];
  objectTypes?: Record<string, string>;
  effects?: { changedObjects?: unknown[] };
} {
  if (!result || typeof result !== "object") {
    throw new Error("Sui transaction response was empty.");
  }

  const source = result as {
    Transaction?: unknown;
    FailedTransaction?: unknown;
    digest?: unknown;
    status?: unknown;
    events?: unknown;
    objectChanges?: unknown;
    objectTypes?: unknown;
    effects?: unknown;
  };
  const transaction =
    source.Transaction && typeof source.Transaction === "object"
      ? source.Transaction
      : source.FailedTransaction && typeof source.FailedTransaction === "object"
        ? source.FailedTransaction
        : source;

  const normalized = transaction as {
    digest?: unknown;
    status?: unknown;
    events?: unknown;
    objectChanges?: unknown;
    objectTypes?: unknown;
    effects?: unknown;
  };
  const digest = typeof normalized.digest === "string" ? normalized.digest : "";

  if (!digest) {
    throw new Error("Sui transaction response did not include a digest.");
  }

  return {
    digest,
    status:
      normalized.status && typeof normalized.status === "object"
        ? (normalized.status as { success?: boolean; error?: unknown })
        : undefined,
    events: Array.isArray(normalized.events) ? normalized.events : undefined,
    objectChanges: Array.isArray(normalized.objectChanges) ? normalized.objectChanges : undefined,
    objectTypes:
      normalized.objectTypes && typeof normalized.objectTypes === "object"
        ? (normalized.objectTypes as Record<string, string>)
        : undefined,
    effects:
      normalized.effects && typeof normalized.effects === "object"
        ? (normalized.effects as { changedObjects?: unknown[] })
        : undefined
  };
}

function stringifySuiExecutionError(error: unknown) {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && "command" in error && "message" in error) {
    const source = error as { command?: unknown; message?: unknown };
    return `Command ${String(source.command)} failed: ${String(source.message)}`;
  }

  return JSON.stringify(error);
}
