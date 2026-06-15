import {
  buildSuiDeepBookLimitOrderPlan,
  submitSuiPlan,
  type SubmitSuiTransactionResult,
  type SuiPtbPlan,
  type SuiTransactionClientLike
} from "./index";
import { summarizeSuiAgentWalletActivity } from "./sui-events";

export type SuiDeepBookDemoConfig = {
  packageId: string;
  policyId: string;
  vaultId: string;
  coinType: string;
  orderAmount: string;
  deepBookPackageId: string;
  deepBookPoolId: string;
  deepBookBaseType: string;
  deepBookQuoteType: string;
  balanceManagerId: string;
  orderType: string;
  orderPrice: string;
  orderQuantity: string;
  orderExpireTimestamp?: string;
  clockId: string;
  network: string;
};

export type SuiDeepBookDemoEnv = Record<string, string | undefined>;

export type RunSuiDeepBookDemoInput<TSigner> = {
  config: SuiDeepBookDemoConfig;
  client: SuiTransactionClientLike<import("@mysten/sui/transactions").Transaction, TSigner>;
  signer: TSigner;
};

const REQUIRED_ENV = [
  "SUI_PACKAGE_ID",
  "SUI_POLICY_ID",
  "SUI_VAULT_ID",
  "SUI_COIN_TYPE",
  "SUI_ORDER_AMOUNT",
  "SUI_DEEPBOOK_PACKAGE_ID",
  "SUI_DEEPBOOK_POOL_ID",
  "SUI_DEEPBOOK_BASE_TYPE",
  "SUI_DEEPBOOK_QUOTE_TYPE",
  "SUI_BALANCE_MANAGER_ID",
  "SUI_ORDER_PRICE",
  "SUI_ORDER_QUANTITY",
  "SUI_CLOCK_ID"
] as const;

export function parseSuiDeepBookDemoConfig(env: SuiDeepBookDemoEnv): SuiDeepBookDemoConfig {
  const missing = REQUIRED_ENV.filter((name) => !env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing Sui demo env: ${missing.join(", ")}`);
  }

  return {
    packageId: env.SUI_PACKAGE_ID!,
    policyId: env.SUI_POLICY_ID!,
    vaultId: env.SUI_VAULT_ID!,
    coinType: env.SUI_COIN_TYPE!,
    orderAmount: env.SUI_ORDER_AMOUNT!,
    deepBookPackageId: env.SUI_DEEPBOOK_PACKAGE_ID!,
    deepBookPoolId: env.SUI_DEEPBOOK_POOL_ID!,
    deepBookBaseType: env.SUI_DEEPBOOK_BASE_TYPE!,
    deepBookQuoteType: env.SUI_DEEPBOOK_QUOTE_TYPE!,
    balanceManagerId: env.SUI_BALANCE_MANAGER_ID!,
    orderType: env.SUI_ORDER_TYPE?.trim() || "bid",
    orderPrice: env.SUI_ORDER_PRICE!,
    orderQuantity: env.SUI_ORDER_QUANTITY!,
    orderExpireTimestamp: env.SUI_ORDER_EXPIRE_TIMESTAMP?.trim() || undefined,
    clockId: env.SUI_CLOCK_ID!,
    network: env.SUI_NETWORK?.trim() || "testnet"
  };
}

export function buildSuiDeepBookDemoPlan(config: SuiDeepBookDemoConfig): SuiPtbPlan {
  return buildSuiDeepBookLimitOrderPlan({
    packageId: config.packageId,
    policyId: config.policyId,
    vaultId: config.vaultId,
    coinType: config.coinType,
    amount: config.orderAmount,
    poolId: config.deepBookPoolId,
    deepBookPackageId: config.deepBookPackageId,
    balanceManagerId: config.balanceManagerId,
    baseAssetType: config.deepBookBaseType,
    quoteAssetType: config.deepBookQuoteType,
    orderType: config.orderType,
    price: config.orderPrice,
    quantity: config.orderQuantity,
    expireTimestamp: config.orderExpireTimestamp,
    clockId: config.clockId
  });
}

export async function runSuiDeepBookDemo<TSigner>(
  input: RunSuiDeepBookDemoInput<TSigner>
): Promise<SubmitSuiTransactionResult> {
  return submitSuiPlan({
    client: input.client,
    signer: input.signer,
    plan: buildSuiDeepBookDemoPlan(input.config),
    waitForConfirmation: true,
    network: input.config.network
  });
}

export function formatSuiDemoResult(result: SubmitSuiTransactionResult): string {
  if (result.ok) {
    const summary = summarizeSuiAgentWalletActivity(result.raw);
    return [
      "Sui DeepBook order submitted.",
      `Digest: ${result.digest}`,
      `Status: ${result.status}`,
      `Explorer: ${result.explorerUrl}`,
      summary.events.length > 0
        ? `AgentWallet events: ${summary.events.map((event) => event.kind).join(", ")}`
        : undefined
    ]
      .filter((line) => line !== undefined)
      .join("\n");
  }

  return [
    "Sui DeepBook order failed.",
    result.digest ? `Digest: ${result.digest}` : undefined,
    result.status ? `Status: ${result.status}` : undefined,
    `Error: ${result.error}`,
    result.explorerUrl ? `Explorer: ${result.explorerUrl}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
}
