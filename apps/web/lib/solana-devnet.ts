import {
  clusterApiUrl,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import type { AgentPolicy } from "@agentspend/shared";
import { Buffer } from "buffer";

export const devnetCluster = "devnet";
export const devnetRpcUrl = clusterApiUrl(devnetCluster);
export const solanaExplorerBaseUrl = "https://explorer.solana.com";
export const defaultAgentSpendProgramId = "9eZMFa68NmfF4YNz5cF96AsJukbRzvvP1TDktN4cfbDU";
export const defaultDevnetUsdcMint = "6XigBN521xmNyFV4DDgLpfGVsXTP3JstsaSTkbpNRXgk";
export const memoProgramId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const agentSpendSeed = "policy";

const initializePolicyDiscriminator = Buffer.from([9, 186, 86, 225, 129, 162, 231, 56]);
const updatePolicyDiscriminator = Buffer.from([212, 245, 246, 7, 163, 151, 18, 57]);
const pausePolicyDiscriminator = Buffer.from([162, 125, 168, 118, 196, 17, 113, 165]);
const resumePolicyDiscriminator = Buffer.from([19, 5, 135, 187, 83, 243, 251, 235]);
const executePaymentDiscriminator = Buffer.from([86, 4, 7, 7, 120, 139, 232, 139]);

export type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect: () => Promise<{ publicKey: PublicKey }>;
  signAndSendTransaction: (
    transaction: Transaction
  ) => Promise<{ signature: string } | string>;
  signMessage?: (message: Uint8Array, display?: "utf8" | "hex") => Promise<{ signature: Uint8Array }>;
};

export type DevnetPolicyAnchor = {
  type: "agentspend.policy.v1";
  cluster: typeof devnetCluster;
  policyId: string;
  owner: string;
  agentId: string;
  tokenMint: string;
  maxPerPaymentUsd: number;
  dailyBudgetUsd: number;
  approvalThresholdUsd: number;
  allowedVendors: string[];
  allowedCategories: string[];
  allowedRecipients: string[];
  publishedAt: string;
};

export type OnchainPolicyConfig = {
  programId: string;
  agent: string;
  tokenMint: string;
  allowedRecipients: string;
  periodSeconds: string;
};

export type AnchorPolicyArgs = {
  agent: PublicKey;
  tokenMint: PublicKey;
  maxPerPayment: bigint;
  dailyBudget: bigint;
  approvalThreshold: bigint;
  periodSeconds: bigint;
  allowedRecipients: PublicKey[];
};

export type AnchorPolicyInstructionKind =
  | "initialize_policy"
  | "update_policy"
  | "pause_policy"
  | "resume_policy";

export type ExecutePaymentConfig = {
  programId: string;
  policyPda: string;
  recipient: string;
  tokenMint: string;
  amount: string;
  decimals: string;
};

export function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") {
    return null;
  }

  const maybeWindow = window as Window & {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  };

  return maybeWindow.phantom?.solana ?? maybeWindow.solana ?? null;
}

export function createDevnetConnection(): Connection {
  return new Connection(devnetRpcUrl, "confirmed");
}

export function parsePublicKey(value: string, label: string): PublicKey {
  try {
    return new PublicKey(value.trim());
  } catch {
    throw new Error(`${label} must be a valid Solana public key.`);
  }
}

export function parseRecipientPublicKeys(value: string): PublicKey[] {
  const recipients = value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => parsePublicKey(item, "Allowed recipient"));

  if (recipients.length > 12) {
    throw new Error("Allowed recipients cannot exceed 12 addresses.");
  }

  return recipients;
}

export function derivePolicyPda(
  programId: PublicKey,
  owner: PublicKey,
  agent: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(agentSpendSeed), owner.toBuffer(), agent.toBuffer()],
    programId
  );
}

export function buildAnchorPolicyArgs(
  policy: AgentPolicy,
  config: OnchainPolicyConfig
): AnchorPolicyArgs {
  return {
    agent: parsePublicKey(config.agent, "Agent"),
    tokenMint: parsePublicKey(config.tokenMint, "Token mint"),
    maxPerPayment: usdToTokenUnits(policy.maxPerPaymentUsd),
    dailyBudget: usdToTokenUnits(policy.dailyBudgetUsd),
    approvalThreshold: usdToTokenUnits(policy.approvalThresholdUsd),
    periodSeconds: BigInt(Number(config.periodSeconds) || 86_400),
    allowedRecipients: parseRecipientPublicKeys(config.allowedRecipients)
  };
}

export function buildInitializePolicyInstruction(
  programId: PublicKey,
  owner: PublicKey,
  policyPda: PublicKey,
  args: AnchorPolicyArgs
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: policyPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    data: Buffer.concat([initializePolicyDiscriminator, encodeInitializePolicyArgs(args)])
  });
}

export function buildUpdatePolicyInstruction(
  programId: PublicKey,
  owner: PublicKey,
  policyPda: PublicKey,
  args: AnchorPolicyArgs
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: policyPda, isSigner: false, isWritable: true }
    ],
    data: Buffer.concat([updatePolicyDiscriminator, encodeUpdatePolicyArgs(args)])
  });
}

export function buildOwnerPolicyActionInstruction(
  kind: Extract<AnchorPolicyInstructionKind, "pause_policy" | "resume_policy">,
  programId: PublicKey,
  owner: PublicKey,
  policyPda: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: policyPda, isSigner: false, isWritable: true }
    ],
    data: kind === "pause_policy" ? pausePolicyDiscriminator : resumePolicyDiscriminator
  });
}

export async function buildAnchorPolicyTransaction(
  connection: Connection,
  owner: PublicKey,
  instruction: TransactionInstruction
): Promise<{ transaction: Transaction; blockhash: string; lastValidBlockHeight: number }> {
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: owner,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }).add(instruction);

  return {
    transaction,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  };
}

export async function buildExecutePaymentTransaction(
  connection: Connection,
  agent: PublicKey,
  config: ExecutePaymentConfig
): Promise<{
  transaction: Transaction;
  blockhash: string;
  lastValidBlockHeight: number;
  agentTokenAccount: PublicKey;
  recipientTokenAccount: PublicKey;
}> {
  const programId = parsePublicKey(config.programId, "Program ID");
  const policyPda = parsePublicKey(config.policyPda, "Policy PDA");
  const recipient = parsePublicKey(config.recipient, "Payment recipient");
  const mint = parsePublicKey(config.tokenMint, "Token mint");
  const decimals = Number(config.decimals);
  const amount = tokenAmountToUnits(config.amount, decimals);
  const agentTokenAccount = getAssociatedTokenAddressSync(mint, agent, false, TOKEN_PROGRAM_ID);
  const recipientTokenAccount = getAssociatedTokenAddressSync(
    mint,
    recipient,
    true,
    TOKEN_PROGRAM_ID
  );
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const instructions: TransactionInstruction[] = [];

  await assertTokenAccountExists(connection, agentTokenAccount, "Agent token account");

  if (!(await tokenAccountExists(connection, recipientTokenAccount))) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        agent,
        recipientTokenAccount,
        recipient,
        mint,
        TOKEN_PROGRAM_ID
      )
    );
  }

  instructions.push(
    buildExecutePaymentInstruction({
      programId,
      agent,
      policyPda,
      recipient,
      agentTokenAccount,
      recipientTokenAccount,
      mint,
      amount,
      decimals
    })
  );

  const transaction = new Transaction({
    feePayer: agent,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }).add(...instructions);

  return {
    transaction,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    agentTokenAccount,
    recipientTokenAccount
  };
}

export function buildPolicyAnchorPayload(
  policy: AgentPolicy,
  owner: string,
  publishedAt = new Date().toISOString()
): DevnetPolicyAnchor {
  return {
    type: "agentspend.policy.v1",
    cluster: devnetCluster,
    policyId: policy.id,
    owner,
    agentId: policy.agentId,
    tokenMint: policy.tokenMint,
    maxPerPaymentUsd: policy.maxPerPaymentUsd,
    dailyBudgetUsd: policy.dailyBudgetUsd,
    approvalThresholdUsd: policy.approvalThresholdUsd,
    allowedVendors: policy.allowedVendors,
    allowedCategories: policy.allowedCategories,
    allowedRecipients: policy.allowedRecipients,
    publishedAt
  };
}

export async function buildPolicyMemoTransaction(
  connection: Connection,
  owner: PublicKey,
  payload: DevnetPolicyAnchor
): Promise<{ transaction: Transaction; blockhash: string; lastValidBlockHeight: number }> {
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const data = Buffer.from(JSON.stringify(payload), "utf8");

  const transaction = new Transaction({
    feePayer: owner,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }).add(
    new TransactionInstruction({
      programId: memoProgramId,
      keys: [{ pubkey: owner, isSigner: true, isWritable: false }],
      data
    })
  );

  return {
    transaction,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  };
}

export function getExplorerTransactionUrl(signature: string): string {
  return `${solanaExplorerBaseUrl}/tx/${signature}?cluster=devnet`;
}

export function getExplorerAddressUrl(address: string): string {
  return `${solanaExplorerBaseUrl}/address/${address}?cluster=devnet`;
}

function buildExecutePaymentInstruction({
  programId,
  agent,
  policyPda,
  recipient,
  agentTokenAccount,
  recipientTokenAccount,
  mint,
  amount,
  decimals
}: {
  programId: PublicKey;
  agent: PublicKey;
  policyPda: PublicKey;
  recipient: PublicKey;
  agentTokenAccount: PublicKey;
  recipientTokenAccount: PublicKey;
  mint: PublicKey;
  amount: bigint;
  decimals: number;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: agent, isSigner: true, isWritable: false },
      { pubkey: policyPda, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: false },
      { pubkey: agentTokenAccount, isSigner: false, isWritable: true },
      { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: programId, isSigner: false, isWritable: false }
    ],
    data: Buffer.concat([executePaymentDiscriminator, encodeU64(amount), Buffer.from([decimals])])
  });
}

function encodeInitializePolicyArgs(args: AnchorPolicyArgs): Buffer {
  return Buffer.concat([
    args.agent.toBuffer(),
    args.tokenMint.toBuffer(),
    encodeU64(args.maxPerPayment),
    encodeU64(args.dailyBudget),
    encodeU64(args.approvalThreshold),
    encodeI64(args.periodSeconds),
    encodePubkeyVec(args.allowedRecipients)
  ]);
}

function encodeUpdatePolicyArgs(args: AnchorPolicyArgs): Buffer {
  return Buffer.concat([
    encodeU64(args.maxPerPayment),
    encodeU64(args.dailyBudget),
    encodeU64(args.approvalThreshold),
    encodeI64(args.periodSeconds),
    encodePubkeyVec(args.allowedRecipients)
  ]);
}

function encodePubkeyVec(publicKeys: PublicKey[]): Buffer {
  return Buffer.concat([encodeU32(publicKeys.length), ...publicKeys.map((key) => key.toBuffer())]);
}

function encodeU32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
}

function encodeU64(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value, 0);
  return buffer;
}

function encodeI64(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(value, 0);
  return buffer;
}

function usdToTokenUnits(value: number): bigint {
  return BigInt(Math.round(value * 1_000_000));
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

  const paddedFractional = fractional.padEnd(decimals, "0");
  const units = `${whole}${paddedFractional}`.replace(/^0+(?=\d)/, "");
  const parsed = BigInt(units || "0");

  if (parsed <= 0n) {
    throw new Error("Payment amount must be greater than zero.");
  }

  return parsed;
}

async function tokenAccountExists(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<boolean> {
  try {
    await getAccount(connection, tokenAccount, "confirmed", TOKEN_PROGRAM_ID);
    return true;
  } catch {
    return false;
  }
}

async function assertTokenAccountExists(
  connection: Connection,
  tokenAccount: PublicKey,
  label: string
) {
  if (!(await tokenAccountExists(connection, tokenAccount))) {
    throw new Error(
      `${label} ${tokenAccount.toBase58()} does not exist. Fund the agent wallet with this SPL token first.`
    );
  }
}
