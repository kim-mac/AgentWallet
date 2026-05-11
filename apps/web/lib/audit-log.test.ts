import { beforeEach, describe, expect, it } from "vitest";
import {
  appendAuditEvent,
  listAuditEvents
} from "./audit-log";
import { resetMemoryProvisioningStore } from "./provisioning-store";

describe("audit log", () => {
  beforeEach(() => {
    process.env.AGENTSPEND_STORAGE_DRIVER = "memory";
    resetMemoryProvisioningStore();
  });

  it("stores audit events by owner and agent newest first", async () => {
    await appendAuditEvent({
      owner: "owner_1",
      agentId: "agent_1",
      type: "payment_rejected",
      message: "Rejected by policy",
      status: "rejected"
    });
    await appendAuditEvent({
      owner: "owner_1",
      agentId: "agent_1",
      type: "payment_approved",
      message: "Payment executed",
      status: "approved",
      signature: "sig_123"
    });

    await expect(listAuditEvents({ owner: "owner_1" })).resolves.toMatchObject([
      { type: "payment_approved", signature: "sig_123" },
      { type: "payment_rejected" }
    ]);
    await expect(listAuditEvents({ owner: "owner_1", agentId: "agent_1" })).resolves.toHaveLength(2);
  });
});
