import { PublicKey } from "@solana/web3.js";
import {
  decodeAgentPolicyAccount,
  type DecodedAgentPolicyAccount
} from "./agent-payment-simulator";
import { getAgentByApiKey, toPublicAgent } from "./agent-provisioning";
import { AgentExecutionError } from "./agent-executor";
import type { ProvisionedAgentRecord } from "./provisioning-store";
import { createDevnetConnection } from "./solana-devnet";

export type AgentCapabilityAction =
  | "get_wallet_status"
  | "get_capabilities"
  | "simulate_payment"
  | "request_payment"
  | "get_audit_log";

export type AgentCapabilities = {
  ok: true;
  agent: ReturnType<typeof toPublicAgent>;
  policy: {
    pda: string;
    status: "active" | "paused";
    owner: string;
    programId: string;
    periodStartedAt: string;
    periodSeconds: string;
  };
  allowed: {
    recipients: string[];
    tokenMints: string[];
  };
  spend: {
    maxPerPaymentUnits: string;
    dailyBudgetUnits: string;
    spentInPeriodUnits: string;
    remainingBudgetUnits: string;
    approvalThresholdUnits: string;
  };
  canSpendNow: boolean;
  supportedActions: AgentCapabilityAction[];
  nextAction: string;
};

export function buildAgentCapabilities(
  agent: ProvisionedAgentRecord,
  policy: DecodedAgentPolicyAccount
): AgentCapabilities {
  const remainingBudget =
    policy.dailyBudget > policy.spentInPeriod ? policy.dailyBudget - policy.spentInPeriod : 0n;
  const canSpendNow =
    !policy.paused &&
    policy.allowedRecipients.length > 0 &&
    policy.allowedTokenMints.length > 0 &&
    remainingBudget > 0n;

  return {
    ok: true,
    agent: toPublicAgent(agent),
    policy: {
      pda: agent.policyPda ?? "",
      status: policy.paused ? "paused" : "active",
      owner: policy.owner,
      programId: agent.programId,
      periodStartedAt: policy.periodStartedAt.toString(),
      periodSeconds: policy.periodSeconds.toString()
    },
    allowed: {
      recipients: policy.allowedRecipients,
      tokenMints: policy.allowedTokenMints
    },
    spend: {
      maxPerPaymentUnits: policy.maxPerPayment.toString(),
      dailyBudgetUnits: policy.dailyBudget.toString(),
      spentInPeriodUnits: policy.spentInPeriod.toString(),
      remainingBudgetUnits: remainingBudget.toString(),
      approvalThresholdUnits: policy.approvalThreshold.toString()
    },
    canSpendNow,
    supportedActions: [
      "get_wallet_status",
      "get_capabilities",
      "simulate_payment",
      "request_payment",
      "get_audit_log"
    ],
    nextAction: getNextAction(policy.paused, canSpendNow)
  };
}

export async function getProvisionedAgentCapabilities(apiKey: string): Promise<AgentCapabilities> {
  const agent = await getAgentByApiKey(apiKey);

  if (!agent) {
    throw new AgentExecutionError("Invalid agent API key.", 401, {
      code: "INVALID_AGENT_API_KEY",
      message: "Agent API key is missing or invalid.",
      humanMessage: "Invalid agent API key.",
      agentMessage: "Use a valid AgentWallet API key from the selected hosted agent.",
      suggestedAction: "rotate_or_update_agent_api_key"
    });
  }

  if (!agent.policyPda) {
    throw new AgentExecutionError("This agent does not have an initialized policy PDA yet.", 400, {
      code: "POLICY_NOT_INITIALIZED",
      message: "Agent policy PDA is not initialized.",
      humanMessage: "This agent does not have an initialized policy PDA yet.",
      agentMessage: "Ask the owner to initialize or update the on-chain policy before requesting capabilities.",
      suggestedAction: "request_owner_policy_update"
    });
  }

  const connection = createDevnetConnection();
  const account = await connection.getAccountInfo(new PublicKey(agent.policyPda), "confirmed");

  if (!account) {
    throw new AgentExecutionError("Policy account was not found on Solana devnet.", 404, {
      code: "POLICY_NOT_INITIALIZED",
      message: "Policy account was not found on Solana devnet.",
      humanMessage: "This policy account has not been initialized on devnet.",
      agentMessage: "Ask the owner to initialize the on-chain policy before requesting capabilities.",
      suggestedAction: "request_owner_policy_update"
    });
  }

  return buildAgentCapabilities(agent, decodeAgentPolicyAccount(account.data));
}

function getNextAction(paused: boolean, canSpendNow: boolean) {
  if (paused) {
    return "Ask the owner to resume the policy before spending.";
  }

  if (!canSpendNow) {
    return "Ask the owner to update policy allowlists or refill the budget before spending.";
  }

  return "Use simulate_payment before request_payment when planning a spend.";
}
