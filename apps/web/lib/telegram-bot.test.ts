import { describe, expect, it } from "vitest";
import {
  buildTelegramPaymentInput,
  formatTelegramFailure,
  formatTelegramSuccess,
  getTelegramMessage
} from "./telegram-bot";

const chatId = 12345;
const text = "send 1 token to ELCt5nsW3HNBesvuynh94VnmKZosrUcncuEP89XDJFDH";

describe("telegram bot helpers", () => {
  it("extracts chat id and text from a Telegram update", () => {
    expect(
      getTelegramMessage({
        message: {
          chat: { id: chatId },
          text
        }
      })
    ).toEqual({ chatId, text });
  });

  it("builds an agent payment input from a Telegram command", () => {
    expect(
      buildTelegramPaymentInput(text, {
        policyPda: "PolicyPda111111111111111111111111111111111",
        tokenMint: "TokenMint111111111111111111111111111111111",
        decimals: 6,
        programId: "Program1111111111111111111111111111111111"
      })
    ).toMatchObject({
      amount: "1",
      recipient: "ELCt5nsW3HNBesvuynh94VnmKZosrUcncuEP89XDJFDH",
      decimals: 6
    });
  });

  it("formats successful Telegram replies with explorer proof", () => {
    expect(
      formatTelegramSuccess({
        amount: "1",
        recipient: "ELCt5nsW3HNBesvuynh94VnmKZosrUcncuEP89XDJFDH",
        explorerUrl: "https://explorer.solana.com/tx/demo?cluster=devnet"
      })
    ).toContain("Approved by policy");
  });

  it("formats failed Telegram replies as policy rejections", () => {
    expect(formatTelegramFailure(new Error("Rejected: the policy is paused."))).toBe(
      "Rejected: the policy is paused."
    );
  });
});
