import {
  buildSuiCreatePolicyPlan,
  buildSuiCreateVaultPlan,
  buildSuiDepositVaultPlan,
  buildSuiRevokePolicyPlan,
  submitSuiPlan,
  type SubmitSuiTransactionResult,
  type SuiPtbPlan,
  type SuiTransactionClientLike
} from "./index";
import { summarizeSuiAgentWalletActivity } from "./sui-events";

export type SuiPolicyBootstrapConfig = {
  packageId: string;
  agent: string;
  maxBudget: string;
  allowedPoolId: string;
  expiresAtMs: string;
  network: string;
};

export type SuiVaultBootstrapConfig = {
  packageId: string;
  policyId: string;
  coinType: string;
  tokenTypeLabel: string;
  network: string;
};

export type SuiVaultDepositConfig = {
  packageId: string;
  vaultId: string;
  coinType: string;
  amount: string;
  network: string;
};

export type SuiPolicyRevokeConfig = {
  packageId: string;
  policyId: string;
  network: string;
};

export type SuiBootstrapEnv = Record<string, string | undefined>;

export type RunSuiPlanInput<TSigner> = {
  client: SuiTransactionClientLike<import("@mysten/sui/transactions").Transaction, TSigner>;
  signer: TSigner;
  plan: SuiPtbPlan;
  network: string;
};

const POLICY_BOOTSTRAP_ENV = [
  "SUI_PACKAGE_ID",
  "SUI_AGENT_ADDRESS",
  "SUI_MAX_BUDGET",
  "SUI_ALLOWED_POOL_ID",
  "SUI_EXPIRES_AT_MS"
] as const;

const VAULT_BOOTSTRAP_ENV = [
  "SUI_PACKAGE_ID",
  "SUI_POLICY_ID",
  "SUI_COIN_TYPE",
  "SUI_TOKEN_TYPE_LABEL"
] as const;

const VAULT_DEPOSIT_ENV = [
  "SUI_PACKAGE_ID",
  "SUI_VAULT_ID",
  "SUI_COIN_TYPE",
  "SUI_DEPOSIT_AMOUNT"
] as const;

const REVOKE_ENV = ["SUI_PACKAGE_ID", "SUI_POLICY_ID"] as const;

export function parseSuiPolicyBootstrapConfig(env: SuiBootstrapEnv): SuiPolicyBootstrapConfig {
  assertRequiredEnv(env, POLICY_BOOTSTRAP_ENV, "Sui policy bootstrap");

  return {
    packageId: env.SUI_PACKAGE_ID!,
    agent: env.SUI_AGENT_ADDRESS!,
    maxBudget: env.SUI_MAX_BUDGET!,
    allowedPoolId: env.SUI_ALLOWED_POOL_ID!,
    expiresAtMs: env.SUI_EXPIRES_AT_MS!,
    network: parseNetwork(env)
  };
}

export function parseSuiVaultBootstrapConfig(env: SuiBootstrapEnv): SuiVaultBootstrapConfig {
  assertRequiredEnv(env, VAULT_BOOTSTRAP_ENV, "Sui vault bootstrap");

  return {
    packageId: env.SUI_PACKAGE_ID!,
    policyId: env.SUI_POLICY_ID!,
    coinType: env.SUI_COIN_TYPE!,
    tokenTypeLabel: env.SUI_TOKEN_TYPE_LABEL!,
    network: parseNetwork(env)
  };
}

export function parseSuiVaultDepositConfig(env: SuiBootstrapEnv): SuiVaultDepositConfig {
  assertRequiredEnv(env, VAULT_DEPOSIT_ENV, "Sui vault deposit");

  return {
    packageId: env.SUI_PACKAGE_ID!,
    vaultId: env.SUI_VAULT_ID!,
    coinType: env.SUI_COIN_TYPE!,
    amount: env.SUI_DEPOSIT_AMOUNT!,
    network: parseNetwork(env)
  };
}

export function parseSuiPolicyRevokeConfig(env: SuiBootstrapEnv): SuiPolicyRevokeConfig {
  assertRequiredEnv(env, REVOKE_ENV, "Sui policy revoke");

  return {
    packageId: env.SUI_PACKAGE_ID!,
    policyId: env.SUI_POLICY_ID!,
    network: parseNetwork(env)
  };
}

export function buildSuiPolicyBootstrapPlan(config: SuiPolicyBootstrapConfig): SuiPtbPlan {
  return buildSuiCreatePolicyPlan({
    packageId: config.packageId,
    agent: config.agent,
    maxBudget: config.maxBudget,
    allowedPoolId: config.allowedPoolId,
    expiresAtMs: config.expiresAtMs
  });
}

export function buildSuiVaultBootstrapPlan(config: SuiVaultBootstrapConfig): SuiPtbPlan {
  return buildSuiCreateVaultPlan({
    packageId: config.packageId,
    policyId: config.policyId,
    coinType: config.coinType,
    tokenTypeLabel: config.tokenTypeLabel
  });
}

export function buildSuiVaultDepositPlan(config: SuiVaultDepositConfig): SuiPtbPlan {
  return buildSuiDepositVaultPlan({
    packageId: config.packageId,
    vaultId: config.vaultId,
    coinType: config.coinType,
    amount: config.amount
  });
}

export function buildSuiPolicyRevokePlan(config: SuiPolicyRevokeConfig): SuiPtbPlan {
  return buildSuiRevokePolicyPlan({
    packageId: config.packageId,
    policyId: config.policyId
  });
}

export async function runSuiPlan<TSigner>(
  input: RunSuiPlanInput<TSigner>
): Promise<SubmitSuiTransactionResult> {
  return submitSuiPlan({
    client: input.client,
    signer: input.signer,
    plan: input.plan,
    waitForConfirmation: true,
    network: input.network
  });
}

export function formatSuiBootstrapResult(action: string, result: SubmitSuiTransactionResult): string {
  if (result.ok) {
    const summary = summarizeSuiAgentWalletActivity(result.raw);
    return [
      `Sui ${action} transaction submitted.`,
      `Digest: ${result.digest}`,
      `Status: ${result.status}`,
      `Explorer: ${result.explorerUrl}`,
      summary.objectIds.policyIds.length > 0
        ? `Policy IDs: ${summary.objectIds.policyIds.join(", ")}`
        : undefined,
      summary.objectIds.vaultIds.length > 0
        ? `Vault IDs: ${summary.objectIds.vaultIds.join(", ")}`
        : undefined,
      summary.events.length > 0
        ? `AgentWallet events: ${summary.events.map((event) => event.kind).join(", ")}`
        : undefined,
      "",
      "Check transaction object changes/events for new AgentWallet object IDs."
    ]
      .filter((line) => line !== undefined)
      .join("\n");
  }

  return [
    `Sui ${action} transaction failed.`,
    result.digest ? `Digest: ${result.digest}` : undefined,
    result.status ? `Status: ${result.status}` : undefined,
    `Error: ${result.error}`,
    result.explorerUrl ? `Explorer: ${result.explorerUrl}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
}

function assertRequiredEnv(
  env: SuiBootstrapEnv,
  names: readonly string[],
  label: string
) {
  const missing = names.filter((name) => !env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing ${label} env: ${missing.join(", ")}`);
  }
}

function parseNetwork(env: SuiBootstrapEnv) {
  return env.SUI_NETWORK?.trim() || "testnet";
}
