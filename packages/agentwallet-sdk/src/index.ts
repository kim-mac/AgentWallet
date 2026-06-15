import { Transaction } from "@mysten/sui/transactions";

export type AgentWalletOptions = {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
};

export type AgentWalletPaymentInput = {
  recipient: string;
  amount: string;
  tokenMint?: string;
  decimals?: number;
  policyPda?: string;
  programId?: string;
};

export type AgentWalletPaymentResult = {
  ok: true;
  cluster: "devnet";
  agent: string;
  policyPda: string;
  tokenMint: string;
  amount: string;
  signature: string;
  explorerUrl: string;
  agentTokenAccount: string;
  recipientTokenAccount: string;
};

export type AgentWalletPaymentSimulationResult = {
  ok: true;
  decision: "approved" | "requires_approval" | "rejected";
  code: string;
  message: string;
  humanMessage: string;
  agentMessage: string;
  suggestedAction: string;
  amount: string;
  amountUnits: string;
  tokenMint: string;
  recipient: string;
  policyPda: string;
  remainingBudgetUnits: string;
};

export type AgentWalletAgent = {
  id: string;
  owner: string;
  name: string;
  publicKey: string;
  apiKeyPrefix: string;
  programId: string;
  policyPda: string | null;
  tokenMint: string;
  decimals: number;
  telegramChatId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentWalletStatus = {
  readyForPayments: boolean;
  policyConfigured: boolean;
  tokenMintConfigured: boolean;
  telegramLinked: boolean;
  missing: Array<"policyPda" | "tokenMint">;
};

export type AgentWalletMe = {
  agent: AgentWalletAgent;
  status: AgentWalletStatus;
};

export type AgentWalletCapabilities = {
  ok: true;
  agent: AgentWalletAgent;
  policy: {
    pda: string;
    status: "active" | "paused";
    owner: string;
    programId: string;
    periodStartedAt: string;
    periodSeconds: string;
  };
  allowed: {
    recipients: string[];
    tokenMints: string[];
  };
  spend: {
    maxPerPaymentUnits: string;
    dailyBudgetUnits: string;
    spentInPeriodUnits: string;
    remainingBudgetUnits: string;
    approvalThresholdUnits: string;
  };
  canSpendNow: boolean;
  supportedActions: string[];
  nextAction: string;
};

export type X402PaymentRequired = {
  x402Version: string;
  accepts: Array<{
    scheme: string;
    network: string;
    asset: string;
    payTo: string;
    amount: string;
    decimals?: number;
    resource?: string;
  }>;
};

export type SuiMoveCallPlan = {
  kind: "moveCall";
  target: string;
  typeArguments?: string[];
  arguments: string[];
  resultName?: string;
};

export type SuiSplitCoinsPlan = {
  kind: "splitCoins";
  coin: "$gas" | string;
  amounts: string[];
  resultName: string;
};

export type SuiPtbPlan = {
  chain: "sui";
  commands: Array<SuiMoveCallPlan | SuiSplitCoinsPlan>;
};

export type SuiCreatePolicyPlanInput = {
  packageId: string;
  agent: string;
  maxBudget: string;
  allowedPoolId: string;
  expiresAtMs: string;
};

export type SuiCreateVaultPlanInput = {
  packageId: string;
  policyId: string;
  coinType: string;
  tokenTypeLabel: string;
};

export type SuiDepositVaultPlanInput = {
  packageId: string;
  vaultId: string;
  coinType: string;
  amount: string;
};

export type SuiCreateDeepBookBalanceManagerPlanInput = {
  deepBookPackageId: string;
};

export type SuiDeepBookActionPlanInput = {
  packageId: string;
  policyId: string;
  vaultId: string;
  coinType: string;
  amount: string;
  poolId: string;
  deepBookTarget: string;
  deepBookArguments: string[];
  clockId: string;
  action?: string;
};

export type SuiDeepBookLimitOrderPlanInput = {
  packageId: string;
  policyId: string;
  vaultId: string;
  coinType: string;
  amount: string;
  poolId: string;
  deepBookPackageId: string;
  balanceManagerId: string;
  baseAssetType: string;
  quoteAssetType: string;
  orderType: string;
  price: string;
  quantity: string;
  clockId: string;
  clientOrderId?: string;
  deepBookOrderType?: string;
  selfMatchingOption?: string;
  payWithDeep?: boolean;
  expireTimestamp?: string;
};

export type SuiRevokePolicyPlanInput = {
  packageId: string;
  policyId: string;
};

export type SuiTransactionBuilderLike<TArgument = unknown, TResult = unknown> = {
  gas?: any;
  object: (id: string) => TArgument;
  pure: {
    address: (value: string) => TArgument;
    u64: (value: string | number | bigint) => TArgument;
    u8?: (value: number) => TArgument;
    bool?: (value: boolean) => TArgument;
    vector?: (type: "u8", value: number[]) => TArgument;
  };
  splitCoins?: (coin: any, amounts: any[]) => TResult;
  moveCall: (input: {
    target: string;
    // The official Sui SDK uses a concrete TransactionArgument union here.
    // Keeping this seam permissive lets the adapter accept both the real SDK
    // and lightweight test builders without leaking SDK internals into our API.
    arguments: any[];
    typeArguments?: string[];
  }) => TResult;
};

export type SuiTransactionClientLike<TTransaction = unknown, TSigner = unknown> = {
  signAndExecuteTransaction: (input: {
    transaction: TTransaction;
    signer: TSigner;
    include: { effects: true; events: true };
  }) => Promise<SuiRawTransactionResult>;
  waitForTransaction?: (input: {
    digest: string;
    include: { effects: true; events: true };
  }) => Promise<SuiRawTransactionResult>;
};

export type SuiRawTransactionResult = {
  digest: string;
  effects?: {
    status?: {
      status?: string;
      error?: string;
    };
  } | null;
  events?: unknown[] | null;
};

export type SubmitSuiTransactionInput<TTransaction = unknown, TSigner = unknown> = {
  client: SuiTransactionClientLike<TTransaction, TSigner>;
  signer: TSigner;
  transaction: TTransaction;
  waitForConfirmation?: boolean;
  explorerBaseUrl?: string;
  network?: string;
};

export type SubmitSuiPlanInput<TSigner = unknown> = {
  client: SuiTransactionClientLike<Transaction, TSigner>;
  signer: TSigner;
  plan: SuiPtbPlan;
  waitForConfirmation?: boolean;
  explorerBaseUrl?: string;
  network?: string;
};

export type SubmitSuiTransactionResult =
  | {
      ok: true;
      digest: string;
      status: "success";
      explorerUrl: string;
      raw: SuiRawTransactionResult;
    }
  | {
      ok: false;
      digest?: string;
      status?: string;
      error: string;
      explorerUrl?: string;
      raw?: SuiRawTransactionResult;
    };

export class AgentWallet {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(options: AgentWalletOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetcher = options.fetch ?? fetch;
  }

  async pay(input: AgentWalletPaymentInput): Promise<AgentWalletPaymentResult> {
    const response = await this.fetcher(`${this.baseUrl}/api/agent-wallet/pay`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    });

    return parseJsonResponse<AgentWalletPaymentResult>(response);
  }

  async simulatePayment(input: AgentWalletPaymentInput): Promise<AgentWalletPaymentSimulationResult> {
    const response = await this.fetcher(`${this.baseUrl}/api/agent-wallet/simulate-payment`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    });

    return parseJsonResponse<AgentWalletPaymentSimulationResult>(response);
  }

  async getAgent(): Promise<AgentWalletMe> {
    const response = await this.fetcher(`${this.baseUrl}/api/agent-wallet/me`, {
      headers: { authorization: `Bearer ${this.apiKey}` }
    });
    return parseJsonResponse<AgentWalletMe>(response);
  }

  async getCapabilities(): Promise<AgentWalletCapabilities> {
    const response = await this.fetcher(`${this.baseUrl}/api/agent-wallet/capabilities`, {
      headers: { authorization: `Bearer ${this.apiKey}` }
    });
    return parseJsonResponse<AgentWalletCapabilities>(response);
  }

  async getAudit() {
    const response = await this.fetcher(`${this.baseUrl}/api/agent-wallet/audit`, {
      headers: { authorization: `Bearer ${this.apiKey}` }
    });
    return parseJsonResponse(response);
  }

  async fetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const firstResponse = await this.fetcher(input, init);

    if (firstResponse.status !== 402) {
      return firstResponse;
    }

    const encodedRequired = firstResponse.headers.get("PAYMENT-REQUIRED");
    if (!encodedRequired) {
      return firstResponse;
    }

    const paymentRequired = decodeHeader<X402PaymentRequired>(encodedRequired);
    const requirement = paymentRequired.accepts[0];

    if (!requirement) {
      return firstResponse;
    }

    const payment = await this.pay({
      recipient: requirement.payTo,
      amount: requirement.amount,
      tokenMint: requirement.asset,
      decimals: requirement.decimals
    });

    const paymentPayload = encodeHeader({
      x402Version: paymentRequired.x402Version,
      scheme: requirement.scheme,
      network: requirement.network,
      payload: {
        transaction: payment.signature,
        policyPda: payment.policyPda,
        agent: payment.agent
      }
    });

    return this.fetcher(input, {
      ...init,
      headers: {
        ...(headersToObject(init.headers)),
        "PAYMENT-SIGNATURE": paymentPayload
      }
    });
  }
}

export function buildSuiCreatePolicyPlan(input: SuiCreatePolicyPlanInput): SuiPtbPlan {
  requireValue(input.packageId, "packageId");
  requireValue(input.agent, "agent");
  requireValue(input.maxBudget, "maxBudget");
  requireValue(input.allowedPoolId, "allowedPoolId");
  requireValue(input.expiresAtMs, "expiresAtMs");

  return {
    chain: "sui",
    commands: [
      {
        kind: "moveCall",
        target: `${input.packageId}::policy::create_policy`,
        arguments: [input.agent, input.maxBudget, input.allowedPoolId, input.expiresAtMs]
      }
    ]
  };
}

export function buildSuiCreateVaultPlan(input: SuiCreateVaultPlanInput): SuiPtbPlan {
  requireValue(input.packageId, "packageId");
  requireValue(input.policyId, "policyId");
  requireValue(input.coinType, "coinType");
  requireValue(input.tokenTypeLabel, "tokenTypeLabel");

  return {
    chain: "sui",
    commands: [
      {
        kind: "moveCall",
        target: `${input.packageId}::policy::create_vault`,
        typeArguments: [input.coinType],
        arguments: [input.policyId, input.tokenTypeLabel]
      }
    ]
  };
}

export function buildSuiDepositVaultPlan(input: SuiDepositVaultPlanInput): SuiPtbPlan {
  requireValue(input.packageId, "packageId");
  requireValue(input.vaultId, "vaultId");
  requireValue(input.coinType, "coinType");
  requireValue(input.amount, "amount");

  return {
    chain: "sui",
    commands: [
      {
        kind: "splitCoins",
        coin: "$gas",
        amounts: [input.amount],
        resultName: "depositCoin"
      },
      {
        kind: "moveCall",
        target: `${input.packageId}::policy::deposit`,
        typeArguments: [input.coinType],
        arguments: [input.vaultId, "$depositCoin"]
      }
    ]
  };
}

export function buildSuiCreateDeepBookBalanceManagerPlan(
  input: SuiCreateDeepBookBalanceManagerPlanInput
): SuiPtbPlan {
  requireValue(input.deepBookPackageId, "deepBookPackageId");

  return {
    chain: "sui",
    commands: [
      {
        kind: "moveCall",
        target: `${input.deepBookPackageId}::balance_manager::new`,
        arguments: [],
        resultName: "balanceManager"
      },
      {
        kind: "moveCall",
        target: "0x2::transfer::public_share_object",
        typeArguments: [`${input.deepBookPackageId}::balance_manager::BalanceManager`],
        arguments: ["$balanceManager"]
      }
    ]
  };
}

export function buildSuiDeepBookActionPlan(input: SuiDeepBookActionPlanInput): SuiPtbPlan {
  requireValue(input.packageId, "packageId");
  requireValue(input.policyId, "policyId");
  requireValue(input.vaultId, "vaultId");
  requireValue(input.coinType, "coinType");
  requireValue(input.amount, "amount");
  requireValue(input.poolId, "poolId");
  requireValue(input.deepBookTarget, "deepBookTarget");
  requireValue(input.clockId, "clockId");

  return {
    chain: "sui",
    commands: [
      {
        kind: "moveCall",
        target: `${input.packageId}::policy::take_budgeted_coin`,
        typeArguments: [input.coinType],
        arguments: [
          input.policyId,
          input.vaultId,
          input.amount,
          input.poolId,
          input.action ?? "deepbook_order",
          input.clockId
        ],
        resultName: "agentwalletCoin"
      },
      {
        kind: "moveCall",
        target: input.deepBookTarget,
        arguments: input.deepBookArguments
      }
    ]
  };
}

export function buildSuiDeepBookLimitOrderPlan(input: SuiDeepBookLimitOrderPlanInput): SuiPtbPlan {
  requireValue(input.packageId, "packageId");
  requireValue(input.policyId, "policyId");
  requireValue(input.vaultId, "vaultId");
  requireValue(input.coinType, "coinType");
  requireValue(input.amount, "amount");
  requireValue(input.poolId, "poolId");
  requireValue(input.deepBookPackageId, "deepBookPackageId");
  requireValue(input.balanceManagerId, "balanceManagerId");
  requireValue(input.baseAssetType, "baseAssetType");
  requireValue(input.quoteAssetType, "quoteAssetType");
  requireValue(input.orderType, "orderType");
  requireValue(input.price, "price");
  requireValue(input.quantity, "quantity");
  requireValue(input.clockId, "clockId");
  const isBid = input.orderType.toLowerCase() === "bid";

  return {
    chain: "sui",
    commands: [
      {
        kind: "moveCall",
        target: `${input.packageId}::policy::take_budgeted_coin`,
        typeArguments: [input.coinType],
        arguments: [
          input.policyId,
          input.vaultId,
          input.amount,
          input.poolId,
          "deepbook_limit_order",
          input.clockId
        ],
        resultName: "agentwalletCoin"
      },
      {
        kind: "moveCall",
        target: `${input.deepBookPackageId}::balance_manager::deposit`,
        typeArguments: [input.coinType],
        arguments: [input.balanceManagerId, "$agentwalletCoin"]
      },
      {
        kind: "moveCall",
        target: `${input.deepBookPackageId}::balance_manager::generate_proof_as_owner`,
        arguments: [input.balanceManagerId],
        resultName: "deepbookTradeProof"
      },
      {
        kind: "moveCall",
        target: `${input.deepBookPackageId}::pool::place_limit_order`,
        typeArguments: [input.baseAssetType, input.quoteAssetType],
        arguments: [
          input.poolId,
          input.balanceManagerId,
          "$deepbookTradeProof",
          input.clientOrderId ?? "0",
          input.deepBookOrderType ?? "0",
          input.selfMatchingOption ?? "0",
          input.price,
          input.quantity,
          isBid ? "true" : "false",
          input.payWithDeep ? "true" : "false",
          input.expireTimestamp ?? "18446744073709551615",
          input.clockId
        ]
      }
    ]
  };
}

export function buildSuiRevokePolicyPlan(input: SuiRevokePolicyPlanInput): SuiPtbPlan {
  requireValue(input.packageId, "packageId");
  requireValue(input.policyId, "policyId");

  return {
    chain: "sui",
    commands: [
      {
        kind: "moveCall",
        target: `${input.packageId}::policy::revoke`,
        arguments: [input.policyId]
      }
    ]
  };
}

export function toSuiTransaction<TTransaction extends SuiTransactionBuilderLike>(
  transaction: TTransaction,
  plan: SuiPtbPlan
): TTransaction {
  const results = new Map<string, unknown>();

  for (const command of plan.commands) {
    if (command.kind === "splitCoins") {
      if (!transaction.splitCoins) {
        throw new Error("Sui transaction builder does not support splitCoins.");
      }

      const coin = toSuiCoinArgument(transaction, command.coin, results);
      const amounts = command.amounts.map((amount) => transaction.pure.u64(amount));
      const result = transaction.splitCoins(coin as never, amounts as never[]);
      results.set(command.resultName, result);
      continue;
    }

    const args = command.arguments.map((argument, index) =>
      toSuiArgument(transaction, command, argument, index, results)
    );
    const result = transaction.moveCall({
      target: command.target,
      arguments: args,
      typeArguments: command.typeArguments
    });

    if (command.resultName) {
      results.set(command.resultName, result);
    }
  }

  return transaction;
}

function toSuiCoinArgument<TTransaction extends SuiTransactionBuilderLike>(
  transaction: TTransaction,
  value: string,
  results: Map<string, unknown>
) {
  if (value === "$gas") {
    if (!transaction.gas) {
      throw new Error("Sui transaction builder does not expose a gas coin.");
    }
    return transaction.gas;
  }

  if (value.startsWith("$")) {
    const result = results.get(value.slice(1));
    if (!result) {
      throw new Error(`Unknown Sui PTB result reference: ${value}`);
    }
    return result;
  }

  return transaction.object(value);
}

export function createSuiTransaction(plan: SuiPtbPlan): Transaction {
  return toSuiTransaction(new Transaction(), plan);
}

export async function submitSuiTransaction<TTransaction, TSigner>(
  input: SubmitSuiTransactionInput<TTransaction, TSigner>
): Promise<SubmitSuiTransactionResult> {
  const network = input.network ?? "testnet";
  const explorerBaseUrl = input.explorerBaseUrl ?? "https://suiexplorer.com";

  try {
    const submitted = await input.client.signAndExecuteTransaction({
      transaction: input.transaction,
      signer: input.signer,
      include: { effects: true, events: true }
    });
    const raw =
      input.waitForConfirmation && input.client.waitForTransaction
        ? await input.client.waitForTransaction({
            digest: submitted.digest,
            include: { effects: true, events: true }
          })
        : submitted;
    const status = raw.effects?.status?.status ?? submitted.effects?.status?.status ?? "unknown";
    const explorerUrl = buildSuiExplorerUrl(explorerBaseUrl, submitted.digest, network);

    if (status === "success") {
      return {
        ok: true,
        digest: submitted.digest,
        status: "success",
        explorerUrl,
        raw
      };
    }

    return {
      ok: false,
      digest: submitted.digest,
      status,
      error: raw.effects?.status?.error ?? submitted.effects?.status?.error ?? "Sui transaction failed.",
      explorerUrl,
      raw
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Sui transaction submission failed."
    };
  }
}

export async function submitSuiPlan<TSigner>(
  input: SubmitSuiPlanInput<TSigner>
): Promise<SubmitSuiTransactionResult> {
  return submitSuiTransaction({
    client: input.client,
    signer: input.signer,
    transaction: createSuiTransaction(input.plan),
    waitForConfirmation: input.waitForConfirmation,
    explorerBaseUrl: input.explorerBaseUrl,
    network: input.network
  });
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : "AgentWallet request failed.");
  }

  return body as T;
}

function requireValue(value: string, name: string) {
  if (!value.trim()) {
    throw new Error(`${name} is required`);
  }
}

function buildSuiExplorerUrl(baseUrl: string, digest: string, network: string) {
  return `${baseUrl.replace(/\/$/, "")}/txblock/${digest}?network=${network}`;
}

function toSuiArgument(
  transaction: SuiTransactionBuilderLike,
  command: SuiMoveCallPlan,
  argument: string,
  index: number,
  results: Map<string, unknown>
) {
  if (argument.startsWith("$")) {
    const resultName = argument.slice(1);
    if (!results.has(resultName)) {
      throw new Error(`Unknown Sui PTB result reference: ${argument}`);
    }
    return results.get(resultName);
  }

  if (isPolicyCreateAgentAddress(command, index)) {
    return transaction.pure.address(argument);
  }

  if (isMoveIdArgument(command, index)) {
    return transaction.pure.address(argument);
  }

  if (isU8Argument(command, index, argument)) {
    return pureU8(transaction, argument);
  }

  if (isBoolArgument(command, index, argument)) {
    return pureBool(transaction, argument);
  }

  if (isU64Argument(command, index, argument)) {
    return transaction.pure.u64(argument);
  }

  if (isByteVectorArgument(command, index)) {
    return pureBytes(transaction, argument);
  }

  if (looksLikeObjectId(argument)) {
    return transaction.object(argument);
  }

  return pureBytes(transaction, argument);
}

function isPolicyCreateAgentAddress(command: SuiMoveCallPlan, index: number) {
  return command.target.endsWith("::policy::create_policy") && index === 0;
}

function isMoveIdArgument(command: SuiMoveCallPlan, index: number) {
  if (command.target.endsWith("::policy::create_policy")) {
    return index === 2;
  }

  if (command.target.endsWith("::policy::take_budgeted_coin")) {
    return index === 3;
  }

  return false;
}

function isU64Argument(command: SuiMoveCallPlan, index: number, argument: string) {
  if (!/^\d+$/.test(argument)) {
    return false;
  }

  if (command.target.endsWith("::policy::create_policy")) {
    return index === 1 || index === 3;
  }

  if (command.target.endsWith("::policy::take_budgeted_coin")) {
    return index === 2;
  }

  if (command.target.endsWith("::pool::place_limit_order")) {
    return index === 3 || index === 6 || index === 7 || index === 10;
  }

  return true;
}

function isU8Argument(command: SuiMoveCallPlan, index: number, argument: string) {
  return command.target.endsWith("::pool::place_limit_order") && /^\d+$/.test(argument) && (index === 4 || index === 5);
}

function isBoolArgument(command: SuiMoveCallPlan, index: number, argument: string) {
  return (
    command.target.endsWith("::pool::place_limit_order") &&
    (argument === "true" || argument === "false") &&
    (index === 8 || index === 9)
  );
}

function isByteVectorArgument(command: SuiMoveCallPlan, index: number) {
  if (command.target.endsWith("::policy::create_vault")) {
    return index === 1;
  }

  if (command.target.endsWith("::policy::take_budgeted_coin")) {
    return index === 4;
  }

  return false;
}

function pureBytes(transaction: SuiTransactionBuilderLike, value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (transaction.pure.vector) {
    return transaction.pure.vector("u8", bytes);
  }

  return bytes;
}

function pureU8(transaction: SuiTransactionBuilderLike, value: string) {
  if (transaction.pure.u8) {
    return transaction.pure.u8(Number(value));
  }

  return transaction.pure.u64(value);
}

function pureBool(transaction: SuiTransactionBuilderLike, value: string) {
  const boolValue = value === "true";
  if (transaction.pure.bool) {
    return transaction.pure.bool(boolValue);
  }

  return boolValue;
}

function looksLikeObjectId(value: string) {
  return value.startsWith("0x");
}

function encodeHeader(value: unknown) {
  return btoa(JSON.stringify(value));
}

function decodeHeader<T>(value: string): T {
  return JSON.parse(atob(value)) as T;
}

function headersToObject(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers;
}
