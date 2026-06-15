import {
  buildSuiCreateDeepBookBalanceManagerPlan,
  submitSuiPlan,
  type SubmitSuiTransactionResult,
  type SuiPtbPlan,
  type SuiTransactionClientLike
} from "./index";

export type SuiDeepBookBalanceManagerConfig = {
  deepBookPackageId: string;
  network: string;
};

export type SuiDeepBookEnv = Record<string, string | undefined>;

export type RunSuiDeepBookBalanceManagerInput<TSigner> = {
  config: SuiDeepBookBalanceManagerConfig;
  client: SuiTransactionClientLike<import("@mysten/sui/transactions").Transaction, TSigner>;
  signer: TSigner;
};

export function parseSuiDeepBookBalanceManagerConfig(
  env: SuiDeepBookEnv
): SuiDeepBookBalanceManagerConfig {
  const deepBookPackageId = env.SUI_DEEPBOOK_PACKAGE_ID?.trim();

  if (!deepBookPackageId) {
    throw new Error("Missing Sui DeepBook env: SUI_DEEPBOOK_PACKAGE_ID");
  }

  return {
    deepBookPackageId,
    network: env.SUI_NETWORK?.trim() || "testnet"
  };
}

export function buildSuiDeepBookBalanceManagerPlan(
  config: SuiDeepBookBalanceManagerConfig
): SuiPtbPlan {
  return buildSuiCreateDeepBookBalanceManagerPlan({
    deepBookPackageId: config.deepBookPackageId
  });
}

export async function runSuiDeepBookBalanceManager<TSigner>(
  input: RunSuiDeepBookBalanceManagerInput<TSigner>
): Promise<SubmitSuiTransactionResult> {
  return submitSuiPlan({
    client: input.client,
    signer: input.signer,
    plan: buildSuiDeepBookBalanceManagerPlan(input.config),
    waitForConfirmation: true,
    network: input.config.network
  });
}

export function formatSuiDeepBookBalanceManagerResult(result: SubmitSuiTransactionResult): string {
  if (result.ok) {
    const balanceManagerId = findBalanceManagerId(result.raw);
    return [
      "Sui DeepBook balance manager submitted.",
      `Digest: ${result.digest}`,
      `Status: ${result.status}`,
      `Explorer: ${result.explorerUrl}`,
      balanceManagerId ? `BalanceManager ID: ${balanceManagerId}` : undefined
    ]
      .filter((line) => line !== undefined)
      .join("\n");
  }

  return [
    "Sui DeepBook balance manager failed.",
    result.digest ? `Digest: ${result.digest}` : undefined,
    result.status ? `Status: ${result.status}` : undefined,
    `Error: ${result.error}`,
    result.explorerUrl ? `Explorer: ${result.explorerUrl}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
}

function findBalanceManagerId(result: { events?: unknown[] | null }) {
  const event = result.events?.find((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }

    const type = (candidate as { type?: unknown }).type;
    return typeof type === "string" && type.endsWith("::balance_manager::BalanceManagerEvent");
  });

  if (!event || typeof event !== "object") {
    return null;
  }

  const parsedJson = (event as { parsedJson?: unknown }).parsedJson;
  if (!parsedJson || typeof parsedJson !== "object") {
    return null;
  }

  const id = (parsedJson as { balance_manager_id?: unknown }).balance_manager_id;
  return typeof id === "string" && id ? id : null;
}
