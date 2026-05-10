import {
  defaultAgentSpendProgramId,
  defaultDevnetUsdcMint
} from "./solana-devnet";
import { parseAgentCommand } from "./agent-command";
import type { ExecutePaymentInput } from "./agent-executor";

export type TelegramMessage = {
  chatId: number | string;
  text: string;
};

export type TelegramPaymentConfig = {
  policyPda: string;
  tokenMint?: string;
  decimals?: number;
  programId?: string;
};

export function getTelegramMessage(update: unknown): TelegramMessage | null {
  const maybeUpdate = update as {
    message?: { chat?: { id?: number | string }; text?: string };
  };
  const chatId = maybeUpdate.message?.chat?.id;
  const text = maybeUpdate.message?.text;

  if ((typeof chatId !== "number" && typeof chatId !== "string") || typeof text !== "string") {
    return null;
  }

  return { chatId, text };
}

export function buildTelegramPaymentInput(
  command: string,
  config: TelegramPaymentConfig
): ExecutePaymentInput {
  const parsed = parseAgentCommand(command);

  return {
    programId: config.programId ?? defaultAgentSpendProgramId,
    policyPda: config.policyPda,
    recipient: parsed.recipient,
    tokenMint: config.tokenMint ?? defaultDevnetUsdcMint,
    amount: parsed.amount,
    decimals: config.decimals ?? 6
  };
}

export function formatTelegramSuccess({
  amount,
  recipient,
  explorerUrl
}: {
  amount: string;
  recipient: string;
  explorerUrl: string;
}) {
  return [
    `Approved by policy. Sent ${amount} token to ${shortAddress(recipient)} on Solana devnet.`,
    "",
    explorerUrl
  ].join("\n");
}

export function formatTelegramFailure(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Rejected: the agent could not execute that payment.";
}

export function formatTelegramHelp() {
  return [
    "AgentSpend is ready.",
    "",
    "Link this chat from the dashboard:",
    "/link <code>",
    "",
    "Check the linked agent:",
    "/agent",
    "",
    "Try:",
    "send 1 token to <recipient-wallet>",
    "",
    "I will route the payment through the on-chain policy before tokens move."
  ].join("\n");
}

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
