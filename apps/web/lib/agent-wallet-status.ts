import type { ProvisionedAgentRecord } from "./provisioning-store";

export type AgentWalletStatus = {
  readyForPayments: boolean;
  policyConfigured: boolean;
  tokenMintConfigured: boolean;
  telegramLinked: boolean;
  missing: Array<"policyPda" | "tokenMint">;
};

export type AgentWalletSetupMissing = "policy_pda" | "token_mint";

export type AgentWalletSetupStatus = {
  ready: boolean;
  missing: AgentWalletSetupMissing[];
  ownerActionRequired: boolean;
  nextAction: string;
  availableActions: string[];
  summary: string;
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

export function buildAgentWalletSetupStatus(agent: ProvisionedAgentRecord): AgentWalletSetupStatus {
  const missing: AgentWalletSetupMissing[] = [];

  if (!agent.policyPda) {
    missing.push("policy_pda");
  }

  if (!agent.tokenMint) {
    missing.push("token_mint");
  }

  if (!missing.length) {
    return {
      ready: true,
      missing,
      ownerActionRequired: false,
      nextAction: "The agent can request policy-gated payments.",
      availableActions: ["get_wallet_status", "request_payment", "get_audit_log"],
      summary: "AgentWallet is ready for policy-gated payments."
    };
  }

  return {
    ready: false,
    missing,
    ownerActionRequired: true,
    nextAction: getNextSetupAction(missing),
    availableActions: ["get_wallet_status", "get_audit_log"],
    summary: "AgentWallet setup is incomplete."
  };
}

function getNextSetupAction(missing: AgentWalletSetupMissing[]) {
  if (missing.includes("policy_pda")) {
    return "Ask the owner to initialize or update the on-chain policy for this hosted agent.";
  }

  return "Ask the owner to select an allowed token mint for this hosted agent.";
}
