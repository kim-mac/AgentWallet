import { beforeEach, describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import {
  createProvisionedAgent,
  createTelegramLink,
  decryptAgentKeypair,
  getAgentByApiKey,
  listProvisionedAgents,
  rotateProvisionedAgentApiKey,
  unlinkTelegram
} from "./agent-provisioning";
import { getProvisioningStore, resetMemoryProvisioningStore } from "./provisioning-store";

const owner = Keypair.generate().publicKey.toBase58();

describe("agent provisioning", () => {
  beforeEach(() => {
    process.env.AGENTSPEND_STORAGE_DRIVER = "memory";
    process.env.AGENTSPEND_ENCRYPTION_KEY = "test-encryption-key";
    resetMemoryProvisioningStore();
  });

  it("creates an encrypted agent record and returns the API key only once", async () => {
    const { agent, apiKey } = await createProvisionedAgent(owner, { name: "Research agent" });
    const stored = await getAgentByApiKey(apiKey);

    expect(agent.name).toBe("Research agent");
    expect(agent.publicKey).toBe(stored?.publicKey);
    expect(stored?.encryptedSecretKey).not.toContain("[");
    expect(decryptAgentKeypair(stored!).publicKey.toBase58()).toBe(agent.publicKey);
    expect((await listProvisionedAgents(owner))[0]).not.toHaveProperty("encryptedSecretKey");
  });

  it("rotates API keys and invalidates the old hash", async () => {
    const created = await createProvisionedAgent(owner, { name: "Trading agent" });
    const rotated = await rotateProvisionedAgentApiKey(owner, created.agent.id);

    expect(await getAgentByApiKey(created.apiKey)).toBeNull();
    expect((await getAgentByApiKey(rotated.apiKey))?.id).toBe(created.agent.id);
  });

  it("links and unlinks a Telegram chat through a one-time code", async () => {
    const { agent } = await createProvisionedAgent(owner, { name: "Telegram agent" });
    const link = await createTelegramLink(owner, agent.id);
    const consumed = await getProvisioningStore().consumeTelegramLink(link.code);

    expect(consumed?.agentId).toBe(agent.id);
    await getProvisioningStore().linkTelegramChat(agent.id, "12345");
    expect((await getProvisioningStore().getAgentByTelegramChat("12345"))?.id).toBe(agent.id);
    await unlinkTelegram(owner, agent.id);
    expect(await getProvisioningStore().getAgentByTelegramChat("12345")).toBeNull();
  });
});
