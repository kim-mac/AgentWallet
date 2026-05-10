import { Keypair } from "@solana/web3.js";
import { z } from "zod";
import { explainAgentSpendError } from "./anchor-errors";
import {
  decryptAgentKeypair,
  getAgentByApiKey
} from "./agent-provisioning";
import type { ProvisionedAgentRecord } from "./provisioning-store";
import {
  buildExecutePaymentTransaction,
  createDevnetConnection,
  defaultAgentSpendProgramId,
  defaultDevnetUsdcMint,
  getExplorerTransactionUrl
} from "./solana-devnet";
import { loadKeypairFromEnv } from "./server-wallet";

export const agentExecutionTimeoutMs = 45_000;

export const executePaymentSchema = z.object({
  programId: z.string().optional(),
  policyPda: z.string().min(32).optional(),
  recipient: z.string().min(32),
  tokenMint: z.string().optional(),
  amount: z.string().min(1),
  decimals: z.coerce.number().int().min(0).max(9).optional()
});

export type ExecutePaymentInput = z.infer<typeof executePaymentSchema>;

export type AgentPaymentResult = {
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

export async function executeAgentPayment(
  input: ExecutePaymentInput
): Promise<AgentPaymentResult> {
  const body = executePaymentSchema.parse(input);
  const agent = loadKeypairFromEnv("AGENTSPEND_AGENT_SECRET_KEY");
  return executePaymentWithAgent(agent, {
    programId: body.programId ?? defaultAgentSpendProgramId,
    policyPda: requirePolicyPda(body.policyPda),
    recipient: body.recipient,
    tokenMint: body.tokenMint ?? defaultDevnetUsdcMint,
    amount: body.amount,
    decimals: body.decimals ?? 6
  });
}

export async function executeProvisionedAgentPayment(
  apiKey: string,
  input: ExecutePaymentInput
): Promise<AgentPaymentResult> {
  const agentRecord = await getAgentByApiKey(apiKey);

  if (!agentRecord) {
    throw new AgentExecutionError("Invalid agent API key.", 401);
  }

  return executeProvisionedAgentRecordPayment(agentRecord, input);
}

export async function executeProvisionedAgentRecordPayment(
  agentRecord: ProvisionedAgentRecord,
  input: ExecutePaymentInput
): Promise<AgentPaymentResult> {
  const body = executePaymentSchema.parse(input);
  const agent = decryptAgentKeypair(agentRecord);

  return executePaymentWithAgent(agent, {
    programId: body.programId ?? agentRecord.programId,
    policyPda: requirePolicyPda(body.policyPda ?? agentRecord.policyPda),
    recipient: body.recipient,
    tokenMint: body.tokenMint ?? agentRecord.tokenMint,
    amount: body.amount,
    decimals: body.decimals ?? agentRecord.decimals
  });
}

async function executePaymentWithAgent(
  agent: Keypair,
  body: Required<Pick<ExecutePaymentInput, "programId" | "policyPda" | "recipient" | "tokenMint" | "amount" | "decimals">>
): Promise<AgentPaymentResult> {
  const connection = createDevnetConnection();
  const { transaction, lastValidBlockHeight, agentTokenAccount, recipientTokenAccount } =
    await buildExecutePaymentTransaction(connection, agent.publicKey, {
      programId: body.programId,
      policyPda: body.policyPda,
      recipient: body.recipient,
      tokenMint: body.tokenMint,
      amount: body.amount,
      decimals: String(body.decimals)
    });

  transaction.sign(agent);

  const simulation = await connection.simulateTransaction(transaction);

  if (simulation.value.err) {
    throw new AgentExecutionError(explainAgentSpendError(simulation.value.err), 400);
  }

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false
  });

  await confirmSignatureByPolling(signature, lastValidBlockHeight);

  return {
    ok: true,
    cluster: "devnet",
    agent: agent.publicKey.toBase58(),
    policyPda: body.policyPda,
    tokenMint: body.tokenMint,
    amount: body.amount,
    signature,
    explorerUrl: getExplorerTransactionUrl(signature),
    agentTokenAccount: agentTokenAccount.toBase58(),
    recipientTokenAccount: recipientTokenAccount.toBase58()
  };
}

function requirePolicyPda(policyPda: string | null | undefined) {
  if (!policyPda) {
    throw new AgentExecutionError("This agent does not have an initialized policy PDA yet.", 400);
  }
  return policyPda;
}

export async function withAgentExecutionTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new AgentExecutionError(
          "Agent execution timed out while waiting for Solana devnet. Check the policy, agent token account, and retry.",
          504
        )
      );
    }, agentExecutionTimeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

export class AgentExecutionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function confirmSignatureByPolling(signature: string, lastValidBlockHeight: number) {
  const connection = createDevnetConnection();
  const startedAt = Date.now();

  while (Date.now() - startedAt < agentExecutionTimeoutMs) {
    const [status] = (await connection.getSignatureStatuses([signature])).value;

    if (status?.err) {
      throw new AgentExecutionError(`Transaction failed: ${JSON.stringify(status.err)}`, 400);
    }

    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    ) {
      return;
    }

    const currentBlockHeight = await connection.getBlockHeight("confirmed");

    if (currentBlockHeight > lastValidBlockHeight) {
      throw new AgentExecutionError("Transaction expired before confirmation.", 504);
    }

    await sleep(1_000);
  }

  throw new AgentExecutionError("Timed out waiting for transaction confirmation.", 504);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
