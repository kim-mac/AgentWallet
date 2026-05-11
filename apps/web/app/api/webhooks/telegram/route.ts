import { NextResponse } from "next/server";
import {
  executeProvisionedAgentRecordPayment,
  withAgentExecutionTimeout
} from "../../../../lib/agent-executor";
import {
  buildTelegramPaymentInput,
  formatTelegramFailure,
  formatTelegramHelp,
  formatTelegramSuccess,
  getTelegramMessage
} from "../../../../lib/telegram-bot";
import { getProvisioningStore } from "../../../../lib/provisioning-store";
import { toPublicAgent } from "../../../../lib/agent-provisioning";
import { getServerEnv } from "../../../../lib/server-wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    authorizeTelegramWebhook(request);

    const botToken = requireEnv("TELEGRAM_BOT_TOKEN");
    const message = getTelegramMessage(await request.json());

    if (!message) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (message.text.trim().startsWith("/start") || message.text.trim().startsWith("/help")) {
      await sendTelegramMessage(botToken, message.chatId, formatTelegramHelp());
      return NextResponse.json({ ok: true });
    }

    if (message.text.trim().startsWith("/link")) {
      await handleTelegramLink(botToken, message.chatId, message.text);
      return NextResponse.json({ ok: true });
    }

    if (message.text.trim().startsWith("/unlink")) {
      await handleTelegramUnlink(botToken, message.chatId);
      return NextResponse.json({ ok: true });
    }

    if (message.text.trim().startsWith("/agent")) {
      await handleTelegramAgent(botToken, message.chatId);
      return NextResponse.json({ ok: true });
    }

    try {
      const agent = await getProvisioningStore().getAgentByTelegramChat(String(message.chatId));
      if (!agent) {
        throw new TelegramWebhookError(
          "This Telegram chat is not linked yet. Open AgentWallet, create a Telegram link code, then send /link CODE here.",
          400
        );
      }

      if (!agent.policyPda) {
        throw new TelegramWebhookError(
          "This agent does not have a policy PDA yet. Initialize or update the policy in AgentWallet first.",
          400
        );
      }

      const paymentInput = buildTelegramPaymentInput(message.text, {
        policyPda: agent.policyPda,
        tokenMint: agent.tokenMint,
        decimals: agent.decimals,
        programId: agent.programId
      });
      const result = await withAgentExecutionTimeout(
        executeProvisionedAgentRecordPayment(agent, paymentInput)
      );

      await sendTelegramMessage(
        botToken,
        message.chatId,
        formatTelegramSuccess({
          amount: paymentInput.amount,
          recipient: paymentInput.recipient,
          explorerUrl: result.explorerUrl
        })
      );
    } catch (error) {
      await sendTelegramMessage(botToken, message.chatId, formatTelegramFailure(error));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof TelegramWebhookError ? error.status : 400;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected Telegram webhook error."
      },
      { status }
    );
  }
}

async function handleTelegramLink(botToken: string, chatId: number | string, text: string) {
  const code = text.trim().split(/\s+/)[1]?.toUpperCase();

  if (!code) {
    await sendTelegramMessage(botToken, chatId, "Send /link CODE from your AgentWallet dashboard.");
    return;
  }

  const link = await getProvisioningStore().consumeTelegramLink(code);

  if (!link || Date.now() > new Date(link.expiresAt).getTime()) {
    await sendTelegramMessage(botToken, chatId, "That link code is invalid or expired. Create a new one in AgentWallet.");
    return;
  }

  const agent = await getProvisioningStore().linkTelegramChat(link.agentId, String(chatId));
  await sendTelegramMessage(
    botToken,
    chatId,
    `Linked to ${agent.name} (${shortAddress(agent.publicKey)}). Send: send 1 token to <recipient-wallet>`
  );
}

async function handleTelegramUnlink(botToken: string, chatId: number | string) {
  const agent = await getProvisioningStore().getAgentByTelegramChat(String(chatId));

  if (!agent) {
    await sendTelegramMessage(botToken, chatId, "This Telegram chat is not linked to an AgentWallet agent.");
    return;
  }

  await getProvisioningStore().unlinkTelegramChat(agent.id);
  await sendTelegramMessage(botToken, chatId, `Unlinked ${agent.name}.`);
}

async function handleTelegramAgent(botToken: string, chatId: number | string) {
  const agent = await getProvisioningStore().getAgentByTelegramChat(String(chatId));

  if (!agent) {
    await sendTelegramMessage(botToken, chatId, "No AgentWallet agent is linked. Send /link CODE first.");
    return;
  }

  const publicAgent = toPublicAgent(agent);
  await sendTelegramMessage(
    botToken,
    chatId,
    [
      `Agent: ${publicAgent.name}`,
      `Wallet: ${publicAgent.publicKey}`,
      `Policy: ${publicAgent.policyPda ?? "not set"}`,
      `Token mint: ${publicAgent.tokenMint}`
    ].join("\n")
  );
}

function authorizeTelegramWebhook(request: Request) {
  const secret = getServerEnv("TELEGRAM_WEBHOOK_SECRET");

  if (!secret) {
    return;
  }

  if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    throw new TelegramWebhookError("Invalid Telegram webhook secret.", 401);
  }
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string
) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    throw new TelegramWebhookError(`Telegram sendMessage failed: ${response.status}`, 502);
  }
}

function requireEnv(name: string) {
  const value = getServerEnv(name);

  if (!value) {
    throw new TelegramWebhookError(`${name} is not configured.`, 501);
  }

  return value;
}

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

class TelegramWebhookError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
