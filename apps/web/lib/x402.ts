import { z } from "zod";
import { defaultDevnetUsdcMint } from "./solana-devnet";

export const x402Version = "2";
export const x402Network = "solana-devnet";
export const x402Scheme = "exact";

export const paymentRequirementSchema = z.object({
  scheme: z.string().default(x402Scheme),
  network: z.string().default(x402Network),
  asset: z.string().min(32),
  payTo: z.string().min(32),
  amount: z.string().min(1),
  decimals: z.number().int().min(0).max(9).default(6),
  resource: z.string().optional(),
  description: z.string().optional()
});

export const paymentRequiredSchema = z.object({
  x402Version: z.string().default(x402Version),
  accepts: z.array(paymentRequirementSchema).min(1)
});

export const paymentPayloadSchema = z.object({
  x402Version: z.string().default(x402Version),
  scheme: z.string().default(x402Scheme),
  network: z.string().default(x402Network),
  payload: z.object({
    transaction: z.string().min(1),
    policyPda: z.string().min(32),
    agent: z.string().min(32)
  })
});

export const settlementResponseSchema = z.object({
  success: z.boolean(),
  network: z.string().default(x402Network),
  transaction: z.string().optional(),
  error: z.string().optional()
});

export type PaymentRequired = z.infer<typeof paymentRequiredSchema>;
export type PaymentPayload = z.infer<typeof paymentPayloadSchema>;
export type SettlementResponse = z.infer<typeof settlementResponseSchema>;

export function encodeX402Header(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

export function decodeX402Header<T = unknown>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
}

export function createPaymentRequired(input: {
  resource: string;
  recipient: string;
  tokenMint?: string;
  amount: string;
  decimals?: number;
  description?: string;
}): PaymentRequired {
  return paymentRequiredSchema.parse({
    x402Version,
    accepts: [
      {
        scheme: x402Scheme,
        network: x402Network,
        asset: input.tokenMint ?? defaultDevnetUsdcMint,
        payTo: input.recipient,
        amount: input.amount,
        decimals: input.decimals ?? 6,
        resource: input.resource,
        description: input.description
      }
    ]
  });
}

export function createPaymentPayload(input: {
  policyPda: string;
  agent: string;
  signature: string;
}): PaymentPayload {
  return paymentPayloadSchema.parse({
    x402Version,
    scheme: x402Scheme,
    network: x402Network,
    payload: {
      transaction: input.signature,
      policyPda: input.policyPda,
      agent: input.agent
    }
  });
}

export function createSettlementResponse(input: {
  success: boolean;
  network?: string;
  transaction?: string;
  error?: string;
}): SettlementResponse {
  return settlementResponseSchema.parse({
    success: input.success,
    network: input.network ?? x402Network,
    transaction: input.transaction,
    error: input.error
  });
}
