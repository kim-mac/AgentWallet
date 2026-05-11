import type { ProvisionedAgentRecord } from "./provisioning-store";

export type AgentWalletStatus = {
  readyForPayments: boolean;
  policyConfigured: boolean;
  tokenMintConfigured: boolean;
  telegramLinked: boolean;
  missing: Array<"policyPda" | "tokenMint">;
};

export function buildAgentWalletStatus(agent: ProvisionedAgentRecord): AgentWalletStatus {
  const policyConfigured = Boolean(agent.policyPda);
  const tokenMintConfigured = Boolean(agent.tokenMint);
  const missing: AgentWalletStatus["missing"] = [];

  if (!policyConfigured) {
    missing.push("policyPda");
  }

  if (!tokenMintConfigured) {
    missing.push("tokenMint");
  }

  return {
    readyForPayments: policyConfigured && tokenMintConfigured,
    policyConfigured,
    tokenMintConfigured,
    telegramLinked: Boolean(agent.telegramChatId),
    missing
  };
}
