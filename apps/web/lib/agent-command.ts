import { PublicKey } from "@solana/web3.js";

export type ParsedAgentCommand = {
  action: "send";
  amount: string;
  recipient: string;
};

const publicKeyPattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
const amountPattern = /(?:send|pay|transfer)\s+\$?(\d+(?:\.\d+)?)/i;

export function parseAgentCommand(command: string): ParsedAgentCommand {
  const normalized = command.trim();

  if (!normalized) {
    throw new Error("Type a payment command, for example: send 1 token to <recipient>.");
  }

  if (/\b(buy|swap|trade)\b/i.test(normalized)) {
    throw new Error("Swap support is not connected yet. Try: send 1 token to <recipient>.");
  }

  if (!/\b(send|pay|transfer)\b/i.test(normalized)) {
    throw new Error("I can execute send/pay/transfer commands in this MVP.");
  }

  const amountMatch = normalized.match(amountPattern);

  if (!amountMatch) {
    throw new Error("Include a token amount, for example: send 1 token to <recipient>.");
  }
  const amount = amountMatch[1];

  if (!amount) {
    throw new Error("Include a token amount, for example: send 1 token to <recipient>.");
  }

  const recipientMatch = normalized.match(publicKeyPattern);

  if (!recipientMatch) {
    throw new Error("Include a valid recipient public key.");
  }

  const recipient = recipientMatch[0];

  try {
    new PublicKey(recipient);
  } catch {
    throw new Error("Include a valid recipient public key.");
  }

  return {
    action: "send",
    amount,
    recipient
  };
}
