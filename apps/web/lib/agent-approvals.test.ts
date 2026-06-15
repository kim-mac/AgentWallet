import { beforeEach, describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { createProvisionedAgent, setOwnerExportPassword } from "./agent-provisioning";
import { getProvisioningStore, resetMemoryProvisioningStore } from "./provisioning-store";
import {
  createPendingApproval,
  executeApprovedPayment,
  findUsableApproval,
  markApprovalRejected,
  markApprovalExecuted,
  markApprovalOnchainApproved
} from "./agent-approvals";

const owner = Keypair.generate().publicKey.toBase58();

describe("agent approvals", () => {
  beforeEach(async () => {
    process.env.AGENTSPEND_STORAGE_DRIVER = "memory";
    process.env.AGENTSPEND_ENCRYPTION_KEY = "test-encryption-key";
    resetMemoryProvisioningStore();
    await setOwnerExportPassword(owner, { password: "owner-password" });
  });

  it("creates a pending approval and lists it for the owner", async () => {
    const { agent } = await createProvisionedAgent(owner, { name: "Approval agent" });
    const approval = await createPendingApproval({
      owner,
      agentId: agent.id,
      agentPublicKey: agent.publicKey,
      programId: agent.programId,
      policyPda: "Policy1111111111111111111111111111111111",
      recipient: "Recipient11111111111111111111111111111111",
      tokenMint: "TokenMint1111111111111111111111111111111",
      amount: "5",
      decimals: 6,
      reason: "Owner approval is required."
    });

    const approvals = await getProvisioningStore().listApprovals(owner);

    expect(approval.status).toBe("pending");
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.recipient).toBe("Recipient11111111111111111111111111111111");
  });

  it("finds only on-chain approved approvals and marks them executed", async () => {
    const { agent } = await createProvisionedAgent(owner, { name: "Approval agent" });
    const approval = await createPendingApproval({
      owner,
      agentId: agent.id,
      agentPublicKey: agent.publicKey,
      programId: agent.programId,
      policyPda: "Policy1111111111111111111111111111111111",
      recipient: "Recipient11111111111111111111111111111111",
      tokenMint: "TokenMint1111111111111111111111111111111",
      amount: "5",
      decimals: 6,
      reason: "Owner approval is required."
    });

    expect(await findUsableApproval(agent.id, approval)).toBeNull();

    await markApprovalOnchainApproved(owner, approval.id, {
      signature: "approval-signature",
      paymentIntentPda: "Intent111111111111111111111111111111111"
    });

    const usable = await findUsableApproval(agent.id, approval);
    expect(usable?.paymentIntentPda).toBe("Intent111111111111111111111111111111111");

    await markApprovalExecuted(agent.id, approval.id, "payment-signature");
    expect(await findUsableApproval(agent.id, approval)).toBeNull();
  });

  it("executes a hosted agent payment immediately after owner approval", async () => {
    const { agent } = await createProvisionedAgent(owner, { name: "Approval agent" });
    const approval = await createPendingApproval({
      owner,
      agentId: agent.id,
      agentPublicKey: agent.publicKey,
      programId: agent.programId,
      policyPda: "Policy1111111111111111111111111111111111",
      recipient: "Recipient11111111111111111111111111111111",
      tokenMint: "TokenMint1111111111111111111111111111111",
      amount: "5",
      decimals: 6,
      reason: "Owner approval is required."
    });

    const result = await executeApprovedPayment(
      owner,
      approval.id,
      {
        signature: "approval-signature",
        paymentIntentPda: "Intent111111111111111111111111111111111"
      },
      async (approved) => {
        expect(approved.status).toBe("approved");
        expect(approved.paymentIntentPda).toBe("Intent111111111111111111111111111111111");
        return {
          ok: true,
          cluster: "devnet",
          agent: approved.agentPublicKey,
          policyPda: approved.policyPda,
          tokenMint: approved.tokenMint,
          amount: approved.amount,
          signature: "payment-signature",
          explorerUrl: "https://explorer.solana.com/tx/payment-signature?cluster=devnet",
          agentTokenAccount: "agent-token-account",
          recipientTokenAccount: "recipient-token-account"
        };
      }
    );

    expect(result.payment.signature).toBe("payment-signature");
    expect(result.approval.status).toBe("executed");
    expect(await findUsableApproval(agent.id, approval)).toBeNull();
  });

  it("marks an approved request as execution failed when the hosted wallet cannot pay", async () => {
    const { agent } = await createProvisionedAgent(owner, { name: "Approval agent" });
    const approval = await createPendingApproval({
      owner,
      agentId: agent.id,
      agentPublicKey: agent.publicKey,
      programId: agent.programId,
      policyPda: "Policy1111111111111111111111111111111111",
      recipient: "Recipient11111111111111111111111111111111",
      tokenMint: "TokenMint1111111111111111111111111111111",
      amount: "5",
      decimals: 6,
      reason: "Owner approval is required."
    });

    await expect(
      executeApprovedPayment(
        owner,
        approval.id,
        {
          signature: "approval-signature",
          paymentIntentPda: "Intent111111111111111111111111111111111"
        },
        async () => {
          throw new Error("Rejected: the agent wallet does not have enough token balance.");
        }
      )
    ).rejects.toThrow("not have enough token balance");

    const stored = await getProvisioningStore().getApproval(approval.id);
    expect(stored?.status).toBe("execution_failed");
    expect(await findUsableApproval(agent.id, approval)).toBeNull();
  });

  it("lets the owner reject a pending approval", async () => {
    const { agent } = await createProvisionedAgent(owner, { name: "Approval agent" });
    const approval = await createPendingApproval({
      owner,
      agentId: agent.id,
      agentPublicKey: agent.publicKey,
      programId: agent.programId,
      policyPda: "Policy1111111111111111111111111111111111",
      recipient: "Recipient11111111111111111111111111111111",
      tokenMint: "TokenMint1111111111111111111111111111111",
      amount: "5",
      decimals: 6,
      reason: "Owner approval is required."
    });

    const rejected = await markApprovalRejected(owner, approval.id);

    expect(rejected.status).toBe("rejected");
    expect(await findUsableApproval(agent.id, approval)).toBeNull();
  });
});
