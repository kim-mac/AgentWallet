"use client";

import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  FlaskConical,
  Gauge,
  Info,
  KeyRound,
  PauseCircle,
  PlayCircle,
  Plus,
  ShieldCheck,
  WalletCards,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { simulatePolicyAttacks } from "@agentspend/policy-simulator";
import type { SpendEvent } from "@agentspend/shared";
import { parseAgentCommand } from "../lib/agent-command";
import { policy as initialPolicy, spendEvents } from "../lib/demo-data";
import {
  parseDemoState,
  policyToFormValues,
  serializeDemoState,
  updatePolicyFromForm
} from "../lib/demo-state";
import type { PolicyFormValues } from "../lib/demo-state";
import {
  buildAnchorPolicyArgs,
  buildAnchorPolicyTransaction,
  buildExecutePaymentTransaction,
  buildInitializePolicyInstruction,
  buildOwnerPolicyActionInstruction,
  buildUpdatePolicyInstruction,
  createDevnetConnection,
  defaultAgentSpendProgramId,
  defaultDevnetUsdcMint,
  derivePolicyPda,
  getExplorerAddressUrl,
  getExplorerTransactionUrl,
  getPhantomProvider,
  parsePublicKey
} from "../lib/solana-devnet";

const storageKey = "agentspend.demo-state.v1";
const agentRegistryStorageKey = "agentspend.agent-registry.v1";

const defaultOnchainPolicyForm = {
  programId: defaultAgentSpendProgramId,
  agent: "",
  tokenMint: defaultDevnetUsdcMint,
  allowedRecipients: "ELCt5nsW3HNBesvuynh94VnmKZosrUcncuEP89XDJFDH",
  periodSeconds: "86400"
};

const defaultExecutePaymentForm = {
  recipient: "",
  amount: "1",
  decimals: "6"
};

const vendorPresets = [
  { label: "Jupiter Swap Program", value: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4" },
  { label: "SPL Token Program", value: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
  { label: "Associated Token Program", value: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" },
  { label: "Memo Program", value: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr" }
];

const categoryPresets = [
  { label: "Data APIs", value: "data" },
  { label: "Trading / Swaps", value: "trading" },
  { label: "AI Inference", value: "inference" },
  { label: "Storage", value: "storage" },
  { label: "Automation", value: "automation" }
];

const tokenMintPresets = [
  { label: "AgentSpend Test Token", value: defaultDevnetUsdcMint },
  { label: "Devnet USDC", value: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" }
];

type CatalogItem = {
  id: string;
  label: string;
  value: string;
  selected: boolean;
};

const defaultProductCatalog: CatalogItem[] = vendorPresets.map((preset) => ({
  id: `product_${preset.value}`,
  label: preset.label,
  value: preset.value,
  selected: false
}));

const defaultRecipientCatalog: CatalogItem[] = [
  {
    id: "recipient_demo",
    label: "Demo recipient",
    value: "ELCt5nsW3HNBesvuynh94VnmKZosrUcncuEP89XDJFDH",
    selected: true
  }
];

type DashboardView = "operations" | "simulator" | "audit";

type AgentChatMessage = {
  id: string;
  role: "owner" | "agent";
  content: string;
  explorerUrl?: string;
  status?: "approved" | "rejected" | "info";
};

type AgentRegistryEntry = {
  id: string;
  name: string;
  wallet: string;
  policyPda?: string;
  status: "draft" | "initialized" | "paused";
  createdAt: string;
};

const defaultAgentRegistry: AgentRegistryEntry[] = [];

type PolicyAccountStatus = "idle" | "checking" | "missing" | "initialized" | "error";
type ProvisionedAgent = {
  id: string;
  owner: string;
  name: string;
  publicKey: string;
  apiKeyPrefix: string;
  programId: string;
  policyPda: string | null;
  tokenMint: string;
  decimals: number;
  telegramChatId: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function Dashboard() {
  const [activeView, setActiveView] = useState<DashboardView>("operations");
  const [policy, setPolicy] = useState(initialPolicy);
  const [policyForm, setPolicyForm] = useState<PolicyFormValues>(
    policyToFormValues(initialPolicy)
  );
  const [events, setEvents] = useState<SpendEvent[]>(spendEvents);
  const [hasLoadedSnapshot, setHasLoadedSnapshot] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [onchainPolicyForm, setOnchainPolicyForm] = useState(defaultOnchainPolicyForm);
  const [productCatalog, setProductCatalog] = useState<CatalogItem[]>(
    syncCatalogSelection(defaultProductCatalog, policyForm.allowedVendors)
  );
  const [recipientCatalog, setRecipientCatalog] = useState<CatalogItem[]>(
    syncCatalogSelection(defaultRecipientCatalog, defaultOnchainPolicyForm.allowedRecipients)
  );
  const [agentRegistry, setAgentRegistry] =
    useState<AgentRegistryEntry[]>(defaultAgentRegistry);
  const [agentRegistryForm, setAgentRegistryForm] = useState({
    name: "",
    wallet: ""
  });
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [draftPolicyStatus, setDraftPolicyStatus] = useState(
    "Draft controls are ready. Update the draft, then publish on-chain."
  );
  const [anchorStatus, setAnchorStatus] = useState(
    "Connect Phantom, paste the deployed program ID, then initialize or update the policy account."
  );
  const [anchorSignature, setAnchorSignature] = useState<string | null>(null);
  const [policyPda, setPolicyPda] = useState<string | null>(null);
  const [policyAccountStatus, setPolicyAccountStatus] =
    useState<PolicyAccountStatus>("idle");
  const [executePaymentForm, setExecutePaymentForm] = useState(defaultExecutePaymentForm);
  const [executeStatus, setExecuteStatus] = useState(
    "Use the configured agent wallet to execute a policy-gated SPL token payment."
  );
  const [executeSignature, setExecuteSignature] = useState<string | null>(null);
  const [agentTokenAccount, setAgentTokenAccount] = useState<string | null>(null);
  const [recipientTokenAccount, setRecipientTokenAccount] = useState<string | null>(null);
  const [faucetStatus, setFaucetStatus] = useState(
    "Connect Phantom, then fund the connected devnet wallet with AgentSpend test tokens."
  );
  const [agentFaucetStatus, setAgentFaucetStatus] = useState(
    "Select a hosted agent, then mint AgentSpend test tokens to its wallet."
  );
  const [faucetTokenAccount, setFaucetTokenAccount] = useState<string | null>(null);
  const [faucetSignature, setFaucetSignature] = useState<string | null>(null);
  const [agentFaucetTokenAccount, setAgentFaucetTokenAccount] = useState<string | null>(null);
  const [agentFaucetSignature, setAgentFaucetSignature] = useState<string | null>(null);
  const [agentCommand, setAgentCommand] = useState("");
  const [agentApiKey, setAgentApiKey] = useState("");
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([
    {
      id: "agent_welcome",
      role: "agent",
      status: "info",
      content:
        "Text me a payment command like: send 1 token to <recipient>. I will route it through the on-chain policy."
    }
  ]);
  const [isAgentExecuting, setIsAgentExecuting] = useState(false);
  const [ownerAuthStatus, setOwnerAuthStatus] = useState("Connect wallet and sign once to provision hosted agents.");
  const [provisionedAgents, setProvisionedAgents] = useState<ProvisionedAgent[]>([]);
  const [selectedProvisionedAgentId, setSelectedProvisionedAgentId] = useState<string | null>(null);
  const [newAgentName, setNewAgentName] = useState("Demo Telegram agent");
  const [latestProvisionedApiKey, setLatestProvisionedApiKey] = useState<string | null>(null);
  const [telegramLinkStatus, setTelegramLinkStatus] = useState("Create a link code, then send it to the shared Telegram bot.");
  const [telegramLinkCode, setTelegramLinkCode] = useState<string | null>(null);

  const simulatorFindings = useMemo(() => simulatePolicyAttacks(policy), [policy]);
  const selectedProvisionedAgent = useMemo(
    () => provisionedAgents.find((agent) => agent.id === selectedProvisionedAgentId) ?? null,
    [provisionedAgents, selectedProvisionedAgentId]
  );
  const activeDerivedPolicyPda = useMemo(
    () =>
      deriveRegistryPolicyPda(
        onchainPolicyForm.programId,
        walletAddress,
        onchainPolicyForm.agent
      ),
    [onchainPolicyForm.agent, onchainPolicyForm.programId, walletAddress]
  );
  const registryRows = useMemo(
    () =>
      agentRegistry.map((agent) => ({
        ...agent,
        derivedPolicyPda: deriveRegistryPolicyPda(
          onchainPolicyForm.programId,
          walletAddress,
          agent.wallet
        )
      })),
    [agentRegistry, onchainPolicyForm.programId, walletAddress]
  );
  const remainingBudget = policy.dailyBudgetUsd - policy.spentTodayUsd;
  const deniedEvents = events.filter((event) => event.decision === "denied");

  useEffect(() => {
    const snapshot = parseDemoState(window.localStorage.getItem(storageKey));
    const savedAgentRegistry = parseAgentRegistry(
      window.localStorage.getItem(agentRegistryStorageKey)
    );

    if (snapshot) {
      setPolicy(snapshot.policy);
      setPolicyForm(policyToFormValues(snapshot.policy));
      setProductCatalog(syncCatalogSelection(defaultProductCatalog, snapshot.policy.allowedVendors.join(", ")));
      setRecipientCatalog(
        syncCatalogSelection(defaultRecipientCatalog, snapshot.policy.allowedRecipients.join(", "))
      );
      setEvents(snapshot.events);
    }

    if (savedAgentRegistry) {
      setAgentRegistry(savedAgentRegistry);
    }

    setHasLoadedSnapshot(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSnapshot) {
      return;
    }

    window.localStorage.setItem(storageKey, serializeDemoState({ policy, requests: [], events }));
  }, [events, hasLoadedSnapshot, policy]);

  useEffect(() => {
    if (!hasLoadedSnapshot) {
      return;
    }

    window.localStorage.setItem(agentRegistryStorageKey, JSON.stringify(agentRegistry));
  }, [agentRegistry, hasLoadedSnapshot]);

  useEffect(() => {
    const allowedProducts = activeCatalogValues(productCatalog).join(", ");
    setPolicyForm((current) =>
      current.allowedVendors === allowedProducts
        ? current
        : { ...current, allowedVendors: allowedProducts }
    );
  }, [productCatalog]);

  useEffect(() => {
    const allowedRecipients = activeCatalogValues(recipientCatalog).join(", ");
    setPolicyForm((current) =>
      current.allowedRecipients === allowedRecipients
        ? current
        : { ...current, allowedRecipients: allowedRecipients }
    );
    setOnchainPolicyForm((current) =>
      current.allowedRecipients === allowedRecipients
        ? current
        : { ...current, allowedRecipients: allowedRecipients }
    );
  }, [recipientCatalog]);

  useEffect(() => {
    if (!activeDerivedPolicyPda) {
      setPolicyPda(null);
      setPolicyAccountStatus("idle");
      return;
    }

    const policyPdaToCheck = activeDerivedPolicyPda;
    let cancelled = false;
    setPolicyPda(policyPdaToCheck);
    setPolicyAccountStatus("checking");
    setAnchorStatus("Checking policy account on devnet...");

    async function checkPolicyAccount() {
      try {
        const connection = createDevnetConnection();
        const account = await connection.getAccountInfo(
          parsePublicKey(policyPdaToCheck, "Policy PDA")
        );

        if (cancelled) {
          return;
        }

        if (account) {
          setPolicyAccountStatus("initialized");
          setAnchorStatus("Policy account is already initialized. Use Update on-chain policy to change its rules.");
          setAgentRegistry((current) =>
            current.map((agent) =>
              agent.wallet === onchainPolicyForm.agent.trim()
                ? { ...agent, policyPda: policyPdaToCheck, status: "initialized" }
                : agent
            )
          );
        } else {
          setPolicyAccountStatus("missing");
          setAnchorStatus("Policy account is not initialized yet. Initialize it once, then use Update for later changes.");
          setAgentRegistry((current) =>
            current.map((agent) =>
              agent.wallet === onchainPolicyForm.agent.trim()
                ? { ...agent, policyPda: undefined, status: "draft" }
                : agent
            )
          );
        }
      } catch {
        if (!cancelled) {
          setPolicyAccountStatus("error");
          setAnchorStatus("Unable to check policy account status. Try again.");
        }
      }
    }

    void checkPolicyAccount();

    return () => {
      cancelled = true;
    };
  }, [activeDerivedPolicyPda, onchainPolicyForm.agent]);

  async function connectWallet() {
    const provider = getPhantomProvider();

    if (!provider) {
      setAnchorStatus("Phantom wallet was not found in this browser.");
      return;
    }

    try {
      const response = await provider.connect();
      const address = response.publicKey.toBase58();
      setWalletAddress(address);
      setAnchorStatus("Wallet connected on devnet.");
    } catch (error) {
      setAnchorStatus(getErrorMessage(error));
    }
  }

  async function signInOwnerWallet() {
    const provider = getPhantomProvider();

    if (!provider) {
      setOwnerAuthStatus("Phantom wallet was not found in this browser.");
      return;
    }

    if (!provider.signMessage) {
      setOwnerAuthStatus("This wallet does not support message signing. Use Phantom or another Solana wallet with signMessage.");
      return;
    }

    try {
      const response = provider.publicKey ? { publicKey: provider.publicKey } : await provider.connect();
      const owner = response.publicKey.toBase58();
      setWalletAddress(owner);
      setOwnerAuthStatus("Requesting owner sign-in challenge...");

      const challengeResponse = await fetch("/api/auth/wallet/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner })
      });
      const challenge = await readJsonResponse<{ message: string }>(challengeResponse);
      const encodedMessage = new TextEncoder().encode(challenge.message);
      const signed = await provider.signMessage(encodedMessage, "utf8");

      const verifyResponse = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          message: challenge.message,
          signature: Array.from(signed.signature)
        })
      });
      await readJsonResponse(verifyResponse);
      setOwnerAuthStatus("Owner wallet signed in. You can create hosted agent keys now.");
      await loadProvisionedAgents();
    } catch (error) {
      setOwnerAuthStatus(getErrorMessage(error));
    }
  }

  async function loadProvisionedAgents() {
    const response = await fetch("/api/agents", { cache: "no-store" });
    const payload = await readJsonResponse<{ agents: ProvisionedAgent[] }>(response);
    setProvisionedAgents(payload.agents);
  }

  async function createHostedAgent() {
    if (!walletAddress) {
      setOwnerAuthStatus("Connect and sign with the owner wallet before creating an agent.");
      return;
    }

    try {
      setOwnerAuthStatus("Creating hosted agent wallet and API key...");
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAgentName,
          programId: onchainPolicyForm.programId,
          policyPda,
          tokenMint: onchainPolicyForm.tokenMint,
          decimals: Number(executePaymentForm.decimals) || 6
        })
      });
      const payload = await readJsonResponse<{ agent: ProvisionedAgent; apiKey: string }>(response);

      setProvisionedAgents((current) => upsertProvisionedAgent(current, payload.agent));
      setSelectedProvisionedAgentId(payload.agent.id);
      setLatestProvisionedApiKey(payload.apiKey);
      setAgentApiKey(payload.apiKey);
      loadProvisionedAgentIntoPolicy(payload.agent);
      setOwnerAuthStatus("Hosted agent created. Copy the API key now; it will not be shown again.");
    } catch (error) {
      setOwnerAuthStatus(getErrorMessage(error));
    }
  }

  async function rotateHostedAgentApiKey(agentId: string) {
    try {
      setOwnerAuthStatus("Rotating hosted agent API key...");
      const response = await fetch(`/api/agents/${agentId}/api-key/rotate`, { method: "POST" });
      const payload = await readJsonResponse<{ agent: ProvisionedAgent; apiKey: string }>(response);
      setProvisionedAgents((current) => upsertProvisionedAgent(current, payload.agent));
      setLatestProvisionedApiKey(payload.apiKey);
      setAgentApiKey(payload.apiKey);
      setOwnerAuthStatus("API key rotated. Copy the new key now; the old key no longer works.");
    } catch (error) {
      setOwnerAuthStatus(getErrorMessage(error));
    }
  }

  async function createHostedAgentTelegramLink(agentId: string) {
    try {
      setTelegramLinkStatus("Creating Telegram link code...");
      const response = await fetch(`/api/agents/${agentId}/telegram-link`, { method: "POST" });
      const payload = await readJsonResponse<{ code: string; expiresAt: string }>(response);
      setTelegramLinkCode(payload.code);
      setTelegramLinkStatus(`Send /link ${payload.code} to the shared Telegram bot. This code expires at ${new Date(payload.expiresAt).toLocaleTimeString()}.`);
    } catch (error) {
      setTelegramLinkStatus(getErrorMessage(error));
    }
  }

  async function unlinkHostedAgentTelegram(agentId: string) {
    try {
      const response = await fetch(`/api/agents/${agentId}/telegram-link`, { method: "DELETE" });
      const payload = await readJsonResponse<{ agent: ProvisionedAgent }>(response);
      setProvisionedAgents((current) => upsertProvisionedAgent(current, payload.agent));
      setTelegramLinkCode(null);
      setTelegramLinkStatus("Telegram chat unlinked.");
    } catch (error) {
      setTelegramLinkStatus(getErrorMessage(error));
    }
  }

  function loadProvisionedAgentIntoPolicy(agent: ProvisionedAgent) {
    setSelectedProvisionedAgentId(agent.id);
    setSelectedAgentId(agent.id);
    setAgentRegistry((current) =>
      upsertAgentRegistryEntry(current, {
        id: agent.id,
        name: agent.name,
        wallet: agent.publicKey,
        policyPda: agent.policyPda ?? undefined,
        status: agent.policyPda ? "initialized" : "draft",
        createdAt: agent.createdAt
      })
    );
    setOnchainPolicyForm((current) => ({
      ...current,
      programId: agent.programId,
      agent: agent.publicKey,
      tokenMint: agent.tokenMint
    }));
    setPolicyPda(agent.policyPda);
    setPolicyAccountStatus(agent.policyPda ? "checking" : "idle");
    setAnchorStatus(
      agent.policyPda
        ? "Hosted agent loaded into the Anchor policy card. Checking its policy account..."
        : walletAddress
          ? "Hosted agent loaded into the Anchor policy card. Initialize its policy account next."
          : "Hosted agent selected. Connect the owner wallet so AgentSpend can derive and initialize its policy PDA."
    );
  }

  function clearHostedAgentSelection() {
    setSelectedProvisionedAgentId(null);
    clearRegisteredAgentSelection();
  }

  async function updateHostedAgentPolicyConfig(agentId: string, policyPdaValue: string) {
    const response = await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        programId: onchainPolicyForm.programId,
        policyPda: policyPdaValue,
        tokenMint: onchainPolicyForm.tokenMint,
        decimals: Number(executePaymentForm.decimals) || 6
      })
    });
    const payload = await readJsonResponse<{ agent: ProvisionedAgent }>(response);
    setProvisionedAgents((current) => upsertProvisionedAgent(current, payload.agent));
  }

  function applyPolicyUpdate() {
    if (!walletAddress) {
      setDraftPolicyStatus("Connect owner wallet before updating the draft policy.");
      return;
    }

    const nextPolicy = updatePolicyFromForm(policy, {
      ...policyForm,
      allowedVendors: activeCatalogValues(productCatalog).join(", "),
      allowedRecipients: activeCatalogValues(recipientCatalog).join(", ")
    });
    setPolicy(nextPolicy);
    setDraftPolicyStatus(
      `Draft policy updated: $${nextPolicy.maxPerPaymentUsd} max payment, $${nextPolicy.dailyBudgetUsd} budget, ${nextPolicy.allowedRecipients.length} allowed recipient${nextPolicy.allowedRecipients.length === 1 ? "" : "s"}. Publish on-chain to enforce it.`
    );
    setEvents((current) => [
      {
        id: `event_policy_${Date.now()}`,
        policyId: nextPolicy.id,
        paymentId: "policy_update",
        decision: "approved",
        amountUsd: 0,
        vendorName: "Owner policy update",
        category: "governance",
        createdAt: new Date().toISOString(),
        reasons: ["Owner updated spend controls outside agent code."]
      },
      ...current
    ]);
  }

  function togglePause() {
    if (!walletAddress) {
      setDraftPolicyStatus("Connect owner wallet before changing the draft policy state.");
      return;
    }

    const nextStatus = policy.status === "active" ? "paused" : "active";
    setPolicy((current) => ({ ...current, status: nextStatus }));
    setDraftPolicyStatus(`Draft policy ${nextStatus}. Publish on-chain to enforce this status.`);
    setEvents((current) => [
      {
        id: `event_pause_${Date.now()}`,
        policyId: policy.id,
        paymentId: "policy_status",
        decision: nextStatus === "active" ? "approved" : "denied",
        amountUsd: 0,
        vendorName: nextStatus === "active" ? "Policy resumed" : "Policy paused",
        category: "governance",
        createdAt: new Date().toISOString(),
        reasons: [`Owner set policy status to ${nextStatus}.`]
      },
      ...current
    ]);
  }

  function addAgentToRegistry() {
    const wallet = agentRegistryForm.wallet.trim();
    const name = agentRegistryForm.name.trim() || `Agent ${agentRegistry.length + 1}`;

    try {
      parsePublicKey(wallet, "Agent wallet");
    } catch (error) {
      setAnchorStatus(getErrorMessage(error));
      return;
    }

    const nextId = `agent_${Date.now()}`;
    const existingAgent = agentRegistry.find((agent) => agent.wallet === wallet);
    const nextSelectedAgentId = existingAgent?.id ?? nextId;
    setAgentRegistry((current) => {
      const existing = current.find((agent) => agent.wallet === wallet);

      if (existing) {
        return current.map((agent) =>
          agent.id === existing.id ? { ...agent, name, wallet } : agent
        );
      }

      return [
        ...current,
        {
          id: nextId,
          name,
          wallet,
          status: "draft",
          createdAt: new Date().toISOString()
        }
      ];
    });
    setAgentRegistryForm({ name: "", wallet: "" });
    setOnchainPolicyForm((current) => ({ ...current, agent: wallet }));
    setSelectedAgentId(nextSelectedAgentId);
    setAnchorStatus("Agent added. Review the policy, then initialize or update its on-chain account.");
  }

  function useRegisteredAgent(agent: AgentRegistryEntry) {
    const derivedPolicyPda = deriveRegistryPolicyPda(
      onchainPolicyForm.programId,
      walletAddress,
      agent.wallet
    );
    setSelectedAgentId(agent.id);
    setOnchainPolicyForm((current) => ({ ...current, agent: agent.wallet }));
    setPolicyPda(agent.policyPda ?? derivedPolicyPda);
    setAnchorStatus(
      agent.policyPda || derivedPolicyPda
        ? "Registered agent loaded. You can update this policy or run a payment."
        : "Registered agent loaded. Initialize its on-chain policy account next."
    );
  }

  function clearRegisteredAgentSelection() {
    setSelectedAgentId(null);
    setOnchainPolicyForm((current) => ({ ...current, agent: "" }));
    setPolicyPda(null);
    setPolicyAccountStatus("idle");
    setAnchorSignature(null);
    setAnchorStatus("No agent selected. Register or use an agent before initializing a policy.");
  }

  function removeRegisteredAgent(agentId: string) {
    setAgentRegistry((current) => current.filter((agent) => agent.id !== agentId));

    if (selectedAgentId === agentId) {
      setSelectedAgentId(null);
      setPolicyPda(null);
    }
  }

  async function submitAnchorPolicyInstruction(
    action: "initialize" | "update" | "pause" | "resume"
  ) {
    const provider = getPhantomProvider();

    if (!provider) {
      setAnchorStatus("Phantom wallet was not found in this browser.");
      return;
    }

    try {
      const response = provider.publicKey ? { publicKey: provider.publicKey } : await provider.connect();
      const owner = response.publicKey;
      const connection = createDevnetConnection();
      const programId = parsePublicKey(onchainPolicyForm.programId, "Program ID");
      const args = buildAnchorPolicyArgs(policy, {
        ...onchainPolicyForm,
        allowedRecipients: activeCatalogValues(recipientCatalog).join(", ")
      });
      const [derivedPolicyPda] = derivePolicyPda(programId, owner, args.agent);
      const existingPolicyAccount = await connection.getAccountInfo(derivedPolicyPda);

      setWalletAddress(owner.toBase58());
      setPolicyPda(derivedPolicyPda.toBase58());

      if (action === "initialize" && existingPolicyAccount) {
        setPolicyAccountStatus("initialized");
        setAnchorStatus("Policy account is already initialized. Use Update on-chain policy to change its rules.");
        setAgentRegistry((current) =>
          current.map((agent) =>
            agent.wallet === args.agent.toBase58()
              ? { ...agent, policyPda: derivedPolicyPda.toBase58(), status: "initialized" }
              : agent
          )
        );
        if (selectedProvisionedAgentId && args.agent.toBase58() === onchainPolicyForm.agent.trim()) {
          await updateHostedAgentPolicyConfig(selectedProvisionedAgentId, derivedPolicyPda.toBase58());
        }
        return;
      }

      if (action !== "initialize" && !existingPolicyAccount) {
        setPolicyAccountStatus("missing");
        setAnchorStatus("Policy account is not initialized yet. Initialize it once before updating or pausing.");
        return;
      }

      const instruction =
        action === "initialize"
          ? buildInitializePolicyInstruction(programId, owner, derivedPolicyPda, args)
          : action === "update"
            ? buildUpdatePolicyInstruction(programId, owner, derivedPolicyPda, args)
            : buildOwnerPolicyActionInstruction(
                action === "pause" ? "pause_policy" : "resume_policy",
                programId,
                owner,
                derivedPolicyPda
              );
      const { transaction, blockhash, lastValidBlockHeight } =
        await buildAnchorPolicyTransaction(connection, owner, instruction);

      setAnchorSignature(null);
      setAnchorStatus(`Waiting for wallet approval to ${action} policy account...`);

      const result = await provider.signAndSendTransaction(transaction);
      const signature = typeof result === "string" ? result : result.signature;
      const derivedPolicyPdaText = derivedPolicyPda.toBase58();

      setAnchorStatus("Transaction submitted. Confirming on devnet...");
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      setAnchorSignature(signature);
      setPolicyAccountStatus("initialized");
      setAnchorStatus(`Anchor policy account ${action} confirmed on devnet.`);
      setAgentRegistry((current) =>
        current.map((agent) =>
          agent.wallet === args.agent.toBase58()
            ? {
                ...agent,
                policyPda: derivedPolicyPdaText,
                status:
                  action === "pause"
                    ? "paused"
                    : action === "resume" || action === "initialize" || action === "update"
                      ? "initialized"
                      : agent.status
              }
            : agent
        )
      );
      if (selectedProvisionedAgentId && args.agent.toBase58() === onchainPolicyForm.agent.trim()) {
        await updateHostedAgentPolicyConfig(selectedProvisionedAgentId, derivedPolicyPdaText);
      }
      setEvents((current) => [
        {
          id: `event_anchor_${action}_${Date.now()}`,
          policyId: policy.id,
          paymentId: `anchor_${action}`,
          decision: "approved",
          amountUsd: 0,
          vendorName: "AgentSpend program",
          category: "policy_account",
          createdAt: new Date().toISOString(),
          reasons: [`Anchor ${action} transaction confirmed: ${signature}.`]
        },
        ...current
      ]);
    } catch (error) {
      setAnchorStatus(getErrorMessage(error));
    }
  }

  async function executePolicyPayment() {
    const provider = getPhantomProvider();

    if (!provider) {
      setExecuteStatus("Phantom wallet was not found in this browser.");
      return;
    }

    if (!policyPda) {
      setExecuteStatus("Initialize or derive the on-chain policy PDA before executing.");
      return;
    }

    if (policyAccountStatus !== "initialized") {
      setExecuteStatus("Policy account is not initialized on-chain yet. Initialize it before executing a payment.");
      return;
    }

    try {
      const response = provider.publicKey ? { publicKey: provider.publicKey } : await provider.connect();
      const agent = response.publicKey;

      if (agent.toBase58() !== onchainPolicyForm.agent.trim()) {
        setExecuteStatus(
          "Connected wallet is not the configured agent. Switch Phantom to the agent wallet."
        );
        return;
      }

      const connection = createDevnetConnection();
      const { transaction, blockhash, lastValidBlockHeight, agentTokenAccount, recipientTokenAccount } =
        await buildExecutePaymentTransaction(connection, agent, {
          programId: onchainPolicyForm.programId,
          policyPda,
          recipient: executePaymentForm.recipient,
          tokenMint: onchainPolicyForm.tokenMint,
          amount: executePaymentForm.amount,
          decimals: executePaymentForm.decimals
        });

      setWalletAddress(agent.toBase58());
      setAgentTokenAccount(agentTokenAccount.toBase58());
      setRecipientTokenAccount(recipientTokenAccount.toBase58());
      setExecuteSignature(null);
      setExecuteStatus("Waiting for agent wallet approval...");

      const result = await provider.signAndSendTransaction(transaction);
      const signature = typeof result === "string" ? result : result.signature;

      setExecuteStatus("Payment submitted. Confirming on devnet...");
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      setExecuteSignature(signature);
      setExecuteStatus("Policy-gated payment executed on devnet.");
      setEvents((current) => [
        {
          id: `event_execute_payment_${Date.now()}`,
          policyId: policy.id,
          paymentId: "execute_payment",
          decision: "approved",
          amountUsd: Number(executePaymentForm.amount) || 0,
          vendorName: "AgentSpend execute_payment",
          category: "token_transfer",
          createdAt: new Date().toISOString(),
          reasons: [`Program-routed payment confirmed: ${signature}.`]
        },
        ...current
      ]);
    } catch (error) {
      setExecuteStatus(getErrorMessage(error));
    }
  }

  async function requestDevnetTokens() {
    const provider = getPhantomProvider();

    if (!provider) {
      setFaucetStatus("Phantom wallet was not found in this browser.");
      return;
    }

    try {
      const response = provider.publicKey ? { publicKey: provider.publicKey } : await provider.connect();
      const owner = response.publicKey.toBase58();

      setWalletAddress(owner);
      setFaucetTokenAccount(null);
      setFaucetSignature(null);
      setFaucetStatus("Requesting devnet test tokens...");

      const result = await fetch("/api/devnet/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          tokenMint: onchainPolicyForm.tokenMint,
          amount: 25,
          decimals: Number(executePaymentForm.decimals) || 6
        })
      });
      const payload = (await result.json()) as {
        ok?: boolean;
        error?: string;
        tokenAccount?: string;
        signature?: string;
      };

      if (!result.ok || !payload.ok) {
        throw new Error(payload.error ?? "Faucet request failed.");
      }

      setFaucetTokenAccount(payload.tokenAccount ?? null);
      setFaucetSignature(payload.signature ?? null);
      setFaucetStatus("Devnet test tokens funded.");
    } catch (error) {
      setFaucetStatus(getErrorMessage(error));
    }
  }

  async function requestSelectedAgentTokens() {
    if (!selectedProvisionedAgent) {
      setAgentFaucetStatus("Select a hosted agent before minting AgentSpend test tokens.");
      return;
    }

    try {
      setAgentFaucetTokenAccount(null);
      setAgentFaucetSignature(null);
      setAgentFaucetStatus(`Minting AgentSpend test tokens to ${shortAddress(selectedProvisionedAgent.publicKey)}...`);

      const result = await fetch("/api/devnet/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: selectedProvisionedAgent.publicKey,
          tokenMint: selectedProvisionedAgent.tokenMint,
          amount: 25,
          decimals: selectedProvisionedAgent.decimals
        })
      });
      const payload = (await result.json()) as {
        ok?: boolean;
        error?: string;
        tokenAccount?: string;
        signature?: string;
      };

      if (!result.ok || !payload.ok) {
        throw new Error(payload.error ?? "Agent token mint request failed.");
      }

      setAgentFaucetTokenAccount(payload.tokenAccount ?? null);
      setAgentFaucetSignature(payload.signature ?? null);
      setAgentFaucetStatus("Selected hosted agent funded with AgentSpend test tokens.");
    } catch (error) {
      setAgentFaucetStatus(getErrorMessage(error));
    }
  }

  async function submitAgentCommand() {
    const command = agentCommand.trim();

    if (!command) {
      return;
    }

    const ownerMessage: AgentChatMessage = {
      id: `owner_${Date.now()}`,
      role: "owner",
      content: command
    };

    setAgentMessages((current) => [...current, ownerMessage]);
    setAgentCommand("");
    setIsAgentExecuting(true);

    try {
      if (!policyPda) {
        throw new Error("Initialize the on-chain policy before asking the agent to spend.");
      }

      if (policyAccountStatus !== "initialized") {
        throw new Error("Policy account is not initialized on-chain yet. Initialize it before asking the agent to spend.");
      }

      if (!agentApiKey.trim()) {
        throw new Error("Enter the demo agent API key so the chat can call the backend executor.");
      }

      const parsed = parseAgentCommand(command);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 50_000);
      const response = await fetch("/api/agent/payments/execute", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${agentApiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          programId: onchainPolicyForm.programId,
          policyPda,
          recipient: parsed.recipient,
          tokenMint: onchainPolicyForm.tokenMint,
          amount: parsed.amount,
          decimals: Number(executePaymentForm.decimals) || 6
        })
      });
      window.clearTimeout(timeout);
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        signature?: string;
        explorerUrl?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "The agent payment was rejected.");
      }

      setExecuteSignature(payload.signature ?? null);
      setExecuteStatus("Agent API executed a policy-gated payment on devnet.");
      setAgentMessages((current) => [
        ...current,
        {
          id: `agent_success_${Date.now()}`,
          role: "agent",
          status: "approved",
          explorerUrl: payload.explorerUrl,
          content: `Approved by policy and executed on devnet. Signature: ${payload.signature}.`
        }
      ]);
    } catch (error) {
      setAgentMessages((current) => [
        ...current,
        {
          id: `agent_rejected_${Date.now()}`,
          role: "agent",
          status: "rejected",
          content:
            error instanceof DOMException && error.name === "AbortError"
              ? "Agent execution timed out while waiting for the backend. Check the dev server logs and try again."
              : getErrorMessage(error)
        }
      ]);
    } finally {
      setIsAgentExecuting(false);
    }
  }

  function resetDemo() {
    window.localStorage.removeItem(storageKey);
    setPolicy(initialPolicy);
    setPolicyForm(policyToFormValues(initialPolicy));
    setProductCatalog(syncCatalogSelection(defaultProductCatalog, initialPolicy.allowedVendors.join(", ")));
    setRecipientCatalog(syncCatalogSelection(defaultRecipientCatalog, defaultOnchainPolicyForm.allowedRecipients));
    setAgentRegistry(defaultAgentRegistry);
    setAgentRegistryForm({ name: "", wallet: "" });
    setSelectedAgentId(null);
    setDraftPolicyStatus("Draft controls are ready. Update the draft, then publish on-chain.");
    setEvents(spendEvents);
    setOnchainPolicyForm(defaultOnchainPolicyForm);
    setExecutePaymentForm(defaultExecutePaymentForm);
    setPolicyPda(null);
    setPolicyAccountStatus("idle");
    setAnchorSignature(null);
    setExecuteSignature(null);
    setAgentTokenAccount(null);
    setRecipientTokenAccount(null);
    setFaucetTokenAccount(null);
    setFaucetSignature(null);
    setAgentFaucetTokenAccount(null);
    setAgentFaucetSignature(null);
    setFaucetStatus("Connect Phantom, then fund the connected devnet wallet with AgentSpend test tokens.");
    setAgentFaucetStatus("Select a hosted agent, then mint AgentSpend test tokens to its wallet.");
    setAgentCommand("");
    setAgentApiKey("");
    setAgentMessages([
      {
        id: "agent_welcome",
        role: "agent",
        status: "info",
        content:
          "Text me a payment command like: send 1 token to <recipient>. I will route it through the on-chain policy."
      }
    ]);
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>AgentSpend</strong>
            <br />
            <span>Policy controls</span>
          </div>
        </div>
        <nav className="nav" aria-label="Primary">
          <button
            className={activeView === "operations" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("operations")}
          >
            <Gauge size={17} /> Operations
          </button>
          <button
            className={activeView === "simulator" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("simulator")}
          >
            <AlertTriangle size={17} /> Policy simulator
          </button>
          <button
            className={activeView === "audit" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("audit")}
          >
            <Activity size={17} /> Audit log
          </button>
        </nav>
      </aside>

      <main className="main">
        <header className="topbar" id="overview">
          <div className="page-title">
            <h1>Agent-native spend controls on Solana</h1>
            <p>
              Owners set policy. Agents execute payments. AgentSpend enforces
              the wallet rules on-chain before tokens move.
            </p>
          </div>
          <div className="top-actions">
            <span className="status-pill">
              <KeyRound size={16} /> {policy.status} policy
            </span>
            <button
              className={walletAddress ? "button connected small" : "button secondary small"}
              type="button"
              onClick={connectWallet}
            >
              <WalletCards size={15} />{" "}
              {walletAddress ? `Connected ${shortAddress(walletAddress)}` : "Connect wallet"}
            </button>
          </div>
        </header>

        <section className="grid metrics" aria-label="Metrics">
          <Metric label="Daily budget" value={`$${policy.dailyBudgetUsd}`} />
          <Metric label="Remaining today" value={`$${remainingBudget}`} />
          <Metric label="Approval threshold" value={`$${policy.approvalThresholdUsd}`} />
          <Metric label="Policy violations" value={String(deniedEvents.length)} />
        </section>

        {activeView === "operations" ? (
          <OperationsView
            agentTokenAccount={agentTokenAccount}
            anchorSignature={anchorSignature}
            anchorStatus={anchorStatus}
            applyPolicyUpdate={applyPolicyUpdate}
            events={events}
            executePaymentForm={executePaymentForm}
            executePolicyPayment={executePolicyPayment}
            executeSignature={executeSignature}
            executeStatus={executeStatus}
            agentFaucetSignature={agentFaucetSignature}
            agentFaucetStatus={agentFaucetStatus}
            agentFaucetTokenAccount={agentFaucetTokenAccount}
            faucetSignature={faucetSignature}
            faucetStatus={faucetStatus}
            faucetTokenAccount={faucetTokenAccount}
            activeDerivedPolicyPda={activeDerivedPolicyPda}
            agentApiKey={agentApiKey}
            agentCommand={agentCommand}
            agentMessages={agentMessages}
            agentRegistryForm={agentRegistryForm}
            draftPolicyStatus={draftPolicyStatus}
            isAgentExecuting={isAgentExecuting}
            onchainPolicyForm={onchainPolicyForm}
            policy={policy}
            policyAccountStatus={policyAccountStatus}
            policyForm={policyForm}
            policyPda={policyPda}
            productCatalog={productCatalog}
            registryRows={registryRows}
            recipientCatalog={recipientCatalog}
            recipientTokenAccount={recipientTokenAccount}
            requestDevnetTokens={requestDevnetTokens}
            requestSelectedAgentTokens={requestSelectedAgentTokens}
            addAgentToRegistry={addAgentToRegistry}
            removeRegisteredAgent={removeRegisteredAgent}
            clearRegisteredAgentSelection={clearRegisteredAgentSelection}
            setAgentApiKey={setAgentApiKey}
            setAgentCommand={setAgentCommand}
            setAgentRegistryForm={setAgentRegistryForm}
            setExecutePaymentForm={setExecutePaymentForm}
            setOnchainPolicyForm={setOnchainPolicyForm}
            setPolicyForm={setPolicyForm}
            setProductCatalog={setProductCatalog}
            setRecipientCatalog={setRecipientCatalog}
            selectedAgentId={selectedAgentId}
            submitAnchorPolicyInstruction={submitAnchorPolicyInstruction}
            submitAgentCommand={submitAgentCommand}
            togglePause={togglePause}
            useRegisteredAgent={useRegisteredAgent}
            walletAddress={walletAddress}
            selectedProvisionedAgent={selectedProvisionedAgent}
            ownerAuthStatus={ownerAuthStatus}
            provisionedAgents={provisionedAgents}
            selectedProvisionedAgentId={selectedProvisionedAgentId}
            newAgentName={newAgentName}
            latestProvisionedApiKey={latestProvisionedApiKey}
            telegramLinkCode={telegramLinkCode}
            telegramLinkStatus={telegramLinkStatus}
            signInOwnerWallet={signInOwnerWallet}
            createHostedAgent={createHostedAgent}
            rotateHostedAgentApiKey={rotateHostedAgentApiKey}
            createHostedAgentTelegramLink={createHostedAgentTelegramLink}
            unlinkHostedAgentTelegram={unlinkHostedAgentTelegram}
            loadProvisionedAgentIntoPolicy={loadProvisionedAgentIntoPolicy}
            clearHostedAgentSelection={clearHostedAgentSelection}
            setNewAgentName={setNewAgentName}
          />
        ) : activeView === "simulator" ? (
          <SimulatorView findings={simulatorFindings} />
        ) : (
          <AuditLogView events={events} />
        )}
      </main>
    </div>
  );
}

function OperationsView({
  agentTokenAccount,
  anchorSignature,
  anchorStatus,
  applyPolicyUpdate,
  events,
  executePaymentForm,
  executePolicyPayment,
  executeSignature,
  executeStatus,
  agentFaucetSignature,
  agentFaucetStatus,
  agentFaucetTokenAccount,
  faucetSignature,
  faucetStatus,
  faucetTokenAccount,
  activeDerivedPolicyPda,
  agentApiKey,
  agentCommand,
  agentMessages,
  agentRegistryForm,
  draftPolicyStatus,
  isAgentExecuting,
  onchainPolicyForm,
  policy,
  policyAccountStatus,
  policyForm,
  policyPda,
  productCatalog,
  registryRows,
  recipientCatalog,
  recipientTokenAccount,
  requestDevnetTokens,
  requestSelectedAgentTokens,
  addAgentToRegistry,
  removeRegisteredAgent,
  clearRegisteredAgentSelection,
  setAgentApiKey,
  setAgentCommand,
  setAgentRegistryForm,
  setExecutePaymentForm,
  setOnchainPolicyForm,
  setPolicyForm,
  setProductCatalog,
  setRecipientCatalog,
  selectedAgentId,
  submitAnchorPolicyInstruction,
  submitAgentCommand,
  togglePause,
  useRegisteredAgent,
  walletAddress,
  selectedProvisionedAgent,
  ownerAuthStatus,
  provisionedAgents,
  selectedProvisionedAgentId,
  newAgentName,
  latestProvisionedApiKey,
  telegramLinkCode,
  telegramLinkStatus,
  signInOwnerWallet,
  createHostedAgent,
  rotateHostedAgentApiKey,
  createHostedAgentTelegramLink,
  unlinkHostedAgentTelegram,
  loadProvisionedAgentIntoPolicy,
  clearHostedAgentSelection,
  setNewAgentName
}: {
  agentTokenAccount: string | null;
  anchorSignature: string | null;
  anchorStatus: string;
  applyPolicyUpdate: () => void;
  events: SpendEvent[];
  executePaymentForm: typeof defaultExecutePaymentForm;
  executePolicyPayment: () => void;
  executeSignature: string | null;
  executeStatus: string;
  agentFaucetSignature: string | null;
  agentFaucetStatus: string;
  agentFaucetTokenAccount: string | null;
  faucetSignature: string | null;
  faucetStatus: string;
  faucetTokenAccount: string | null;
  activeDerivedPolicyPda: string | null;
  agentApiKey: string;
  agentCommand: string;
  agentMessages: AgentChatMessage[];
  agentRegistryForm: { name: string; wallet: string };
  draftPolicyStatus: string;
  isAgentExecuting: boolean;
  onchainPolicyForm: typeof defaultOnchainPolicyForm;
  policy: typeof initialPolicy;
  policyAccountStatus: PolicyAccountStatus;
  policyForm: PolicyFormValues;
  policyPda: string | null;
  productCatalog: CatalogItem[];
  registryRows: Array<AgentRegistryEntry & { derivedPolicyPda: string | null }>;
  recipientCatalog: CatalogItem[];
  recipientTokenAccount: string | null;
  requestDevnetTokens: () => void;
  requestSelectedAgentTokens: () => void;
  addAgentToRegistry: () => void;
  removeRegisteredAgent: (agentId: string) => void;
  clearRegisteredAgentSelection: () => void;
  setAgentApiKey: Dispatch<SetStateAction<string>>;
  setAgentCommand: Dispatch<SetStateAction<string>>;
  setAgentRegistryForm: Dispatch<SetStateAction<{ name: string; wallet: string }>>;
  setExecutePaymentForm: Dispatch<SetStateAction<typeof defaultExecutePaymentForm>>;
  setOnchainPolicyForm: Dispatch<SetStateAction<typeof defaultOnchainPolicyForm>>;
  setPolicyForm: Dispatch<SetStateAction<PolicyFormValues>>;
  setProductCatalog: Dispatch<SetStateAction<CatalogItem[]>>;
  setRecipientCatalog: Dispatch<SetStateAction<CatalogItem[]>>;
  selectedAgentId: string | null;
  submitAnchorPolicyInstruction: (action: "initialize" | "update" | "pause" | "resume") => void;
  submitAgentCommand: () => void;
  togglePause: () => void;
  useRegisteredAgent: (agent: AgentRegistryEntry) => void;
  walletAddress: string | null;
  selectedProvisionedAgent: ProvisionedAgent | null;
  ownerAuthStatus: string;
  provisionedAgents: ProvisionedAgent[];
  selectedProvisionedAgentId: string | null;
  newAgentName: string;
  latestProvisionedApiKey: string | null;
  telegramLinkCode: string | null;
  telegramLinkStatus: string;
  signInOwnerWallet: () => void;
  createHostedAgent: () => void;
  rotateHostedAgentApiKey: (agentId: string) => void;
  createHostedAgentTelegramLink: (agentId: string) => void;
  unlinkHostedAgentTelegram: (agentId: string) => void;
  loadProvisionedAgentIntoPolicy: (agent: ProvisionedAgent) => void;
  clearHostedAgentSelection: () => void;
  setNewAgentName: Dispatch<SetStateAction<string>>;
}) {
  const displayedPolicyPda = policyPda ?? activeDerivedPolicyPda;
  const canInitializePolicy = Boolean(displayedPolicyPda) && policyAccountStatus === "missing";
  const canUseExistingPolicy = Boolean(displayedPolicyPda) && policyAccountStatus === "initialized";
  const canEditPolicyDraft = Boolean(walletAddress);
  const draftPolicyStatusText = canEditPolicyDraft
    ? draftPolicyStatus
    : "Connect owner wallet before updating the draft policy.";
  const policyPdaLabel =
    policyAccountStatus === "initialized"
      ? "Initialized policy PDA"
      : displayedPolicyPda
        ? "Derived policy PDA"
        : "Policy PDA";
  const policyStatusText =
    policyAccountStatus === "checking"
      ? "Checking on-chain status..."
      : policyAccountStatus === "initialized"
        ? "Initialized"
        : policyAccountStatus === "missing"
          ? "Not initialized"
          : policyAccountStatus === "error"
            ? "Status unavailable"
            : "Waiting for owner and agent";

  return (
    <section className="grid workspace" style={{ marginTop: 16 }}>
      <div className="grid">
        <section className="panel">
          <h2>How enforcement works</h2>
          <div className="setup-grid">
            <div className="event">
              <header>
                <strong>Policy PDA</strong>
                <WalletCards size={16} color="var(--blue)" />
              </header>
              <p>Stores owner, agent, caps, counters, approval threshold, and allowlisted recipients.</p>
            </div>
            <div className="event">
              <header>
                <strong>Program-routed transfer</strong>
                <CircleDollarSign size={16} color="var(--green)" />
              </header>
              <p>The agent calls AgentSpend before SPL tokens move, so policy checks happen on-chain.</p>
            </div>
            <div className="event">
              <header>
                <strong>Audit proof</strong>
                <Activity size={16} color="var(--cyan)" />
              </header>
              <p>Approved and rejected actions are visible in the app, with devnet transaction links for successful payments.</p>
            </div>
          </div>
          <div className="setup-grid" style={{ marginTop: 14 }}>
            <div className="event">
              <header>
                <strong>Fund selected hosted agent</strong>
                <FlaskConical size={16} color="var(--cyan)" />
              </header>
              <p>
                The agent needs devnet SOL for fees and AgentSpend test tokens for payments.
                Get SOL manually, then mint test tokens here.
              </p>
              <p>
                Agent wallet{" "}
                <strong>{selectedProvisionedAgent ? selectedProvisionedAgent.publicKey : "select an agent"}</strong>
              </p>
              <div className="link-row">
                <a
                  className="explorer-link"
                  href="https://faucet.solana.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={15} /> Get devnet SOL
                </a>
                {selectedProvisionedAgent ? (
                  <a
                    className="explorer-link"
                    href={getExplorerAddressUrl(selectedProvisionedAgent.publicKey)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={15} /> View agent wallet
                  </a>
                ) : null}
              </div>
              <p>{agentFaucetStatus}</p>
              {agentFaucetTokenAccount ? (
                <p>
                  Token account <strong>{agentFaucetTokenAccount}</strong>
                </p>
              ) : null}
              {agentFaucetSignature ? (
                <a
                  className="explorer-link"
                  href={getExplorerTransactionUrl(agentFaucetSignature)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={15} /> View agent faucet transaction
                </a>
              ) : null}
              <div className="button-row" style={{ marginTop: 12 }}>
                <button
                  className="button"
                  type="button"
                  onClick={requestSelectedAgentTokens}
                  disabled={!selectedProvisionedAgent}
                >
                  <FlaskConical size={17} /> Mint tokens to selected agent
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>Devnet proof links</h2>
          <div className="proof-grid">
            <ProofLink
              label="AgentSpend program"
              value={onchainPolicyForm.programId}
              href={getExplorerAddressUrl(onchainPolicyForm.programId)}
            />
            <ProofLink
              label="Policy account"
              value={displayedPolicyPda ?? "Connect owner and choose agent"}
              href={displayedPolicyPda ? getExplorerAddressUrl(displayedPolicyPda) : null}
            />
            <ProofLink
              label="Latest policy transaction"
              value={anchorSignature ?? "No policy transaction yet"}
              href={anchorSignature ? getExplorerTransactionUrl(anchorSignature) : null}
            />
            <ProofLink
              label="Latest agent payment"
              value={executeSignature ?? "No payment transaction yet"}
              href={executeSignature ? getExplorerTransactionUrl(executeSignature) : null}
            />
          </div>
        </section>

        <section className="panel span-2">
          <h2>Production agent setup</h2>
          <p className="section-note">
            Self-serve path for judges: sign as owner, generate a hosted devnet agent wallet, initialize its policy, then link Telegram without editing backend env.
          </p>
          <div className="policy-form">
            <EditableField
              label="New agent name"
              value={newAgentName}
              onChange={setNewAgentName}
            />
            <ReadOnlyField
              label="Owner session"
              value={ownerAuthStatus}
            />
          </div>
          <div className="button-row" style={{ marginTop: 14 }}>
            <button className="button secondary" type="button" onClick={signInOwnerWallet}>
              <WalletCards size={17} /> Sign in with wallet
            </button>
            <button className="button" type="button" onClick={createHostedAgent} disabled={!walletAddress}>
              <Plus size={17} /> Generate hosted agent
            </button>
          </div>
          {latestProvisionedApiKey ? (
            <div className="devnet-card" style={{ marginTop: 14 }}>
              <span>One-time agent API key</span>
              <strong>{latestProvisionedApiKey}</strong>
              <p>Copy this now. AgentSpend stores only the hash and will not show the full key again.</p>
            </div>
          ) : null}
          {telegramLinkCode ? (
            <div className="devnet-card" style={{ marginTop: 14 }}>
              <span>Telegram link command</span>
              <strong>/link {telegramLinkCode}</strong>
              <p>{telegramLinkStatus}</p>
            </div>
          ) : (
            <p className="inline-status">
              <Bot size={15} /> {telegramLinkStatus}
            </p>
          )}
          <div className="agent-table" style={{ marginTop: 14 }}>
            <div className="agent-table-row header">
              <span>Agent</span>
              <span>Wallet</span>
              <span>Policy</span>
              <span>Telegram</span>
              <span>Actions</span>
            </div>
            {provisionedAgents.length ? (
              provisionedAgents.map((agent) => {
                const isSelected = selectedProvisionedAgentId === agent.id;

                return (
                  <div
                    className={isSelected ? "agent-table-row selected" : "agent-table-row"}
                    key={agent.id}
                  >
                    <span>
                      <strong>{agent.name}</strong>
                      {isSelected ? <small>Active</small> : null}
                    </span>
                    <span title={agent.publicKey}>{shortAddress(agent.publicKey)}</span>
                    <span title={agent.policyPda ?? ""}>{agent.policyPda ? shortAddress(agent.policyPda) : "not set"}</span>
                    <span>{agent.telegramChatId ? "linked" : "not linked"}</span>
                    <div className="button-row compact">
                      <button
                        className={isSelected ? "button small" : "button secondary small"}
                        type="button"
                        onClick={() => (isSelected ? clearHostedAgentSelection() : loadProvisionedAgentIntoPolicy(agent))}
                      >
                        {isSelected ? "Unuse" : "Use"}
                      </button>
                      <button className="button secondary small" type="button" onClick={() => createHostedAgentTelegramLink(agent.id)}>
                        Link
                      </button>
                      <button className="button secondary small" type="button" onClick={() => rotateHostedAgentApiKey(agent.id)}>
                        Rotate
                      </button>
                      {agent.telegramChatId ? (
                        <button className="icon-button" type="button" onClick={() => unlinkHostedAgentTelegram(agent.id)} title="Unlink Telegram">
                          <X size={15} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="agent-table-row">
                <span>No hosted agents yet.</span>
                <span />
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Judge devnet setup</h2>
          <div className="setup-grid">
            <div className="event">
              <header>
                <strong>1. Connect owner wallet</strong>
                <WalletCards size={16} color="var(--blue)" />
              </header>
              <p>Use Phantom on devnet. The connected wallet owns the policy account.</p>
            </div>
            <div className="event">
              <header>
                <strong>2. Fund agent test tokens</strong>
                <FlaskConical size={16} color="var(--cyan)" />
              </header>
              <p>{faucetStatus}</p>
              {faucetTokenAccount ? (
                <p>
                  Token account <strong>{faucetTokenAccount}</strong>
                </p>
              ) : null}
              {faucetSignature ? (
                <a
                  className="explorer-link"
                  href={getExplorerTransactionUrl(faucetSignature)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={15} /> View faucet transaction
                </a>
              ) : null}
            </div>
            <div className="event">
              <header>
                <strong>3. Run policy-gated payment</strong>
                <CircleDollarSign size={16} color="var(--green)" />
              </header>
              <p>Initialize the policy, then execute through AgentSpend so the program checks caps and allowlists before transfer.</p>
            </div>
          </div>
          <div className="button-row" style={{ marginTop: 14 }}>
            <button className="button" type="button" onClick={requestDevnetTokens}>
              <FlaskConical size={17} /> Fund connected wallet
            </button>
          </div>
        </section>

        <section className="panel" id="policy">
          <h2>Owner-managed policy</h2>
          <div className="policy-form">
            <ReadOnlyField
              label="Your wallet"
              help="The connected wallet that owns and updates this policy."
              value={walletAddress ?? "Not connected"}
            />
            <ReadOnlyField
              label="Policy state"
              help="Active lets the agent spend within policy. Paused blocks all spending."
              value={policy.status}
            />
            <EditableField
              label="Max per payment ($)"
              help="The most the agent can spend in one transaction without being rejected."
              value={policyForm.maxPerPaymentUsd}
              onChange={(value) =>
                setPolicyForm((current) => ({ ...current, maxPerPaymentUsd: value }))
              }
            />
            <EditableField
              label="Daily budget ($)"
              help="Total amount the agent can spend during the current budget window."
              value={policyForm.dailyBudgetUsd}
              onChange={(value) =>
                setPolicyForm((current) => ({ ...current, dailyBudgetUsd: value }))
              }
            />
            <EditableField
              label="Require approval above ($)"
              help="Payments above this amount need an owner-approved payment intent before execution."
              value={policyForm.approvalThresholdUsd}
              onChange={(value) =>
                setPolicyForm((current) => ({ ...current, approvalThresholdUsd: value }))
              }
            />
            <DropdownCatalogField
              label="Products / programs the agent can interact with"
              help="Add the real Solana program, contract, or vendor interaction address. Checked items are enabled in the draft policy metadata; unchecked items stay saved but inactive."
              addLabelPlaceholder="Product name"
              addValuePlaceholder="Program or vendor address"
              items={productCatalog}
              className="span-2"
              onChange={setProductCatalog}
            />
            <PresetEditableField
              label="Spend categories"
              help="Choose categories the agent is allowed to spend in, or type custom categories."
              value={policyForm.allowedCategories}
              options={categoryPresets}
              onChange={(value) =>
                setPolicyForm((current) => ({ ...current, allowedCategories: value }))
              }
            />
          </div>
          <div className="button-row" style={{ marginTop: 14 }}>
            <button
              className="button"
              type="button"
              onClick={applyPolicyUpdate}
              disabled={!canEditPolicyDraft}
              title={canEditPolicyDraft ? "Update the local policy draft." : "Connect owner wallet first."}
            >
              <ShieldCheck size={17} /> Update policy draft
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={togglePause}
              disabled={!canEditPolicyDraft}
              title={canEditPolicyDraft ? "Change the draft policy status." : "Connect owner wallet first."}
            >
              {policy.status === "active" ? <PauseCircle size={17} /> : <PlayCircle size={17} />}
              {policy.status === "active" ? "Pause draft" : "Resume draft"}
            </button>
          </div>
          <p className={`inline-status ${canEditPolicyDraft ? "success" : "warning"}`}>
            {canEditPolicyDraft ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {draftPolicyStatusText}
          </p>
        </section>

        <section className="panel">
          <h2>Agent registry</h2>
          <p className="section-note">
            Register each AI agent wallet separately. Every agent gets its own policy account under the shared AgentSpend program.
          </p>
          <div className="policy-form">
            <EditableField
              label="Agent name"
              help="A human-readable label, like Trading Agent or Research Agent."
              value={agentRegistryForm.name}
              onChange={(value) =>
                setAgentRegistryForm((current) => ({ ...current, name: value }))
              }
            />
            <EditableField
              label="Agent wallet public key"
              help="The wallet your AI agent uses to sign policy-gated transactions."
              value={agentRegistryForm.wallet}
              onChange={(value) =>
                setAgentRegistryForm((current) => ({ ...current, wallet: value }))
              }
            />
          </div>
          <div className="button-row" style={{ marginTop: 14 }}>
            <button className="button" type="button" onClick={addAgentToRegistry}>
              <Plus size={17} /> Register agent
            </button>
          </div>
          <div className="agent-table" style={{ marginTop: 16 }}>
            <div className="agent-table-row header">
              <span>Agent</span>
              <span>Wallet</span>
              <span>Policy account</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {registryRows.length ? (
              registryRows.map((agent) => {
                const isSelected = selectedAgentId === agent.id;

                return (
                <div className={isSelected ? "agent-table-row selected" : "agent-table-row"} key={agent.id}>
                  <span>
                    <strong>{agent.name}</strong>
                    {isSelected ? <small>Active</small> : null}
                  </span>
                  <span title={agent.wallet}>{shortAddress(agent.wallet)}</span>
                  <span title={agent.policyPda ?? agent.derivedPolicyPda ?? ""}>
                    {agent.policyPda
                      ? shortAddress(agent.policyPda)
                      : agent.derivedPolicyPda
                        ? `${shortAddress(agent.derivedPolicyPda)} derived`
                        : "Connect owner"}
                  </span>
                  <span>
                    <span className={`registry-status ${agent.status}`}>{agent.status}</span>
                  </span>
                  <span className="agent-actions">
                    <button
                      className={isSelected ? "button small" : "button secondary small"}
                      type="button"
                      onClick={() => (isSelected ? clearRegisteredAgentSelection() : useRegisteredAgent(agent))}
                    >
                      {isSelected ? "Unuse" : "Use"}
                    </button>
                    {agent.policyPda ? (
                      <a
                        className="icon-button ghost"
                        href={getExplorerAddressUrl(agent.policyPda)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View ${agent.name} policy`}
                      >
                        <ExternalLink size={15} />
                      </a>
                    ) : null}
                    <button
                      className="icon-button ghost"
                      type="button"
                      aria-label={`Remove ${agent.name}`}
                      onClick={() => removeRegisteredAgent(agent.id)}
                    >
                      <X size={15} />
                    </button>
                  </span>
                </div>
                );
              })
            ) : (
              <p className="empty-note">No agents registered yet. Add an agent wallet above to create its policy.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Anchor policy account</h2>
          <div className="policy-form">
            <ReadOnlyField
              label="AgentSpend program"
              help="The deployed devnet program that enforces policy before token transfers."
              value={onchainPolicyForm.programId}
              className="span-2"
            />
            <EditableField
              label="Agent wallet address"
              help="The public key of the wallet your AI agent uses to sign payment transactions."
              value={onchainPolicyForm.agent}
              className="span-2"
              onChange={(value) =>
                setOnchainPolicyForm((current) => ({ ...current, agent: value }))
              }
            />
            <SelectEditableField
              label="Token the agent can spend"
              help="Choose the SPL token mint the policy allows. The agent must hold this token."
              value={onchainPolicyForm.tokenMint}
              options={tokenMintPresets}
              className="span-2"
              onChange={(value) =>
                setOnchainPolicyForm((current) => ({ ...current, tokenMint: value }))
              }
            />
            <ChecklistCatalogField
              label="Allowed recipient wallets"
              help="Add recipient wallet public keys. Checked wallets are written into the on-chain policy allowlist; unchecked wallets stay saved but cannot receive agent payments."
              addLabelPlaceholder="Recipient name"
              addValuePlaceholder="Wallet public key"
              items={recipientCatalog}
              className="span-2"
              onChange={setRecipientCatalog}
            />
            <EditableField
              label="Budget reset window (seconds)"
              help="How long the daily budget window lasts. 86400 means 24 hours."
              value={onchainPolicyForm.periodSeconds}
              onChange={(value) =>
                setOnchainPolicyForm((current) => ({ ...current, periodSeconds: value }))
              }
            />
          </div>
          <div className="devnet-card" style={{ marginTop: 14 }}>
            <div>
              <span className="eyebrow">{policyPdaLabel}</span>
              <strong>{displayedPolicyPda ?? "Not derived yet"}</strong>
            </div>
            <span className={`registry-status ${policyAccountStatus === "initialized" ? "initialized" : policyAccountStatus === "missing" ? "draft" : ""}`}>
              {policyStatusText}
            </span>
            <p>{anchorStatus}</p>
            <div className="link-row">
              {displayedPolicyPda ? (
                <a
                  className="explorer-link"
                  href={getExplorerAddressUrl(displayedPolicyPda)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={15} /> View policy account
                </a>
              ) : null}
              {anchorSignature ? (
                <a
                  className="explorer-link"
                  href={getExplorerTransactionUrl(anchorSignature)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={15} /> View policy transaction
                </a>
              ) : null}
            </div>
            <div className="button-row">
              <button
                className="button"
                type="button"
                disabled={!canInitializePolicy}
                onClick={() => submitAnchorPolicyInstruction("initialize")}
                title={
                  canInitializePolicy
                    ? "Initialize this policy account once."
                    : canUseExistingPolicy
                      ? "This policy account is already initialized. Use Update on-chain policy."
                      : "Connect owner wallet and enter an agent wallet first."
                }
              >
                <ShieldCheck size={17} /> Initialize on-chain policy
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={!canUseExistingPolicy}
                onClick={() => submitAnchorPolicyInstruction("update")}
              >
                <ShieldCheck size={17} /> Update on-chain policy
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={!canUseExistingPolicy}
                onClick={() =>
                  submitAnchorPolicyInstruction(policy.status === "active" ? "pause" : "resume")
                }
              >
                {policy.status === "active" ? <PauseCircle size={17} /> : <PlayCircle size={17} />}
                {policy.status === "active" ? "Pause on-chain" : "Resume on-chain"}
              </button>
            </div>
          </div>
        </section>

        <section className="panel" id="agent-chat">
          <h2>AI agent chat</h2>
          <div className="agent-chat">
            <div className="chat-messages" aria-live="polite">
              {agentMessages.map((message) => (
                <div className={`chat-message ${message.role}`} key={message.id}>
                  <span>{message.role === "owner" ? "Owner" : "Agent"}</span>
                  <p>{message.content}</p>
                  {message.explorerUrl ? (
                    <a
                      className="explorer-link"
                      href={message.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={15} /> View transaction
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="policy-form">
              <EditableField
                label="Demo agent API key"
                value={agentApiKey}
                className="span-2"
                onChange={setAgentApiKey}
              />
              <EditableField
                label="Message to agent"
                value={agentCommand}
                className="span-2"
                onChange={setAgentCommand}
              />
            </div>
            <div className="button-row" style={{ marginTop: 14 }}>
              <button
                className="button"
                type="button"
                disabled={isAgentExecuting}
                onClick={submitAgentCommand}
              >
                <Bot size={17} /> {isAgentExecuting ? "Agent executing..." : "Send to agent"}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() =>
                  setAgentCommand(
                    `send ${executePaymentForm.amount} token to ${
                      executePaymentForm.recipient || "<recipient-public-key>"
                    }`
                  )
                }
              >
                Use executor values
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>Agent API integration</h2>
          <div className="devnet-card">
            <p>
              A Telegram bot or backend agent calls this HTTP route after it turns an owner command into a payment intent. The server signs with the configured agent wallet, then submits the same on-chain `execute_payment` instruction used above.
            </p>
            <pre className="code-panel">{`POST /api/agent/payments/execute
Authorization: Bearer $AGENTSPEND_AGENT_API_KEY
Content-Type: application/json

{
  "programId": "${onchainPolicyForm.programId}",
  "policyPda": "${displayedPolicyPda ?? "<initialize-policy-first>"}",
  "recipient": "${executePaymentForm.recipient || "<recipient-public-key>"}",
  "tokenMint": "${onchainPolicyForm.tokenMint}",
  "amount": "${executePaymentForm.amount}",
  "decimals": ${Number(executePaymentForm.decimals) || 6}
}`}</pre>
          </div>
        </section>

        <section className="panel">
          <h2>Manual payment test</h2>
          <p className="section-note">
            Demo fallback: use this when you want Phantom to sign the agent payment manually. The normal agent workflow is AI Agent Chat or Telegram calling the backend executor.
          </p>
          <div className="policy-form">
            <ReadOnlyField
              label="Policy account"
              help="The on-chain policy PDA that AgentSpend checks before allowing payment."
              value={displayedPolicyPda ?? "Initialize policy first"}
            />
            <ReadOnlyField
              label="Token being spent"
              help="The SPL token mint configured in the policy."
              value={onchainPolicyForm.tokenMint}
            />
            <EditableField
              label="Recipient wallet address"
              help="The wallet that receives the token payment. It must be allowed by the on-chain policy."
              value={executePaymentForm.recipient}
              className="span-2"
              onChange={(value) =>
                setExecutePaymentForm((current) => ({ ...current, recipient: value }))
              }
            />
            <EditableField
              label="Amount to send"
              help="Token amount to transfer, using the decimals below."
              value={executePaymentForm.amount}
              onChange={(value) =>
                setExecutePaymentForm((current) => ({ ...current, amount: value }))
              }
            />
            <EditableField
              label="Token decimals"
              help="Decimals for the selected SPL token. AgentSpend Test Token uses 6."
              value={executePaymentForm.decimals}
              onChange={(value) =>
                setExecutePaymentForm((current) => ({ ...current, decimals: value }))
              }
            />
          </div>
          <div className="devnet-card" style={{ marginTop: 14 }}>
            <div>
              <span className="eyebrow">Agent token account</span>
              <strong>{agentTokenAccount ?? "Not checked yet"}</strong>
            </div>
            <div>
              <span className="eyebrow">Recipient token account</span>
              <strong>{recipientTokenAccount ?? "Not checked yet"}</strong>
            </div>
            <p>{executeStatus}</p>
            {executeSignature ? (
              <a
                className="explorer-link"
                href={getExplorerTransactionUrl(executeSignature)}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} /> View payment transaction
              </a>
            ) : null}
            <div className="button-row">
              <button className="button" type="button" onClick={executePolicyPayment}>
                <CircleDollarSign size={17} /> Run manual payment test
              </button>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function AuditLogView({ events }: { events: SpendEvent[] }) {
  return (
    <section className="panel audit-panel" style={{ marginTop: 16 }}>
      <h2>Audit log</h2>
      <AuditTimeline events={events} />
    </section>
  );
}

function ProofLink({
  label,
  value,
  href
}: {
  label: string;
  value: string;
  href: string | null;
}) {
  return (
    <div className="proof-link">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      {href ? (
        <a className="explorer-link" href={href} target="_blank" rel="noreferrer">
          <ExternalLink size={15} /> View on Explorer
        </a>
      ) : (
        <span className="proof-placeholder">Waiting for transaction</span>
      )}
    </div>
  );
}

function SimulatorView({
  findings
}: {
  findings: ReturnType<typeof simulatePolicyAttacks>;
}) {
  return (
    <section className="panel simulator-panel" style={{ marginTop: 16 }}>
      <h2>Policy simulator</h2>
      <div className="timeline">
        {findings.map((finding) => (
          <div className="event" key={finding.id}>
            <header>
              <strong>{finding.title}</strong>
              <span className={`decision-pill sim-${finding.status}`}>{finding.status}</span>
            </header>
            <p>{finding.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AuditTimeline({ events }: { events: SpendEvent[] }) {
  return (
    <div className="timeline">
      {events.map((event) => (
        <div className="event" key={event.id}>
          <header>
            <strong>{event.vendorName}</strong>
            <DecisionIcon decision={event.decision} />
          </header>
          <p>
            {event.amountUsd > 0 ? `$${event.amountUsd} for ` : ""}
            {event.category}. {event.reasons.join(" ")}
          </p>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  help,
  className
}: {
  label: string;
  value: string;
  help?: string;
  className?: string;
}) {
  return (
    <div className={`field ${className ?? ""}`}>
      <FieldLabel label={label} help={help} />
      <input readOnly value={value} />
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  help,
  className
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  className?: string;
}) {
  return (
    <div className={`field ${className ?? ""}`}>
      <FieldLabel label={label} help={help} />
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function PresetEditableField({
  label,
  value,
  options,
  onChange,
  help,
  className
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  help?: string;
  className?: string;
}) {
  return (
    <div className={`field preset-field ${className ?? ""}`}>
      <FieldLabel label={label} help={help} />
      <div className="preset-control">
        <select
          defaultValue=""
          aria-label={`Add preset for ${label}`}
          onChange={(event) => {
            appendCsvValue(value, event.target.value, onChange);
            event.currentTarget.value = "";
          }}
        >
          <option value="">Add existing option...</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}

function SelectEditableField({
  label,
  value,
  options,
  onChange,
  help,
  className
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  help?: string;
  className?: string;
}) {
  return (
    <div className={`field preset-field ${className ?? ""}`}>
      <FieldLabel label={label} help={help} />
      <div className="preset-control">
        <select
          value={options.some((option) => option.value === value) ? value : ""}
          aria-label={`Choose preset for ${label}`}
          onChange={(event) => {
            if (event.target.value) {
              onChange(event.target.value);
            }
          }}
        >
          <option value="">Custom token mint</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}

function ChecklistCatalogField({
  label,
  items,
  onChange,
  help,
  addLabelPlaceholder,
  addValuePlaceholder,
  className
}: {
  label: string;
  items: CatalogItem[];
  onChange: Dispatch<SetStateAction<CatalogItem[]>>;
  help?: string;
  addLabelPlaceholder: string;
  addValuePlaceholder: string;
  className?: string;
}) {
  const [draftLabel, setDraftLabel] = useState("");
  const [draftValue, setDraftValue] = useState("");

  function addItem() {
    const value = draftValue.trim();
    const nextLabel = draftLabel.trim() || shortAddress(value);

    if (!value) {
      return;
    }

    onChange((current) => addCatalogItem(current, nextLabel, value, true));
    setDraftLabel("");
    setDraftValue("");
  }

  return (
    <div className={`field checklist-field ${className ?? ""}`}>
      <FieldLabel label={label} help={help} />
      <div className="catalog-add-row">
        <input
          value={draftLabel}
          placeholder={addLabelPlaceholder}
          onChange={(event) => setDraftLabel(event.target.value)}
        />
        <input
          value={draftValue}
          placeholder={addValuePlaceholder}
          onChange={(event) => setDraftValue(event.target.value)}
        />
        <button className="icon-button" type="button" aria-label={`Add ${label}`} onClick={addItem}>
          <Plus size={16} />
        </button>
      </div>
      <div className="checklist-card">
        {items.length ? (
          items.map((item) => (
            <label className="checklist-item" key={item.id}>
              <input
                type="checkbox"
                checked={item.selected}
                onChange={(event) =>
                  onChange((current) =>
                    current.map((candidate) =>
                      candidate.id === item.id
                        ? { ...candidate, selected: event.target.checked }
                        : candidate
                    )
                  )
                }
              />
              <span>
                <strong>{item.label}</strong>
                <small>{item.value}</small>
              </span>
              <button
                className="icon-button ghost"
                type="button"
                aria-label={`Remove ${item.label}`}
                onClick={(event) => {
                  event.preventDefault();
                  onChange((current) => current.filter((candidate) => candidate.id !== item.id));
                }}
              >
                <X size={15} />
              </button>
            </label>
          ))
        ) : (
          <p className="empty-note">No saved entries yet. Add one above, then check it to allow it.</p>
        )}
      </div>
    </div>
  );
}

function DropdownCatalogField({
  label,
  items,
  onChange,
  help,
  addLabelPlaceholder,
  addValuePlaceholder,
  className
}: {
  label: string;
  items: CatalogItem[];
  onChange: Dispatch<SetStateAction<CatalogItem[]>>;
  help?: string;
  addLabelPlaceholder: string;
  addValuePlaceholder: string;
  className?: string;
}) {
  const [draftLabel, setDraftLabel] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const selectedItems = items.filter((item) => item.selected);
  const selectedSummary = selectedItems.length
    ? `${selectedItems.length} selected: ${selectedItems.map((item) => item.label).join(", ")}`
    : "No products selected";

  function addItem() {
    const value = draftValue.trim();
    const nextLabel = draftLabel.trim() || shortAddress(value);

    if (!value) {
      return;
    }

    onChange((current) => addCatalogItem(current, nextLabel, value, true));
    setDraftLabel("");
    setDraftValue("");
  }

  return (
    <div className={`field checklist-field ${className ?? ""}`}>
      <FieldLabel label={label} help={help} />
      <div className="catalog-add-row">
        <input
          value={draftLabel}
          placeholder={addLabelPlaceholder}
          onChange={(event) => setDraftLabel(event.target.value)}
        />
        <input
          value={draftValue}
          placeholder={addValuePlaceholder}
          onChange={(event) => setDraftValue(event.target.value)}
        />
        <button className="icon-button" type="button" aria-label={`Add ${label}`} onClick={addItem}>
          <Plus size={16} />
        </button>
      </div>
      <select
        value=""
        aria-label={label}
        onChange={(event) => {
          const selectedId = event.target.value;

          if (!selectedId) {
            return;
          }

          onChange((current) =>
            current.map((item) =>
              item.id === selectedId ? { ...item, selected: !item.selected } : item
            )
          );
          event.currentTarget.value = "";
        }}
      >
        <option value="">{selectedSummary}</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.selected ? "✓ " : ""}{item.label}
          </option>
        ))}
      </select>
      {selectedItems.length ? (
        <div className="selected-chip-row">
          {selectedItems.map((item) => (
            <button
              className="selected-chip"
              key={item.id}
              type="button"
              title={item.value}
              onClick={() =>
                onChange((current) =>
                  current.map((candidate) =>
                    candidate.id === item.id ? { ...candidate, selected: false } : candidate
                  )
                )
              }
            >
              {item.label} <X size={13} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FieldLabel({ label, help }: { label: string; help?: string }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      {help ? (
        <span className="info-dot" title={help} aria-label={help}>
          <Info size={13} />
        </span>
      ) : null}
    </label>
  );
}

function appendCsvValue(
  currentValue: string,
  nextValue: string,
  onChange: (value: string) => void
) {
  if (!nextValue) {
    return;
  }

  const values = currentValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!values.includes(nextValue)) {
    values.push(nextValue);
  }

  onChange(values.join(", "));
}

function activeCatalogValues(items: CatalogItem[]): string[] {
  return items.filter((item) => item.selected).map((item) => item.value);
}

function addCatalogItem(
  items: CatalogItem[],
  label: string,
  value: string,
  selected: boolean
): CatalogItem[] {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return items;
  }

  const existing = items.find((item) => item.value === trimmedValue);

  if (existing) {
    return items.map((item) =>
      item.id === existing.id
        ? { ...item, label: label.trim() || item.label, selected: selected || item.selected }
        : item
    );
  }

  return [
    ...items,
    {
      id: `catalog_${Date.now()}_${items.length}`,
      label: label.trim() || shortAddress(trimmedValue),
      value: trimmedValue,
      selected
    }
  ];
}

function syncCatalogSelection(defaultItems: CatalogItem[], csvValue: string): CatalogItem[] {
  const selectedValues = new Set(parseCsvValues(csvValue));
  const knownValues = new Set(defaultItems.map((item) => item.value));
  const syncedDefaults = defaultItems.map((item) => ({
    ...item,
    selected: selectedValues.has(item.value) || (!csvValue.trim() && item.selected)
  }));
  const customItems = [...selectedValues]
    .filter((value) => !knownValues.has(value))
    .map((value) => ({
      id: `catalog_${value}`,
      label: shortAddress(value),
      value,
      selected: true
    }));

  return [...syncedDefaults, ...customItems];
}

function parseCsvValues(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAgentRegistry(value: string | null): AgentRegistryEntry[] | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as AgentRegistryEntry[];

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.filter(
      (agent) =>
        typeof agent.id === "string" &&
        typeof agent.name === "string" &&
        typeof agent.wallet === "string" &&
        (agent.status === "draft" || agent.status === "initialized" || agent.status === "paused")
    );
  } catch {
    return null;
  }
}

function deriveRegistryPolicyPda(
  programId: string,
  ownerAddress: string | null,
  agentAddress: string
): string | null {
  if (!ownerAddress) {
    return null;
  }

  try {
    const [pda] = derivePolicyPda(
      parsePublicKey(programId, "Program ID"),
      parsePublicKey(ownerAddress, "Owner"),
      parsePublicKey(agentAddress, "Agent")
    );

    return pda.toBase58();
  } catch {
    return null;
  }
}

function DecisionIcon({ decision }: { decision: string }) {
  if (decision === "approved") {
    return <CheckCircle2 size={16} color="var(--green)" />;
  }

  if (decision === "denied") {
    return <AlertTriangle size={16} color="var(--red)" />;
  }

  return <AlertTriangle size={16} color="var(--yellow)" />;
}

function getErrorMessage(error: unknown) {
  const text = stringifyWalletError(error);

  if (isAlreadyInitializedError(text)) {
    return "This policy account is already initialized. Use Update on-chain policy to change its rules.";
  }

  if (text) {
    return text;
  }

  return "The wallet action was cancelled.";
}

async function readJsonResponse<T = unknown>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with ${response.status}.`);
  }

  return payload;
}

function upsertProvisionedAgent(agents: ProvisionedAgent[], agent: ProvisionedAgent) {
  const exists = agents.some((current) => current.id === agent.id);
  return exists
    ? agents.map((current) => (current.id === agent.id ? agent : current))
    : [agent, ...agents];
}

function upsertAgentRegistryEntry(
  agents: AgentRegistryEntry[],
  agent: AgentRegistryEntry
) {
  const exists = agents.some((current) => current.id === agent.id);
  return exists
    ? agents.map((current) => (current.id === agent.id ? { ...current, ...agent } : current))
    : [agent, ...agents];
}

function stringifyWalletError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const maybeError = error as { message?: unknown; error?: { message?: unknown } };
    if (typeof maybeError.message === "string") {
      return maybeError.message;
    }
    if (typeof maybeError.error?.message === "string") {
      return maybeError.error.message;
    }
    return JSON.stringify(error);
  }

  return "";
}

function isAlreadyInitializedError(message: string) {
  return /already in use|account.*already.*initialized|custom program error:\s*0x0\b|InstructionError.*Custom.*0/i.test(
    message
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
