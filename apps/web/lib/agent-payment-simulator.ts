import { PublicKey } from "@solana/web3.js";
import {
  getAgentSpendErrorDetails,
  type AgentSpendErrorCode,
  type AgentSpendErrorDetails
} from "./anchor-errors";
import {
  AgentExecutionError,
  executePaymentSchema,
  type ExecutePaymentInput
} from "./agent-executor";
import { getAgentByApiKey } from "./agent-provisioning";
import type { ProvisionedAgentRecord } from "./provisioning-store";
import { createDevnetConnection } from "./solana-devnet";

export type DecodedAgentPolicyAccount = {
  owner: string;
  agent: string;
  tokenMint: string;
  maxPerPayment: bigint;
  dailyBudget: bigint;
  approvalThreshold: bigint;
  spentInPeriod: bigint;
  periodStartedAt: bigint;
  periodSeconds: bigint;
  allowedRecipients: string[];
  allowedTokenMints: string[];
  paused: boolean;
  bump: number;
};

export type AgentPaymentSimulationDecision = "approved" | "requires_approval" | "rejected";

export type AgentPaymentSimulationResult = {
  ok: true;
  decision: AgentPaymentSimulationDecision;
  code: "PAYMENT_ALLOWED" | AgentSpendErrorCode;
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

export function simulatePaymentAgainstPolicy(
  agentRecord: ProvisionedAgentRecord,
  policy: DecodedAgentPolicyAccount,
  input: ExecutePaymentInput
): AgentPaymentSimulationResult {
  const body = executePaymentSchema.parse(input);
  const tokenMint = body.tokenMint ?? agentRecord.tokenMint;
  const decimals = body.decimals ?? agentRecord.decimals;
  const amountUnits = tokenAmountToUnits(body.amount, decimals);
  const remainingBudget =
    policy.dailyBudget > policy.spentInPeriod ? policy.dailyBudget - policy.spentInPeriod : 0n;
  const base = {
    amount: body.amount,
    amountUnits: amountUnits.toString(),
    tokenMint,
    recipient: body.recipient,
    policyPda: body.policyPda ?? agentRecord.policyPda ?? "",
    remainingBudgetUnits: remainingBudget.toString()
  };

  if (policy.agent !== agentRecord.publicKey) {
    return rejected(6003, base);
  }

  if (policy.paused) {
    return rejected(6005, base);
  }

  if (!policy.allowedRecipients.includes(body.recipient)) {
    return rejected(6006, base);
  }

  if (!policy.allowedTokenMints.includes(tokenMint)) {
    return rejected(6015, base);
  }

  if (amountUnits > policy.maxPerPayment) {
    return rejected(6007, base);
  }

  if (policy.spentInPeriod + amountUnits > policy.dailyBudget) {
    return rejected(6008, base);
  }

  if (amountUnits > policy.approvalThreshold) {
    return withDetails("requires_approval", getProgramDetails(6009), base);
  }

  return {
    ok: true,
    decision: "approved",
    code: "PAYMENT_ALLOWED",
    message: "Payment is allowed by the active policy.",
    humanMessage: "This payment is allowed by the active policy.",
    agentMessage: "You can execute this payment through AgentWallet.",
    suggestedAction: "execute_payment",
    ...base
  };
}

export async function simulateProvisionedAgentPayment(
  apiKey: string,
  input: ExecutePaymentInput
): Promise<AgentPaymentSimulationResult> {
  const agentRecord = await getAgentByApiKey(apiKey);

  if (!agentRecord) {
    throw new AgentExecutionError("Invalid agent API key.", 401, {
      code: "INVALID_AGENT_API_KEY",
      message: "Agent API key is missing or invalid.",
      humanMessage: "Invalid agent API key.",
      agentMessage: "Use a valid AgentWallet API key from the selected hosted agent.",
      suggestedAction: "rotate_or_update_agent_api_key"
    });
  }

  const body = executePaymentSchema.parse(input);
  const policyPda = body.policyPda ?? agentRecord.policyPda;

  if (!policyPda) {
    throw new AgentExecutionError("This agent does not have an initialized policy PDA yet.", 400, {
      code: "POLICY_NOT_INITIALIZED",
      message: "Agent policy PDA is not initialized.",
      humanMessage: "This agent does not have an initialized policy PDA yet.",
      agentMessage: "Ask the owner to initialize or update the on-chain policy before requesting payments.",
      suggestedAction: "request_owner_policy_update"
    });
  }

  const connection = createDevnetConnection();
  const account = await connection.getAccountInfo(new PublicKey(policyPda), "confirmed");

  if (!account) {
    throw new AgentExecutionError("Policy account was not found on Solana devnet.", 404, {
      code: "POLICY_NOT_INITIALIZED",
      message: "Policy account was not found on Solana devnet.",
      humanMessage: "This policy account has not been initialized on devnet.",
      agentMessage: "Ask the owner to initialize the on-chain policy before requesting payments.",
      suggestedAction: "request_owner_policy_update"
    });
  }

  const policy = decodeAgentPolicyAccount(account.data);
  return simulatePaymentAgainstPolicy(agentRecord, policy, { ...body, policyPda });
}

export function decodeAgentPolicyAccount(data: Buffer | Uint8Array): DecodedAgentPolicyAccount {
  const reader = new PolicyAccountReader(Buffer.from(data).subarray(8));

  return {
    owner: reader.readPublicKey(),
    agent: reader.readPublicKey(),
    tokenMint: reader.readPublicKey(),
    maxPerPayment: reader.readU64(),
    dailyBudget: reader.readU64(),
    approvalThreshold: reader.readU64(),
    spentInPeriod: reader.readU64(),
    periodStartedAt: reader.readI64(),
    periodSeconds: reader.readI64(),
    allowedRecipients: reader.readPublicKeyVec(),
    allowedTokenMints: reader.readPublicKeyVec(),
    paused: reader.readBool(),
    bump: reader.readU8()
  };
}

function rejected(
  customCode: number,
  base: Pick<
    AgentPaymentSimulationResult,
    "amount" | "amountUnits" | "tokenMint" | "recipient" | "policyPda" | "remainingBudgetUnits"
  >
) {
  return withDetails("rejected", getProgramDetails(customCode), base);
}

function withDetails(
  decision: AgentPaymentSimulationDecision,
  details: AgentSpendErrorDetails,
  base: Pick<
    AgentPaymentSimulationResult,
    "amount" | "amountUnits" | "tokenMint" | "recipient" | "policyPda" | "remainingBudgetUnits"
  >
): AgentPaymentSimulationResult {
  return {
    ok: true,
    decision,
    code: details.code,
    message: details.message,
    humanMessage: details.humanMessage,
    agentMessage: details.agentMessage,
    suggestedAction: details.suggestedAction,
    ...base
  };
}

function getProgramDetails(customCode: number) {
  return getAgentSpendErrorDetails({ InstructionError: [0, { Custom: customCode }] });
}

function tokenAmountToUnits(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    throw new Error("Token decimals must be an integer from 0 to 9.");
  }

  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Payment amount must be a positive token amount.");
  }

  const [whole, fractional = ""] = trimmed.split(".");
  if (fractional.length > decimals) {
    throw new Error(`Payment amount has more than ${decimals} decimal places.`);
  }

  const units = `${whole}${fractional.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/, "");
  const parsed = BigInt(units || "0");

  if (parsed <= 0n) {
    throw new Error("Payment amount must be greater than zero.");
  }

  return parsed;
}

class PolicyAccountReader {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  readPublicKey() {
    const value = new PublicKey(this.readBytes(32));
    return value.toBase58();
  }

  readPublicKeyVec() {
    const length = this.readU32();
    return Array.from({ length }, () => this.readPublicKey());
  }

  readU64() {
    const value = this.buffer.readBigUInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  readI64() {
    const value = this.buffer.readBigInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  readU8() {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readBool() {
    return this.readU8() !== 0;
  }

  private readU32() {
    const value = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  private readBytes(length: number) {
    const end = this.offset + length;
    const value = this.buffer.subarray(this.offset, end);
    this.offset = end;
    return value;
  }
}
