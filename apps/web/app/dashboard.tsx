"use client";

import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Copy,
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
import { parseSuiAgentCommand, scaleSuiOrderQuantity } from "../lib/sui-agent-command";
import {
  applySuiDeepBookMarket,
  buildSuiDashboardCommands,
  canReviewSuiLaunchStage,
  findSuiDeepBookMarketId,
  getSuiFundingReadiness,
  getSuiGasReadiness,
  getSuiBudgetMetrics,
  getSuiLaunchStage,
  getSuiPolicyExpiryState,
  mergeSuiActivityIntoConfig,
  normalizeSuiDashboardConfig,
  formatSuiTokenAmount,
  resolveSuiActivityConfig,
  suiDeepBookMarkets,
  type SuiActivityEvent,
  type SuiDashboardConfig,
  type SuiDeepBookOrder,
  type SuiLaunchStage,
  suiActivityEventLabels,
  suiOverflowProofItems
} from "../lib/sui-dashboard";
import { policy as initialPolicy, spendEvents } from "../lib/demo-data";
import {
  parseDemoState,
  policyToFormValues,
  serializeDemoState,
  updatePolicyFromForm
} from "../lib/demo-state";
import type { PolicyFormValues } from "../lib/demo-state";
import {
  buildSuiAutonomousDemoSteps,
  buildSuiOverBudgetConfig,
  describeSuiBudgetProofRejection,
  mergeSuiActionResultIntoConfig,
  parseSuiAgentMandate,
  submitSuiDashboardAction,
  type SuiDashboardActionId
} from "../lib/sui-dashboard-actions";
import {
  decryptSuiLocalWalletBundle,
  encryptSuiLocalWalletBundle,
  generateSuiLocalWalletBundle,
  type EncryptedSuiLocalWalletBundle,
  type SuiLocalWalletBundle
} from "../lib/sui-local-wallets";
import {
  buildAnchorPolicyArgs,
  buildAnchorPolicyTransaction,
  buildApprovePaymentIntentTransaction,
  buildExecutePaymentTransaction,
  buildInitializePolicyInstruction,
  buildOwnerPolicyActionInstruction,
  buildUpdatePolicyInstruction,
  createDevnetConnection,
  defaultAgentSpendProgramId,
  derivePolicyPda,
  getExplorerAddressUrl,
  getExplorerTransactionUrl,
  getPhantomProvider,
  parsePublicKey,
  type PhantomProvider,
  defaultDevnetUsdcMint
} from "../lib/solana-devnet";

const storageKey = "agentwallet.dashboard-state.v2";
const agentRegistryStorageKey = "agentspend.agent-registry.v1";
const tokenCatalogStorageKey = "agentwallet.token-catalog.v1";
const suiDashboardStorageKey = "agentwallet.sui-dashboard.v1";
const suiLocalWalletStorageKey = "agentwallet.sui-local-wallets.v1";
const demoMerchantResourcePath = "/api/demo-merchant/resource";
const sdkBaseUrlExample = "https://your-agentwallet.vercel.app";

function getSuggestedHostedAgentName(existingAgentCount: number) {
  return `Agent ${existingAgentCount + 1}`;
}

const defaultOnchainPolicyForm = {
  programId: defaultAgentSpendProgramId,
  agent: "",
  tokenMint: defaultDevnetUsdcMint,
  allowedRecipients: "",
  periodSeconds: ""
};

const defaultExecutePaymentForm = {
  recipient: "",
  amount: "",
  decimals: ""
};

const vendorPresets: Array<{ label: string; value: string }> = [];
const categoryPresets: Array<{ label: string; value: string }> = [];
type CatalogItem = {
  id: string;
  label: string;
  value: string;
  selected: boolean;
};

const defaultProductCatalog: CatalogItem[] = [];
const defaultRecipientCatalog: CatalogItem[] = [];
const defaultTokenCatalog: CatalogItem[] = [
  {
    id: "agentwallet-devnet-token",
    label: "AgentWallet devnet test token",
    value: defaultDevnetUsdcMint,
    selected: true
  }
];

type DashboardView = "operations" | "sui" | "simulator" | "audit";

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

type ExportedAgentWallet = {
  publicKey: string;
  secretKeyBase58: string;
  secretKeyBytes: number[];
};

type AgentWalletAuditEvent = {
  id: string;
  type: string;
  message: string;
  status: "approved" | "rejected" | "info";
  signature?: string;
  explorerUrl?: string;
  createdAt: string;
};

type AgentApproval = {
  id: string;
  owner: string;
  agentId: string;
  agentPublicKey: string;
  programId: string;
  policyPda: string;
  recipient: string;
  tokenMint: string;
  amount: string;
  decimals: number;
  reason: string;
  status: "pending" | "approved" | "executed" | "rejected" | "execution_failed";
  paymentIntentPda: string | null;
  approvalSignature: string | null;
  executionSignature: string | null;
  expiresAt: string;
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
  const [tokenCatalog, setTokenCatalog] = useState<CatalogItem[]>(
    syncCatalogSelection(defaultTokenCatalog, defaultOnchainPolicyForm.tokenMint)
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
    "Connect Phantom, then fund the connected devnet wallet with AgentWallet test tokens."
  );
  const [agentFaucetStatus, setAgentFaucetStatus] = useState(
    "Select a hosted agent, then mint AgentWallet test tokens to its wallet."
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
  const [ownerAuthStatus, setOwnerAuthStatus] = useState("Connect wallet once to provision hosted agents.");
  const [provisionedAgents, setProvisionedAgents] = useState<ProvisionedAgent[]>([]);
  const [selectedProvisionedAgentId, setSelectedProvisionedAgentId] = useState<string | null>(null);
  const [newAgentName, setNewAgentName] = useState("");
  const [latestProvisionedApiKey, setLatestProvisionedApiKey] = useState<string | null>(null);
  const [telegramLinkStatus, setTelegramLinkStatus] = useState("Create a link code, then send it to the shared Telegram bot.");
  const [telegramLinkCode, setTelegramLinkCode] = useState<string | null>(null);
  const [ownerExportPasswordSet, setOwnerExportPasswordSet] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exportStatus, setExportStatus] = useState("Set one owner recovery password before creating hosted agent wallets.");
  const [exportedAgentWallet, setExportedAgentWallet] = useState<ExportedAgentWallet | null>(null);
  const [serverAuditEvents, setServerAuditEvents] = useState<AgentWalletAuditEvent[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<AgentApproval[]>([]);
  const [approvalStatus, setApprovalStatus] = useState("Above-threshold agent payments will appear here for owner approval.");
  const [dismissedApprovalToastIds, setDismissedApprovalToastIds] = useState<string[]>([]);
  const [x402Status, setX402Status] = useState("Run the paid API demo after selecting a funded hosted agent.");
  const [x402ExplorerUrl, setX402ExplorerUrl] = useState<string | null>(null);
  const [x402Response, setX402Response] = useState<string | null>(null);
  const [isX402Executing, setIsX402Executing] = useState(false);

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
  const displayedAuditEvents = useMemo(
    () => [...serverAuditEvents.map(auditEventToSpendEvent), ...events],
    [events, serverAuditEvents]
  );
  const deniedEvents = displayedAuditEvents.filter((event) => event.decision === "denied");
  const pendingApprovalToast = approvalRequests.find(
    (approval) =>
      approval.status === "pending" && !dismissedApprovalToastIds.includes(approval.id)
  ) ?? null;

  useEffect(() => {
    const snapshot = parseDemoState(window.localStorage.getItem(storageKey));
    const savedAgentRegistry = parseAgentRegistry(
      window.localStorage.getItem(agentRegistryStorageKey)
    );
    const savedTokenCatalog = parseCatalogItems(
      window.localStorage.getItem(tokenCatalogStorageKey),
      defaultTokenCatalog
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

    if (savedTokenCatalog) {
      setTokenCatalog(savedTokenCatalog);
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
    if (!hasLoadedSnapshot) {
      return;
    }

    window.localStorage.setItem(tokenCatalogStorageKey, JSON.stringify(tokenCatalog));
  }, [hasLoadedSnapshot, tokenCatalog]);

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
    const selectedTokens = activeCatalogValues(tokenCatalog);
    const nextTokenMint = selectedTokens.includes(onchainPolicyForm.tokenMint)
      ? onchainPolicyForm.tokenMint
      : selectedTokens[0] ?? "";

    if (nextTokenMint !== onchainPolicyForm.tokenMint) {
      setOnchainPolicyForm((current) => ({ ...current, tokenMint: nextTokenMint }));
    }
  }, [onchainPolicyForm.tokenMint, tokenCatalog]);

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

  useEffect(() => {
    if (!telegramLinkCode || !selectedProvisionedAgentId) {
      return;
    }

    let cancelled = false;

    async function refreshTelegramLinkState() {
      try {
        const agents = await loadProvisionedAgents();
        const selectedAgent = agents.find((agent) => agent.id === selectedProvisionedAgentId);

        if (cancelled || !selectedAgent?.telegramChatId) {
          return;
        }

        setTelegramLinkCode(null);
        setTelegramLinkStatus(`Telegram linked to ${selectedAgent.name}.`);
      } catch {
        if (!cancelled) {
          setTelegramLinkStatus("Waiting for Telegram link confirmation...");
        }
      }
    }

    void refreshTelegramLinkState();
    const interval = window.setInterval(refreshTelegramLinkState, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedProvisionedAgentId, telegramLinkCode]);

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
      setAnchorStatus("Wallet connected on devnet. Requesting owner session signature...");
      await signInOwnerWalletWithProvider(provider, address);
    } catch (error) {
      setAnchorStatus(getErrorMessage(error));
      setOwnerAuthStatus(getErrorMessage(error));
    }
  }

  async function signInOwnerWallet() {
    const provider = getPhantomProvider();

    if (!provider) {
      setOwnerAuthStatus("Phantom wallet was not found in this browser.");
      return;
    }

    try {
      await signInOwnerWalletWithProvider(provider);
    } catch (error) {
      setOwnerAuthStatus(getErrorMessage(error));
    }
  }

  async function signInOwnerWalletWithProvider(
    provider: PhantomProvider,
    connectedOwner?: string
  ) {
    if (!provider.signMessage) {
      setOwnerAuthStatus("This wallet does not support message signing. Use Phantom or another Solana wallet with signMessage.");
      return;
    }

    const response = connectedOwner
      ? null
      : provider.publicKey
        ? { publicKey: provider.publicKey }
        : await provider.connect();
    const owner = connectedOwner ?? response!.publicKey.toBase58();
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
    setOwnerAuthStatus("Owner wallet signed in. Loading hosted agents...");
    await loadOwnerSecurity();
    const agents = await loadProvisionedAgentsWithRetry();
    await loadApprovalRequests(selectedProvisionedAgentId);
    setAnchorStatus("Wallet connected and signed in on devnet.");
    setOwnerAuthStatus(
      agents.length
        ? `Owner wallet signed in. Loaded ${agents.length} hosted agent${agents.length === 1 ? "" : "s"}.`
        : "Owner wallet signed in. No hosted agents found for this wallet yet."
    );
  }

  async function loadProvisionedAgents() {
    const response = await fetch("/api/agents", { cache: "no-store", credentials: "same-origin" });
    const payload = await readJsonResponse<{ agents: ProvisionedAgent[] }>(response);
    setProvisionedAgents(payload.agents);
    return payload.agents;
  }

  async function loadProvisionedAgentsWithRetry() {
    try {
      return await loadProvisionedAgents();
    } catch (error) {
      await delay(250);
      try {
        return await loadProvisionedAgents();
      } catch {
        throw error;
      }
    }
  }

  async function loadOwnerSecurity() {
    const response = await fetch("/api/owner/security", {
      cache: "no-store",
      credentials: "same-origin"
    });
    const payload = await readJsonResponse<{ security: { exportPasswordSet: boolean } }>(response);
    setOwnerExportPasswordSet(payload.security.exportPasswordSet);
    setExportStatus(
      payload.security.exportPasswordSet
        ? "Owner recovery password is set. Select an agent and enter it to reveal that wallet key."
        : "Set one owner recovery password before creating hosted agent wallets."
    );
    if (payload.security.exportPasswordSet) {
      setNewAgentName((current) =>
        current.trim() ? current : getSuggestedHostedAgentName(provisionedAgents.length)
      );
    }
    return payload.security;
  }

  async function loadAgentWalletAudit(apiKey = agentApiKey.trim()) {
    if (!apiKey) {
      return;
    }

    const response = await fetch("/api/agent-wallet/audit", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const payload = await readJsonResponse<{ events: AgentWalletAuditEvent[] }>(response);
    setServerAuditEvents(payload.events);
  }

  async function loadApprovalRequests(agentId = selectedProvisionedAgentId) {
    const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
    const response = await fetch(`/api/approvals${query}`, {
      cache: "no-store",
      credentials: "same-origin"
    });
    const payload = await readJsonResponse<{ approvals: AgentApproval[] }>(response);
    setApprovalRequests(payload.approvals);
    return payload.approvals;
  }

  async function createHostedAgent() {
    if (!walletAddress) {
      setOwnerAuthStatus("Connect and sign with the owner wallet before creating an agent.");
      return;
    }

    const trimmedName = newAgentName.trim();
    if (!trimmedName) {
      setOwnerAuthStatus("Enter an agent name before generating a hosted wallet.");
      return;
    }

    if (!ownerExportPasswordSet) {
      setOwnerAuthStatus("Set the owner recovery password before generating hosted agent wallets.");
      setExportStatus("Set one owner recovery password first. It will unlock exports for every hosted agent wallet you create.");
      return;
    }

    const tokenMint = onchainPolicyForm.tokenMint.trim();
    if (!tokenMint) {
      setOwnerAuthStatus("Select at least one token mint before generating a hosted agent.");
      return;
    }

    try {
      setOwnerAuthStatus("Creating hosted agent wallet and API key...");
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          programId: onchainPolicyForm.programId,
          policyPda,
          ...(tokenMint ? { tokenMint } : {}),
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
      await loadAgentWalletAudit(payload.apiKey);
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
      await loadAgentWalletAudit(payload.apiKey);
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
      setTelegramLinkStatus(`Send /link ${payload.code} to the shared Telegram bot (Open @agentspendbot). This code expires at ${new Date(payload.expiresAt).toLocaleTimeString()}.`);
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

  async function setOwnerRecoveryPassword() {
    if (!exportPassword.trim()) {
      setExportStatus("Enter an owner recovery password first.");
      return;
    }

    try {
      setExportStatus("Setting owner recovery password...");
      const response = await fetch("/api/owner/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: exportPassword })
      });
      const payload = await readJsonResponse<{ security: { exportPasswordSet: boolean } }>(response);
      setOwnerExportPasswordSet(payload.security.exportPasswordSet);
      setExportedAgentWallet(null);
      setNewAgentName((current) =>
        current.trim() ? current : getSuggestedHostedAgentName(provisionedAgents.length)
      );
      setOwnerAuthStatus("Owner recovery password set. You can generate a hosted agent wallet now.");
      setExportStatus("Owner recovery password set. You can use it to export any hosted agent wallet.");
      await loadAgentWalletAudit();
    } catch (error) {
      setExportStatus(getErrorMessage(error));
    }
  }

  async function exportHostedAgentWallet(agentId: string) {
    if (!exportPassword.trim()) {
      setExportStatus("Enter the owner recovery password first.");
      return;
    }

    try {
      setExportStatus("Exporting hosted agent wallet...");
      setExportedAgentWallet(null);
      const response = await fetch(`/api/agents/${agentId}/export-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: exportPassword })
      });
      const exported = await readJsonResponse<ExportedAgentWallet>(response);
      setExportedAgentWallet(exported);
      setExportStatus("Private key revealed. Copy it carefully and treat this wallet as exported.");
      await loadAgentWalletAudit();
    } catch (error) {
      setExportStatus(getErrorMessage(error));
    }
  }

  function loadProvisionedAgentIntoPolicy(agent: ProvisionedAgent) {
    setSelectedProvisionedAgentId(agent.id);
    setExportedAgentWallet(null);
    setExportPassword("");
    setExportStatus(
      ownerExportPasswordSet
        ? "Enter the owner recovery password to reveal this wallet private key."
        : "Set one owner recovery password before creating or exporting hosted wallets."
    );
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
    if (agent.tokenMint) {
      setTokenCatalog((current) =>
        addCatalogItem(current, labelForTokenMint(agent.tokenMint), agent.tokenMint, true)
      );
    }
    setPolicyPda(agent.policyPda);
    setPolicyAccountStatus(agent.policyPda ? "checking" : "idle");
    setAnchorStatus(
      agent.policyPda
        ? "Hosted agent loaded into the Anchor policy card. Checking its policy account..."
        : walletAddress
          ? "Hosted agent loaded into the Anchor policy card. Initialize its policy account next."
          : "Hosted agent selected. Connect the owner wallet so AgentWallet can derive and initialize its policy PDA."
    );
    void loadApprovalRequests(agent.id).catch(() => {
      setApprovalStatus("Sign in with the owner wallet to load approval requests.");
    });
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
        allowedTokenMints: activeCatalogValues(tokenCatalog).join(", "),
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
      if (action === "pause" || action === "resume") {
        const nextStatus = action === "pause" ? "paused" : "active";
        setPolicy((current) => ({ ...current, status: nextStatus }));
        setDraftPolicyStatus(`Policy ${nextStatus} on-chain.`);
      }
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
          vendorName: "AgentWallet program",
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
          vendorName: "AgentWallet execute_payment",
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

  async function approvePaymentRequest(approval: AgentApproval) {
    const provider = getPhantomProvider();

    if (!provider) {
      setApprovalStatus("Phantom wallet was not found in this browser.");
      return;
    }

    try {
      const response = provider.publicKey ? { publicKey: provider.publicKey } : await provider.connect();
      const owner = response.publicKey;

      if (owner.toBase58() !== approval.owner) {
        setApprovalStatus("Switch Phantom to the owner wallet that controls this policy.");
        return;
      }

      const connection = createDevnetConnection();
      const { transaction, blockhash, lastValidBlockHeight, paymentIntentPda } =
        await buildApprovePaymentIntentTransaction(connection, owner, {
          programId: approval.programId,
          policyPda: approval.policyPda,
          recipient: approval.recipient,
          amount: approval.amount,
          decimals: String(approval.decimals),
          expiresAt: Math.floor(new Date(approval.expiresAt).getTime() / 1000)
        });

      setApprovalStatus("Waiting for owner wallet approval...");
      const result = await provider.signAndSendTransaction(transaction);
      const signature = typeof result === "string" ? result : result.signature;

      setApprovalStatus("Approval submitted. Confirming on devnet...");
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      setApprovalStatus("Approval confirmed. AgentWallet is executing with the hosted agent wallet...");
      const confirmResponse = await fetch(`/api/approvals/${approval.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature,
          paymentIntentPda: paymentIntentPda.toBase58()
        })
      });
      const payload = await readJsonResponse<{
        approval: AgentApproval;
        payment: { signature: string; explorerUrl?: string };
      }>(confirmResponse);

      setExecuteSignature(payload.payment.signature);
      setExecuteStatus("Owner approved and AgentWallet executed the payment automatically.");
      setApprovalStatus(`Approved and executed automatically. Payment signature: ${payload.payment.signature}.`);
      setAgentMessages((current) => [
        ...current,
        {
          id: `agent_auto_approved_${Date.now()}`,
          role: "agent",
          status: "approved",
          explorerUrl: payload.payment.explorerUrl,
          content: `Owner approved the pending payment and AgentWallet executed it on devnet. Signature: ${payload.payment.signature}.`
        }
      ]);
      await loadApprovalRequests(selectedProvisionedAgentId);
      if (agentApiKey.trim()) {
        await loadAgentWalletAudit();
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setApprovalStatus(message);
      setExecuteStatus(message);
      setAgentMessages((current) => [
        ...current,
        {
          id: `agent_approval_failed_${Date.now()}`,
          role: "agent",
          status: "rejected",
          content: message
        }
      ]);
      await loadApprovalRequests(selectedProvisionedAgentId);
      if (agentApiKey.trim()) {
        await loadAgentWalletAudit();
      }
    }
  }

  async function rejectPaymentRequest(approval: AgentApproval) {
    try {
      setApprovalStatus("Rejecting approval request...");
      const response = await fetch(`/api/approvals/${approval.id}/reject`, {
        method: "POST",
        credentials: "same-origin"
      });
      await readJsonResponse<{ approval: AgentApproval }>(response);
      setApprovalStatus("Approval request rejected.");
      setAgentMessages((current) => [
        ...current,
        {
          id: `agent_rejected_by_owner_${Date.now()}`,
          role: "agent",
          status: "rejected",
          content: `Owner rejected the pending ${approval.amount} token payment to ${shortAddress(approval.recipient)}.`
        }
      ]);
      setDismissedApprovalToastIds((current) => [...current, approval.id]);
      await loadApprovalRequests(selectedProvisionedAgentId);
      if (agentApiKey.trim()) {
        await loadAgentWalletAudit();
      }
    } catch (error) {
      setApprovalStatus(getErrorMessage(error));
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
          tokenMint: onchainPolicyForm.tokenMint || defaultDevnetUsdcMint,
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
      setAgentFaucetStatus("Select a hosted agent before minting AgentWallet test tokens.");
      return;
    }

    try {
      const tokenMint =
        selectedProvisionedAgent.tokenMint.trim() ||
        onchainPolicyForm.tokenMint.trim() ||
        defaultDevnetUsdcMint;
      const decimals = Number(selectedProvisionedAgent.decimals) || Number(executePaymentForm.decimals) || 6;

      setAgentFaucetTokenAccount(null);
      setAgentFaucetSignature(null);
      setAgentFaucetStatus(
        `Minting AgentWallet test tokens to ${shortAddress(selectedProvisionedAgent.publicKey)}...`
      );

      const result = await fetch("/api/devnet/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: selectedProvisionedAgent.publicKey,
          tokenMint,
          amount: 25,
          decimals
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
      setAgentFaucetStatus("Selected hosted agent funded with AgentWallet test tokens.");
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
      const response = await fetch("/api/agent-wallet/pay", {
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
        if (response.status === 402) {
          await loadApprovalRequests(selectedProvisionedAgentId);
          setApprovalStatus("A payment needs owner approval. Review it in Owner approvals.");
        }
        throw new Error(payload.error ?? "The agent payment was rejected.");
      }

      setExecuteSignature(payload.signature ?? null);
      setExecuteStatus("Agent API executed a policy-gated payment on devnet.");
      await loadAgentWalletAudit();
      await loadApprovalRequests(selectedProvisionedAgentId);
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
      if (agentApiKey.trim()) {
        try {
          await loadAgentWalletAudit();
        } catch {
          // The visible chat error should stay focused on the payment result.
        }
      }

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

  async function runX402Demo() {
    if (!agentApiKey.trim()) {
      setX402Status("Paste the hosted agent API key first.");
      return;
    }

    setIsX402Executing(true);
    setX402ExplorerUrl(null);
    setX402Response(null);

    try {
      setX402Status("Requesting paid API resource...");
      const challengeResponse = await fetch(demoMerchantResourcePath, { cache: "no-store" });
      const paymentRequiredHeader = challengeResponse.headers.get("PAYMENT-REQUIRED");

      if (challengeResponse.status !== 402 || !paymentRequiredHeader) {
        throw new Error("Demo merchant did not return an x402 payment challenge.");
      }

      const challengeBody = await challengeResponse.json();
      setX402Status("x402 challenge received. Settling through AgentWallet policy engine...");

      const settleResponse = await fetch("/api/x402/settle", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${agentApiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ paymentRequired: challengeBody.paymentRequired })
      });
      const settlement = await readJsonResponse<{
        paymentSignature: string;
        paymentPayload: { payload: { transaction: string } };
      }>(settleResponse);

      setX402Status("Payment settled. Retrying paid API with PAYMENT-SIGNATURE...");
      const paidResponse = await fetch(demoMerchantResourcePath, {
        headers: { "PAYMENT-SIGNATURE": settlement.paymentSignature }
      });
      const paidPayload = await readJsonResponse<Record<string, unknown>>(paidResponse);

      setX402ExplorerUrl(getExplorerTransactionUrl(settlement.paymentPayload.payload.transaction));
      setX402Response(JSON.stringify(paidPayload, null, 2));
      setX402Status("x402 paid API completed with an on-chain AgentWallet payment.");
      await loadAgentWalletAudit();
    } catch (error) {
      setX402Status(getErrorMessage(error));
    } finally {
      setIsX402Executing(false);
    }
  }

  function resetDemo() {
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(tokenCatalogStorageKey);
    setPolicy(initialPolicy);
    setPolicyForm(policyToFormValues(initialPolicy));
    setProductCatalog(syncCatalogSelection(defaultProductCatalog, initialPolicy.allowedVendors.join(", ")));
    setRecipientCatalog(syncCatalogSelection(defaultRecipientCatalog, defaultOnchainPolicyForm.allowedRecipients));
    setTokenCatalog(syncCatalogSelection(defaultTokenCatalog, defaultOnchainPolicyForm.tokenMint));
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
    setFaucetStatus("Connect Phantom, then fund the connected devnet wallet with AgentWallet test tokens.");
    setAgentFaucetStatus("Select a hosted agent, then mint AgentWallet test tokens to its wallet.");
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
          <div className="brand-mark" aria-hidden="true">
            <AgentWalletMark />
          </div>
          <div>
            <strong>AgentWallet</strong>
            <br />
            <span>non-custodial · policy-enforced</span>
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
            className={activeView === "sui" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("sui")}
          >
            <FlaskConical size={17} /> Sui
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
            {activeView === "sui" ? (
              <>
                <h1>Sui agent wallet proof.</h1>
                <p>
                  Overflow track workspace for Move policy objects, DeepBook orders,
                  on-chain activity logs, and owner revocation.
                </p>
              </>
            ) : (
              <>
                <h1>Give your AI agent a wallet.</h1>
                <p>
                  AgentWallet lets agents pay, swap, and settle through wallets that
                  owners can actually control.
                </p>
              </>
            )}
          </div>
          <div className="top-actions">
            {activeView === "sui" ? (
              <span className="status-pill">
                <FlaskConical size={15} /> Sui autonomous DeepBook proof
              </span>
            ) : (
              <button
                className={walletAddress ? "button connected small" : "button secondary small"}
                type="button"
                onClick={connectWallet}
              >
                <WalletCards size={15} />{" "}
                {walletAddress ? `Connected ${shortAddress(walletAddress)}` : "Connect wallet"}
              </button>
            )}
          </div>
        </header>

        {activeView !== "sui" ? (
          <section className="grid metrics" aria-label="Metrics">
            <Metric label="Daily budget" value={formatUsdMetric(policy.dailyBudgetUsd)} />
            <Metric label="Remaining today" value={formatUsdMetric(remainingBudget)} />
            <Metric label="Autonomous limit" value={formatUsdMetric(policy.approvalThresholdUsd)} />
            <Metric label="Policy violations" value={String(deniedEvents.length)} />
          </section>
        ) : null}

        {activeView === "operations" ? (
          <OperationsView
            agentTokenAccount={agentTokenAccount}
            anchorSignature={anchorSignature}
            anchorStatus={anchorStatus}
            applyPolicyUpdate={applyPolicyUpdate}
            events={events}
            runX402Demo={runX402Demo}
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
            isX402Executing={isX402Executing}
            onchainPolicyForm={onchainPolicyForm}
            policy={policy}
            policyAccountStatus={policyAccountStatus}
            policyForm={policyForm}
            policyPda={policyPda}
            productCatalog={productCatalog}
            registryRows={registryRows}
            recipientCatalog={recipientCatalog}
            tokenCatalog={tokenCatalog}
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
            setTokenCatalog={setTokenCatalog}
            selectedAgentId={selectedAgentId}
            submitAnchorPolicyInstruction={submitAnchorPolicyInstruction}
            submitAgentCommand={submitAgentCommand}
            togglePause={togglePause}
            useRegisteredAgent={useRegisteredAgent}
            walletAddress={walletAddress}
            x402ExplorerUrl={x402ExplorerUrl}
            x402Response={x402Response}
            x402Status={x402Status}
            selectedProvisionedAgent={selectedProvisionedAgent}
            ownerAuthStatus={ownerAuthStatus}
            provisionedAgents={provisionedAgents}
            selectedProvisionedAgentId={selectedProvisionedAgentId}
            newAgentName={newAgentName}
            latestProvisionedApiKey={latestProvisionedApiKey}
            telegramLinkCode={telegramLinkCode}
            telegramLinkStatus={telegramLinkStatus}
            ownerExportPasswordSet={ownerExportPasswordSet}
            exportPassword={exportPassword}
            exportStatus={exportStatus}
            exportedAgentWallet={exportedAgentWallet}
            approvalRequests={approvalRequests}
            approvalStatus={approvalStatus}
            approvePaymentRequest={approvePaymentRequest}
            rejectPaymentRequest={rejectPaymentRequest}
            signInOwnerWallet={signInOwnerWallet}
            createHostedAgent={createHostedAgent}
            rotateHostedAgentApiKey={rotateHostedAgentApiKey}
            createHostedAgentTelegramLink={createHostedAgentTelegramLink}
            unlinkHostedAgentTelegram={unlinkHostedAgentTelegram}
            setOwnerRecoveryPassword={setOwnerRecoveryPassword}
            exportHostedAgentWallet={exportHostedAgentWallet}
            loadProvisionedAgentIntoPolicy={loadProvisionedAgentIntoPolicy}
            clearHostedAgentSelection={clearHostedAgentSelection}
            setNewAgentName={setNewAgentName}
            setExportPassword={setExportPassword}
          />
        ) : activeView === "sui" ? (
          <SuiView />
        ) : activeView === "simulator" ? (
          <SimulatorView findings={simulatorFindings} />
        ) : (
          <AuditLogView events={displayedAuditEvents} />
        )}
        {pendingApprovalToast ? (
          <ApprovalToast
            approval={pendingApprovalToast}
            onApprove={approvePaymentRequest}
            onReject={rejectPaymentRequest}
            onDismiss={(approvalId) =>
              setDismissedApprovalToastIds((current) => [...current, approvalId])
            }
          />
        ) : null}
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
  runX402Demo,
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
  isX402Executing,
  onchainPolicyForm,
  policy,
  policyAccountStatus,
  policyForm,
  policyPda,
  productCatalog,
  registryRows,
  recipientCatalog,
  tokenCatalog,
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
  setTokenCatalog,
  selectedAgentId,
  submitAnchorPolicyInstruction,
  submitAgentCommand,
  togglePause,
  useRegisteredAgent,
  walletAddress,
  x402ExplorerUrl,
  x402Response,
  x402Status,
  selectedProvisionedAgent,
  ownerAuthStatus,
  provisionedAgents,
  selectedProvisionedAgentId,
  newAgentName,
  latestProvisionedApiKey,
  telegramLinkCode,
  telegramLinkStatus,
  ownerExportPasswordSet,
  exportPassword,
  exportStatus,
  exportedAgentWallet,
  approvalRequests,
  approvalStatus,
  approvePaymentRequest,
  rejectPaymentRequest,
  signInOwnerWallet,
  createHostedAgent,
  rotateHostedAgentApiKey,
  createHostedAgentTelegramLink,
  unlinkHostedAgentTelegram,
  setOwnerRecoveryPassword,
  exportHostedAgentWallet,
  loadProvisionedAgentIntoPolicy,
  clearHostedAgentSelection,
  setNewAgentName,
  setExportPassword
}: {
  agentTokenAccount: string | null;
  anchorSignature: string | null;
  anchorStatus: string;
  applyPolicyUpdate: () => void;
  events: SpendEvent[];
  runX402Demo: () => void;
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
  isX402Executing: boolean;
  onchainPolicyForm: typeof defaultOnchainPolicyForm;
  policy: typeof initialPolicy;
  policyAccountStatus: PolicyAccountStatus;
  policyForm: PolicyFormValues;
  policyPda: string | null;
  productCatalog: CatalogItem[];
  registryRows: Array<AgentRegistryEntry & { derivedPolicyPda: string | null }>;
  recipientCatalog: CatalogItem[];
  tokenCatalog: CatalogItem[];
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
  setTokenCatalog: Dispatch<SetStateAction<CatalogItem[]>>;
  selectedAgentId: string | null;
  submitAnchorPolicyInstruction: (action: "initialize" | "update" | "pause" | "resume") => void;
  submitAgentCommand: () => void;
  togglePause: () => void;
  useRegisteredAgent: (agent: AgentRegistryEntry) => void;
  walletAddress: string | null;
  x402ExplorerUrl: string | null;
  x402Response: string | null;
  x402Status: string;
  selectedProvisionedAgent: ProvisionedAgent | null;
  ownerAuthStatus: string;
  provisionedAgents: ProvisionedAgent[];
  selectedProvisionedAgentId: string | null;
  newAgentName: string;
  latestProvisionedApiKey: string | null;
  telegramLinkCode: string | null;
  telegramLinkStatus: string;
  ownerExportPasswordSet: boolean;
  exportPassword: string;
  exportStatus: string;
  exportedAgentWallet: ExportedAgentWallet | null;
  approvalRequests: AgentApproval[];
  approvalStatus: string;
  approvePaymentRequest: (approval: AgentApproval) => void;
  rejectPaymentRequest: (approval: AgentApproval) => void;
  signInOwnerWallet: () => void;
  createHostedAgent: () => void;
  rotateHostedAgentApiKey: (agentId: string) => void;
  createHostedAgentTelegramLink: (agentId: string) => void;
  unlinkHostedAgentTelegram: (agentId: string) => void;
  setOwnerRecoveryPassword: () => void;
  exportHostedAgentWallet: (agentId: string) => void;
  loadProvisionedAgentIntoPolicy: (agent: ProvisionedAgent) => void;
  clearHostedAgentSelection: () => void;
  setNewAgentName: Dispatch<SetStateAction<string>>;
  setExportPassword: Dispatch<SetStateAction<string>>;
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
          <h2>Active agent wallet</h2>
          <div className="setup-grid">
            <div className="event">
              <header>
                <strong>Owner wallet</strong>
                <WalletCards size={16} color="var(--aw-accent)" />
              </header>
              <p>{walletAddress ? shortAddress(walletAddress) : "Connect a wallet to own and publish agent policies."}</p>
            </div>
            <div className="event">
              <header>
                <strong>Agent wallet</strong>
                <CircleDollarSign size={16} color="var(--aw-ok)" />
              </header>
              <p>{selectedProvisionedAgent ? shortAddress(selectedProvisionedAgent.publicKey) : "Create or select the wallet your AI agent will use."}</p>
            </div>
            <div className="event">
              <header>
                <strong>Policy status</strong>
                <Activity size={16} color="var(--aw-info)" />
              </header>
              <p>{displayedPolicyPda ? policyStatusText : "Register and publish a policy before the agent can spend."}</p>
            </div>
          </div>
          <div className="funding-strip">
            <div className="funding-strip-main">
              <header>
                <strong>Fund selected hosted agent</strong>
                <FlaskConical size={16} color="var(--cyan)" />
              </header>
              <p>
                Fund with devnet SOL first, then mint AgentWallet test tokens for payments. Custom token mints must be funded from their own devnet mint authority.
              </p>
              <p className="inline-status warning compact-status">
                <AlertTriangle size={15} /> SOL is required before token minting.
              </p>
            </div>
            <div className="funding-strip-meta">
              <span className="eyebrow">Agent wallet</span>
              <strong>{selectedProvisionedAgent ? shortAddress(selectedProvisionedAgent.publicKey) : "select an agent"}</strong>
              <span>{agentFaucetTokenAccount ? `Token account ${shortAddress(agentFaucetTokenAccount)}` : agentFaucetStatus}</span>
            </div>
            <div className="funding-strip-actions">
              <a
                className="button secondary small"
                href="https://faucet.solana.com"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} /> Get SOL
              </a>
              {selectedProvisionedAgent ? (
                <a
                  className="button secondary small"
                  href={getExplorerAddressUrl(selectedProvisionedAgent.publicKey)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={15} /> Explorer
                </a>
              ) : null}
              <button
                className="button small"
                type="button"
                onClick={requestSelectedAgentTokens}
                disabled={!selectedProvisionedAgent}
              >
                <FlaskConical size={15} /> Mint tokens
              </button>
              {agentFaucetSignature ? (
                <a
                  className="icon-button"
                  href={getExplorerTransactionUrl(agentFaucetSignature)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="View agent faucet transaction"
                  title="View agent faucet transaction"
                >
                  <ExternalLink size={15} />
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className="panel advanced-only">
          <h2>Devnet proof links</h2>
          <div className="proof-grid">
            <ProofLink
              label="AgentWallet program"
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
          <h2>Agent wallets</h2>
          <p className="section-note">
            Generate hosted devnet wallets for AI agents. AgentWallet keeps signing keys encrypted server-side and routes every spend through the owner policy.
          </p>
          <div className="policy-form">
            <EditableField
              label="New agent name"
              help="Give this hosted wallet a name, like Research Agent or Trading Agent."
              value={newAgentName}
              onChange={setNewAgentName}
            />
            <ReadOnlyField
              label="Owner session"
              value={ownerAuthStatus}
            />
          </div>
          <div className="button-row" style={{ marginTop: 14 }}>
            <button
              className="button"
              type="button"
              onClick={createHostedAgent}
              disabled={!walletAddress || !ownerExportPasswordSet || !newAgentName.trim()}
              title={
                !walletAddress
                  ? "Connect and sign with the owner wallet first."
                  : !ownerExportPasswordSet
                    ? "Set the owner recovery password before creating hosted wallets."
                  : !newAgentName.trim()
                    ? "Enter an agent name first."
                    : "Generate a hosted wallet and API key for this agent."
              }
            >
              <Plus size={17} /> Generate hosted agent
            </button>
          </div>
          {latestProvisionedApiKey ? (
            <div className="devnet-card compact-copy-card" style={{ marginTop: 14 }}>
              <span>One-time agent API key</span>
              <CopyField value={latestProvisionedApiKey} label="Copy agent API key" />
              <p>Copy this now. AgentWallet stores only the hash and will not show the full key again.</p>
            </div>
          ) : null}
          {telegramLinkCode ? (
            <div className="devnet-card compact-copy-card" style={{ marginTop: 14 }}>
              <span>Telegram link command</span>
              <CopyField value={`/link ${telegramLinkCode}`} label="Copy Telegram link command" />
              <TelegramLinkStatus text={telegramLinkStatus} />
            </div>
          ) : (
            <p className="inline-status">
              <Bot size={15} /> {telegramLinkStatus}
              {" "}
              <a className="explorer-link inline-link" href="https://t.me/agentspendbot" target="_blank" rel="noreferrer">
                @agentspendbot
              </a>
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
          <div className="devnet-card wallet-export-card" style={{ marginTop: 14 }}>
            <div>
              <span className="eyebrow">Advanced recovery</span>
              <strong>Owner recovery password</strong>
              <p>
                Set one password before creating hosted wallets. The same password lets the
                owner reveal any hosted agent wallet key later, similar to a wallet app password.
              </p>
            </div>
            <div className="policy-form">
              <PasswordField
                label="Owner recovery password"
                help={
                  ownerExportPasswordSet
                    ? "Enter this password to reveal the selected hosted wallet key."
                    : "Set this once before creating hosted wallets. AgentWallet stores only a password hash."
                }
                value={exportPassword}
                className="span-2"
                onChange={setExportPassword}
              />
            </div>
            <div className="button-row" style={{ marginTop: 12 }}>
              <button
                className="button secondary"
                type="button"
                disabled={!walletAddress || ownerExportPasswordSet || !exportPassword.trim()}
                onClick={setOwnerRecoveryPassword}
              >
                <KeyRound size={17} /> {ownerExportPasswordSet ? "Recovery password set" : "Set recovery password"}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={!selectedProvisionedAgent || !ownerExportPasswordSet || !exportPassword.trim()}
                onClick={() =>
                  selectedProvisionedAgent
                    ? exportHostedAgentWallet(selectedProvisionedAgent.id)
                    : undefined
                }
              >
                <AlertTriangle size={17} /> Reveal selected wallet key
              </button>
            </div>
            <p className="inline-status warning">
              <AlertTriangle size={15} /> {exportStatus}
            </p>
            {exportedAgentWallet ? (
              <div className="export-result">
                <ReadOnlyField label="Public key" value={exportedAgentWallet.publicKey} />
                <div className="field span-2">
                  <label>Private key (base58)</label>
                  <CopyField value={exportedAgentWallet.secretKeyBase58} label="Copy base58 private key" />
                </div>
                <div className="field span-2">
                  <label>Private key byte array</label>
                  <CopyField value={JSON.stringify(exportedAgentWallet.secretKeyBytes)} label="Copy byte array private key" />
                </div>
              </div>
            ) : null}
          </div>
          <AgentSdkPanel
            agentApiKey={agentApiKey}
            executePaymentForm={executePaymentForm}
            onchainPolicyForm={onchainPolicyForm}
            selectedProvisionedAgent={selectedProvisionedAgent}
          />
          <div className="setup-grid advanced-only" style={{ marginTop: 14 }}>
            <div className="event">
              <header>
                <strong>x402 paid API demo</strong>
                <CircleDollarSign size={16} color="var(--green)" />
              </header>
              <p>{x402Status}</p>
              <p>Merchant wallet is returned by the paid API challenge.</p>
              <p>
                Price <strong>1 AgentWallet devnet test token</strong>
              </p>
              {x402ExplorerUrl ? (
                <a className="explorer-link" href={x402ExplorerUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} /> View x402 settlement
                </a>
              ) : null}
              {x402Response ? <pre className="code-panel">{x402Response}</pre> : null}
              <div className="button-row" style={{ marginTop: 12 }}>
                <button className="button" type="button" onClick={runX402Demo} disabled={isX402Executing}>
                  <CircleDollarSign size={17} /> {isX402Executing ? "Calling paid API..." : "Call paid API with agent"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="panel advanced-only">
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
              <p>Initialize the policy, then execute through AgentWallet so the program checks caps and allowlists before transfer.</p>
            </div>
          </div>
          <div className="button-row" style={{ marginTop: 14 }}>
            <button className="button" type="button" onClick={requestDevnetTokens}>
              <FlaskConical size={17} /> Fund connected wallet
            </button>
          </div>
        </section>

        <section className="panel" id="policy">
          <h2>Policy rules</h2>
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
              label="Block autonomous spend above ($)"
              help="Payments above this amount cannot execute automatically yet. Owner approval workflow is next; today the on-chain policy blocks them."
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

        <section className="panel advanced-only">
          <h2>Agent registry</h2>
          <p className="section-note">
            Register each AI agent wallet separately. Every agent gets its own policy account under the shared AgentWallet program.
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
          <h2>Publish policy</h2>
          <div className="policy-form">
            <ReadOnlyField
              label="AgentWallet program"
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
            <TokenCatalogField
              label="Tokens the agent can spend"
              help="Add Solana devnet SPL token names and mint/contract addresses. Checked tokens are written into the on-chain allowlist; the active token is the default used by simple tests and Telegram."
              activeValue={onchainPolicyForm.tokenMint}
              items={tokenCatalog}
              className="span-2"
              onActiveChange={(value) =>
                setOnchainPolicyForm((current) => ({ ...current, tokenMint: value }))
              }
              onChange={setTokenCatalog}
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
          <h2>Run agent action</h2>
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
          <h2>Owner approvals</h2>
          <p className="section-note">
            Payments above the autonomous threshold pause here. The owner signs an on-chain payment intent, then AgentWallet executes the approved payment automatically.
          </p>
          <p className="inline-status">
            <Info size={15} /> {approvalStatus}
          </p>
          <div className="agent-table approval-table" style={{ marginTop: 14 }}>
            <div className="agent-table-row header">
              <span>Payment</span>
              <span>Recipient</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {approvalRequests.length ? (
              approvalRequests.map((approval) => (
                <div className="agent-table-row" key={approval.id}>
                  <span>
                    <strong>{approval.amount} token</strong>
                    <small>{shortAddress(approval.tokenMint)}</small>
                  </span>
                  <span title={approval.recipient}>{shortAddress(approval.recipient)}</span>
                  <span>
                    <span className={`registry-status ${
                      approval.status === "approved" || approval.status === "executed"
                        ? "initialized"
                        : approval.status === "pending"
                          ? "draft"
                          : "blocked"
                    }`}>
                      {approval.status}
                    </span>
                  </span>
                  <div className="button-row compact">
                    {approval.status === "pending" ? (
                      <>
                        <button
                          className="button small"
                          type="button"
                          onClick={() => approvePaymentRequest(approval)}
                        >
                          <ShieldCheck size={15} /> Approve
                        </button>
                        <button
                          className="button secondary small"
                          type="button"
                          onClick={() => rejectPaymentRequest(approval)}
                        >
                          <X size={15} /> Reject
                        </button>
                      </>
                    ) : null}
                    {approval.approvalSignature ? (
                      <a
                        className="icon-button ghost"
                        href={getExplorerTransactionUrl(approval.approvalSignature)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="View approval transaction"
                      >
                        <ExternalLink size={15} />
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="agent-table-row">
                <span>No pending approvals.</span>
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </section>

        <section className="panel advanced-only">
          <h2>Agent API integration</h2>
          <div className="devnet-card">
            <p>
              A Telegram bot or backend agent calls this HTTP route after it turns an owner command into a payment intent. The server signs with the configured agent wallet, then submits the same on-chain `execute_payment` instruction used above.
            </p>
            <pre className="code-panel">{`POST /api/agent-wallet/pay
Authorization: Bearer <agent-api-key>
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

        <section className="panel advanced-only">
          <h2>Manual payment test</h2>
          <p className="section-note">
            Demo fallback: use this when you want Phantom to sign the agent payment manually. The normal agent workflow is AI Agent Chat or Telegram calling the backend executor.
          </p>
          <div className="policy-form">
            <ReadOnlyField
              label="Policy account"
              help="The on-chain policy PDA that AgentWallet checks before allowing payment."
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
              help="Decimals for the selected SPL token mint."
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

function AgentSdkPanel({
  agentApiKey,
  executePaymentForm,
  onchainPolicyForm,
  selectedProvisionedAgent
}: {
  agentApiKey: string;
  executePaymentForm: typeof defaultExecutePaymentForm;
  onchainPolicyForm: typeof defaultOnchainPolicyForm;
  selectedProvisionedAgent: ProvisionedAgent | null;
}) {
  const apiKeyValue = agentApiKey || "AGENTWALLET_API_KEY_FROM_DASHBOARD";
  const agentName = selectedProvisionedAgent?.name ?? "No agent selected";
  const agentWallet = selectedProvisionedAgent?.publicKey ?? "Select a hosted agent first";
  const policyPda = selectedProvisionedAgent?.policyPda ?? "Publish policy after selecting an agent";
  const recipient = executePaymentForm.recipient || "<allowed-recipient-wallet>";
  const amount = executePaymentForm.amount || "1";
  const tokenMint = onchainPolicyForm.tokenMint || "<allowed-token-mint>";
  const envSnippet = `AGENTWALLET_API_KEY=${apiKeyValue}`;
  const sdkSnippet = `import { AgentWallet } from "@agentwallet/sdk";

const wallet = new AgentWallet({
  baseUrl: "${sdkBaseUrlExample}",
  apiKey: process.env.AGENTWALLET_API_KEY!
});

const me = await wallet.getAgent();
console.log("Agent wallet:", me.agent.publicKey);

await wallet.pay({
  recipient: "${recipient}",
  amount: "${amount}",
  tokenMint: "${tokenMint}"
});`;
  const restSnippet = `curl -X POST "${sdkBaseUrlExample}/api/agent-wallet/pay" \\
  -H "Authorization: Bearer $AGENTWALLET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipient": "${recipient}",
    "amount": "${amount}",
    "tokenMint": "${tokenMint}"
  }'`;

  return (
    <div className="devnet-card sdk-handoff-card" style={{ marginTop: 14 }}>
      <div className="sdk-handoff-header">
        <div>
          <span className="eyebrow">Give this to your AI agent</span>
          <strong>AgentWallet SDK/API access</strong>
          <p>
            Your agent gets a scoped API key, not the private key. Every spend still
            routes through the owner policy and on-chain AgentWallet program.
          </p>
        </div>
        <div className="sdk-agent-pill">
          <span>{agentName}</span>
          <strong>{selectedProvisionedAgent ? shortAddress(selectedProvisionedAgent.publicKey) : "No wallet"}</strong>
        </div>
      </div>

      <div className="sdk-grid">
        <div className="sdk-highlight">
          <span>Hosted wallet</span>
          <strong>{agentWallet}</strong>
        </div>
        <div className="sdk-highlight">
          <span>Policy account</span>
          <strong>{policyPda}</strong>
        </div>
        <div className="sdk-highlight">
          <span>Default token</span>
          <strong>{tokenMint}</strong>
        </div>
      </div>

      <div className="sdk-copy-section">
        <span className="eyebrow">Environment variable for the agent</span>
        <CopyField value={envSnippet} label="Copy AgentWallet API key env variable" />
        <p>
          Paste this into your agent runtime secret store. If the full key is not shown,
          rotate the selected agent API key and copy the new one-time value.
        </p>
      </div>

      <div className="sdk-code-grid">
        <div>
          <span className="eyebrow">TypeScript SDK</span>
          <pre className="code-panel">{sdkSnippet}</pre>
          <div className="button-row">
            <button
              className="button secondary"
              type="button"
              onClick={() => void navigator.clipboard?.writeText(sdkSnippet)}
            >
              <KeyRound size={17} /> Copy SDK snippet
            </button>
          </div>
        </div>
        <div>
          <span className="eyebrow">REST fallback</span>
          <pre className="code-panel">{restSnippet}</pre>
          <div className="button-row">
            <button
              className="button secondary"
              type="button"
              onClick={() => void navigator.clipboard?.writeText(restSnippet)}
            >
              <Copy size={17} /> Copy REST call
            </button>
          </div>
        </div>
      </div>

      <div className="sdk-guardrails">
        <span>Your agent can request payments.</span>
        <span>AgentWallet signs only if policy allows it.</span>
        <span>Owners can pause, rotate, or export wallets.</span>
      </div>

      <a className="explorer-link" href="/docs" target="_blank" rel="noreferrer">
        <ExternalLink size={15} /> Read AgentWallet integration docs
      </a>
    </div>
  );
}

function SuiView() {
  const [config, setConfig] = useState<SuiDashboardConfig>(() => applySuiDeepBookMarket(null, "deep-sui-testnet"));
  const [activityEvents, setActivityEvents] = useState<SuiActivityEvent[]>([]);
  const [activityStatus, setActivityStatus] = useState("Enter a Sui package id, then fetch testnet activity.");
  const [isFetchingActivity, setIsFetchingActivity] = useState(false);
  const [deepBookOrders, setDeepBookOrders] = useState<SuiDeepBookOrder[]>([]);
  const [deepBookOrderStatus, setDeepBookOrderStatus] = useState("Run the agent strategy, then refresh DeepBook orders.");
  const [isFetchingDeepBookOrders, setIsFetchingDeepBookOrders] = useState(false);
  const [isSubmittingSuiAction, setIsSubmittingSuiAction] = useState(false);
  const [isRunningSuiDemo, setIsRunningSuiDemo] = useState(false);
  const [suiDemoProgress, setSuiDemoProgress] = useState<string[]>([]);
  const [suiActionStatus, setSuiActionStatus] = useState("Unlock local Sui wallets to run owner actions from the dashboard.");
  const [suiActionExplorerUrl, setSuiActionExplorerUrl] = useState<string | null>(null);
  const [suiAgentCommand, setSuiAgentCommand] = useState("");
  const [isSuiAgentExecuting, setIsSuiAgentExecuting] = useState(false);
  const [suiAgentMessages, setSuiAgentMessages] = useState<AgentChatMessage[]>([
    {
      id: "sui-agent-intro",
      role: "agent",
      content:
        "Give me a rule-based action: market buy 0.1 SUI of DEEP, limit buy 0.1 SUI of DEEP, show budget, show orders, or test over budget.",
      status: "info"
    }
  ]);
  const [suiMandate, setSuiMandate] = useState("max 0.5 SUI, DeepBook only, expires 24h");
  const [passwordConfirmed, setPasswordConfirmed] = useState(false);
  const [fundingConfirmed, setFundingConfirmed] = useState(false);
  const [mandateApplied, setMandateApplied] = useState(false);
  const [ownerSuiBalance, setOwnerSuiBalance] = useState("0");
  const [agentSuiBalance, setAgentSuiBalance] = useState("0");
  const [balanceStatus, setBalanceStatus] = useState("Generate wallets, then check their Sui testnet balances.");
  const [isFetchingBalances, setIsFetchingBalances] = useState(false);
  const parsedSuiMandate = useMemo(() => parseSuiAgentMandate(suiMandate), [suiMandate]);
  const selectedSuiMarketId = useMemo(() => findSuiDeepBookMarketId(config), [config]);
  const [encryptedSuiWallets, setEncryptedSuiWallets] = useState<EncryptedSuiLocalWalletBundle | null>(null);
  const [unlockedSuiWallets, setUnlockedSuiWallets] = useState<SuiLocalWalletBundle | null>(null);
  const [suiWalletPassword, setSuiWalletPassword] = useState("");
  const [suiWalletStatus, setSuiWalletStatus] = useState(
    "Create a local Sui owner and agent wallet for the Overflow demo path."
  );

  useEffect(() => {
    const savedConfig = window.localStorage.getItem(suiDashboardStorageKey);
    const savedWallets = window.localStorage.getItem(suiLocalWalletStorageKey);

    if (savedConfig) {
      try {
        const parsedConfig = normalizeSuiDashboardConfig(JSON.parse(savedConfig));
        setConfig(
          parsedConfig.allowedPoolId || parsedConfig.deepbookPackageId
            ? parsedConfig
            : applySuiDeepBookMarket(parsedConfig, "deep-sui-testnet")
        );
      } catch {
        setActivityStatus("Saved Sui config could not be read. Enter object ids again.");
      }
    }

    if (savedWallets) {
      try {
        const parsedWallets = JSON.parse(savedWallets) as EncryptedSuiLocalWalletBundle;
        setEncryptedSuiWallets(parsedWallets);
        setPasswordConfirmed(true);
        setSuiWalletStatus("Encrypted Sui wallets found. Enter the password to unlock private keys.");
      } catch {
        setSuiWalletStatus("Saved Sui wallets could not be read. Generate a new local pair.");
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(suiDashboardStorageKey, JSON.stringify(config));
  }, [config]);

  function updateConfig(key: keyof SuiDashboardConfig, value: string) {
    setConfig((current) => normalizeSuiDashboardConfig({ ...current, [key]: value }));
  }

  async function generateLocalSuiWallets() {
    try {
      const bundle = generateSuiLocalWalletBundle();
      const encrypted = await encryptSuiLocalWalletBundle(bundle, suiWalletPassword);
      window.localStorage.setItem(suiLocalWalletStorageKey, JSON.stringify(encrypted));
      setEncryptedSuiWallets(encrypted);
      setUnlockedSuiWallets(bundle);
      setFundingConfirmed(false);
      setConfig((current) => normalizeSuiDashboardConfig({ ...current, agentAddress: bundle.agent.address }));
      setSuiWalletStatus(
        "Local Sui owner and agent wallets generated. Fund both addresses on Sui testnet before running commands."
      );
    } catch (error) {
      setSuiWalletStatus(getErrorMessage(error));
    }
  }

  async function unlockLocalSuiWallets() {
    if (!encryptedSuiWallets) {
      setSuiWalletStatus("Generate Sui wallets before unlocking.");
      return;
    }

    try {
      const bundle = await decryptSuiLocalWalletBundle(encryptedSuiWallets, suiWalletPassword);
      setUnlockedSuiWallets(bundle);
      setConfig((current) => normalizeSuiDashboardConfig({ ...current, agentAddress: bundle.agent.address }));
      setSuiWalletStatus("Sui wallets unlocked locally. Private keys are available below for CLI setup.");
    } catch (error) {
      setSuiWalletStatus(getErrorMessage(error));
    }
  }

  async function fetchSuiActivity(configOverride?: unknown) {
    const activityConfig = resolveSuiActivityConfig(configOverride, config);

    if (!activityConfig.packageId.trim()) {
      setActivityStatus("Sui package id is required before fetching activity.");
      return;
    }

    try {
      setIsFetchingActivity(true);
      setActivityStatus("Fetching Sui testnet activity...");
      const response = await fetch("/api/sui/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityConfig)
      });
      const payload = await readJsonResponse<{ events: SuiActivityEvent[] }>(response);
      setActivityEvents(payload.events);
      const nextConfig = mergeSuiActivityIntoConfig(activityConfig, payload.events);
      setConfig(nextConfig);
      setActivityStatus(
        payload.events.length
          ? `Fetched ${payload.events.length} Sui event${payload.events.length === 1 ? "" : "s"}.`
          : "No matching AgentWallet Sui events found for these object ids yet."
      );
      if (
        nextConfig.lastDeepBookTransactionDigest &&
        nextConfig.deepbookPackageId &&
        nextConfig.balanceManagerId &&
        nextConfig.allowedPoolId
      ) {
        await fetchDeepBookOrders(nextConfig);
      }
    } catch (error) {
      setActivityStatus(getErrorMessage(error));
    } finally {
      setIsFetchingActivity(false);
    }
  }

  async function fetchDeepBookOrders(configOverride = config) {
    if (
      !configOverride.deepbookPackageId.trim() ||
      !configOverride.balanceManagerId.trim() ||
      !configOverride.allowedPoolId.trim()
    ) {
      setDeepBookOrderStatus("DeepBook package, pool, and balance manager IDs are required.");
      return;
    }

    try {
      setIsFetchingDeepBookOrders(true);
      setDeepBookOrderStatus("Fetching DeepBook order events...");
      const response = await fetch("/api/sui/deepbook-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deepbookPackageId: configOverride.deepbookPackageId,
          balanceManagerId: configOverride.balanceManagerId,
          poolId: configOverride.allowedPoolId,
          marketLabel: "DEEP / SUI",
          transactionDigest: configOverride.lastDeepBookTransactionDigest
        })
      });
      const payload = await readJsonResponse<{ orders: SuiDeepBookOrder[] }>(response);
      setDeepBookOrders(payload.orders);
      setDeepBookOrderStatus(
        payload.orders.length
          ? `Loaded ${payload.orders.length} DeepBook order${payload.orders.length === 1 ? "" : "s"}.`
          : "No matching DeepBook order events found yet."
      );
    } catch (error) {
      setDeepBookOrderStatus(getErrorMessage(error));
    } finally {
      setIsFetchingDeepBookOrders(false);
    }
  }

  function applySuiMandateToConfig() {
    const now = Date.now();
    setConfig((current) =>
      normalizeSuiDashboardConfig({
        ...current,
        budgetMist: parsedSuiMandate.maxBudget,
        expiresAtMs: String(now + Number(parsedSuiMandate.expiresAtMs)),
        spendAmount: current.spendAmount || "1000000"
      })
    );
    setSuiActionStatus(
      `Mandate applied: max ${parsedSuiMandate.budgetLabel}, ${parsedSuiMandate.allowedProtocol} only, expires in ${parsedSuiMandate.durationLabel}.`
    );
    setMandateApplied(true);
  }

  async function fetchSuiBalances() {
    if (!encryptedSuiWallets) {
      setBalanceStatus("Generate the owner and agent wallets first.");
      return null;
    }

    try {
      setIsFetchingBalances(true);
      setBalanceStatus("Checking Sui testnet balances...");
      const response = await fetch("/api/sui/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: encryptedSuiWallets.ownerAddress,
          agent: encryptedSuiWallets.agentAddress
        })
      });
      const balances = await readJsonResponse<{ ownerBalance: string; agentBalance: string }>(response);
      setOwnerSuiBalance(balances.ownerBalance);
      setAgentSuiBalance(balances.agentBalance);
      const readiness = mandateApplied
        ? getSuiFundingReadiness({
            ...balances,
            budgetMist: config.budgetMist,
            coinType: config.coinType
          })
        : getSuiGasReadiness(balances);
      setBalanceStatus(
        readiness.ready
          ? mandateApplied
            ? "Both wallets have enough SUI for the full mandate budget and transaction gas."
            : "Both wallets have enough SUI for transaction gas. Choose the mandate budget next."
          : `Funding required: owner needs at least ${formatSuiBalance(readiness.requiredOwnerBalance)} SUI and agent needs at least ${formatSuiBalance(readiness.requiredAgentBalance)} SUI.`
      );
      return balances;
    } catch (error) {
      setBalanceStatus(getErrorMessage(error));
      return null;
    } finally {
      setIsFetchingBalances(false);
    }
  }

  async function runSuiAction(action: SuiDashboardActionId) {
    if (!unlockedSuiWallets) {
      setSuiActionStatus("Unlock the local Sui wallets before running on-chain actions.");
      return;
    }

    try {
      setIsSubmittingSuiAction(true);
      setSuiActionExplorerUrl(null);
      const isAgentAction = action === "create-balance-manager" || action === "run-deepbook-strategy";
      setSuiActionStatus(
        isAgentAction
          ? "Agent is autonomously submitting the Sui strategy transaction..."
          : "Owner is submitting Sui policy transaction..."
      );
      const result = await submitSuiDashboardAction({
        action,
        config,
        privateKey: isAgentAction ? unlockedSuiWallets.agent.privateKey : unlockedSuiWallets.owner.privateKey
      });

      if (!result.ok) {
        setSuiActionExplorerUrl(result.explorerUrl ?? null);
        setSuiActionStatus(result.error);
        return;
      }

      const nextConfig = normalizeSuiDashboardConfig({
        ...mergeSuiActionResultIntoConfig(config, result),
        lastDeepBookTransactionDigest:
          action === "run-deepbook-strategy"
            ? result.digest
            : config.lastDeepBookTransactionDigest
      });
      setConfig(nextConfig);
      setSuiActionExplorerUrl(result.explorerUrl);
      setSuiActionStatus(
        isAgentAction
          ? `Agent strategy confirmed on Sui testnet: ${result.digest}.`
          : `Owner policy transaction confirmed on Sui testnet: ${result.digest}.`
      );
      await fetchSuiActivity(nextConfig);
      if (action === "run-deepbook-strategy") {
        await fetchDeepBookOrders(nextConfig);
      }
    } catch (error) {
      setSuiActionStatus(getErrorMessage(error));
    } finally {
      setIsSubmittingSuiAction(false);
    }
  }

  function appendSuiAgentMessage(message: Omit<AgentChatMessage, "id">) {
    setSuiAgentMessages((current) => [
      ...current,
      {
        ...message,
        id: `sui-agent-${Date.now()}-${current.length}`
      }
    ]);
  }

  async function submitSuiAgentCommand() {
    const input = suiAgentCommand.trim();
    if (!input) {
      return;
    }

    appendSuiAgentMessage({ role: "owner", content: input, status: "info" });
    setSuiAgentCommand("");

    try {
      setIsSuiAgentExecuting(true);
      const command = parseSuiAgentCommand(input);

      if (command.kind === "show-budget") {
        const metrics = getSuiBudgetMetrics(config.budgetMist, activityEvents);
        appendSuiAgentMessage({
          role: "agent",
          content: `Budget used: ${formatSuiTokenAmount(metrics.usedBudget, config.tokenTypeLabel)}. Remaining: ${formatSuiTokenAmount(metrics.remainingBudget, config.tokenTypeLabel)}.`,
          status: "info"
        });
        return;
      }

      if (command.kind === "show-orders") {
        await fetchDeepBookOrders(config);
        appendSuiAgentMessage({
          role: "agent",
          content: "DeepBook orders refreshed. Review the Agent orders section below.",
          status: "info"
        });
        return;
      }

      if (getSuiPolicyExpiryState(config.expiresAtMs).expired) {
        const message = "Rejected: this policy has expired. Create a new mandate before asking the agent to trade.";
        appendSuiAgentMessage({ role: "agent", content: message, status: "rejected" });
        setSuiActionStatus(message);
        return;
      }

      if (!unlockedSuiWallets) {
        throw new Error("Unlock the local Sui wallets before asking the agent to execute an action.");
      }

      const actionConfig =
        command.kind === "test-over-budget"
          ? buildSuiOverBudgetConfig(config)
          : (() => {
              const market = suiDeepBookMarkets.find(
                (candidate) => candidate.poolId === config.allowedPoolId
              );
              return normalizeSuiDashboardConfig({
                ...config,
                spendAmount: command.amount,
                orderQuantity: scaleSuiOrderQuantity(
                  command.amount,
                  market?.defaultSpendAmount ?? config.spendAmount,
                  market?.defaultOrderQuantity ?? config.orderQuantity
                ),
                orderSide: command.side === "buy" ? "bid" : "ask",
                orderExecution: command.execution
              });
            })();
      setSuiActionStatus(
        command.kind === "test-over-budget"
          ? "Agent is deliberately testing the on-chain budget ceiling..."
          : `Agent is submitting a ${command.execution} ${command.side} order through the Move policy...`
      );
      const result = await submitSuiDashboardAction({
        action: "run-deepbook-strategy",
        config: actionConfig,
        privateKey: unlockedSuiWallets.agent.privateKey
      });

      if (command.kind === "test-over-budget") {
        if (result.ok) {
          appendSuiAgentMessage({
            role: "agent",
            content: "Policy test failed: the deliberately over-budget order unexpectedly executed.",
            explorerUrl: result.explorerUrl,
            status: "rejected"
          });
          return;
        }

        const budgetProofMessage = describeSuiBudgetProofRejection(result.error);
        appendSuiAgentMessage({
          role: "agent",
          content: budgetProofMessage,
          explorerUrl: result.explorerUrl,
          status: "approved"
        });
        setSuiActionStatus(budgetProofMessage);
        await fetchSuiActivity(config);
        return;
      }

      if (!result.ok) {
        const rejectionMessage = result.error.includes("remaining budget")
          ? `${result.error} Remaining budget: ${formatSuiTokenAmount(
              getSuiBudgetMetrics(config.budgetMist, activityEvents).remainingBudget,
              config.tokenTypeLabel
            )}`
          : result.error;
        appendSuiAgentMessage({
          role: "agent",
          content: rejectionMessage,
          explorerUrl: result.explorerUrl,
          status: "rejected"
        });
        setSuiActionExplorerUrl(result.explorerUrl ?? null);
        setSuiActionStatus(rejectionMessage);
        await fetchSuiActivity(config);
        return;
      }

      const nextConfig = normalizeSuiDashboardConfig({
        ...mergeSuiActionResultIntoConfig(actionConfig, result),
        lastDeepBookTransactionDigest: result.digest
      });
      setConfig(nextConfig);
      setSuiActionExplorerUrl(result.explorerUrl);
      setSuiActionStatus(`Agent ${command.execution} ${command.side} order confirmed on Sui testnet: ${result.digest}.`);
      appendSuiAgentMessage({
        role: "agent",
        content: `${command.execution === "market" ? "Market" : "Limit"} ${command.side} order approved by the Move policy and submitted to DeepBook.`,
        explorerUrl: result.explorerUrl,
        status: "approved"
      });
      await fetchSuiActivity(nextConfig);
      await fetchDeepBookOrders(nextConfig);
    } catch (error) {
      const message = getErrorMessage(error);
      appendSuiAgentMessage({ role: "agent", content: message, status: "rejected" });
      setSuiActionStatus(message);
    } finally {
      setIsSuiAgentExecuting(false);
    }
  }

  async function runSuiAutonomousDemo() {
    if (!unlockedSuiWallets) {
      setSuiActionStatus("Unlock the local Sui wallets before launching the agent.");
      return;
    }

    if (!config.packageId.trim() || !config.agentAddress.trim() || !config.allowedPoolId.trim()) {
      setSuiActionStatus("Enter the AgentWallet package ID and use a verified DeepBook market before launching the agent.");
      return;
    }

    const latestBalances = await fetchSuiBalances();
    if (!latestBalances) {
      setSuiActionStatus("Unable to verify wallet balances before launch.");
      return;
    }
    const readiness = getSuiFundingReadiness({
      ...latestBalances,
      budgetMist: config.budgetMist,
      coinType: config.coinType
    });
    if (!readiness.ready) {
      setSuiActionStatus(
        `Launch blocked before signing: owner needs at least ${formatSuiBalance(readiness.requiredOwnerBalance)} SUI for the full mandate budget plus gas, and agent needs at least ${formatSuiBalance(readiness.requiredAgentBalance)} SUI for gas.`
      );
      return;
    }

    let currentConfig = config;
    const progress: string[] = [];
    const vaultFunded =
      suiDemoProgress.some((entry) => entry.includes("Vault funding confirmed")) ||
      activityEvents.some((event) => event.type === "AgentVaultFunded")
        ? true
        : suiDemoProgress.some((entry) => entry.includes("Agent vault creation confirmed")) ||
            activityEvents.some((event) => event.type === "AgentVaultCreated")
          ? false
          : undefined;
    const steps = buildSuiAutonomousDemoSteps(currentConfig, {
      vaultFunded
    });

    try {
      setIsRunningSuiDemo(true);
      setIsSubmittingSuiAction(true);
      setSuiActionExplorerUrl(null);
      setSuiDemoProgress([]);

      for (const step of steps) {
        if (step === "prove-budget-ceiling") {
          setSuiActionStatus("Agent is attempting an over-budget strategy to prove the Move ceiling...");
          const rejected = await submitSuiDashboardAction({
            action: "run-deepbook-strategy",
            config: buildSuiOverBudgetConfig(currentConfig),
            privateKey: unlockedSuiWallets.agent.privateKey
          });

          if (rejected.ok) {
            setSuiActionExplorerUrl(rejected.explorerUrl);
            throw new Error("Budget proof failed: the deliberately over-budget transaction unexpectedly succeeded.");
          }

          progress.push(describeSuiBudgetProofRejection(rejected.error));
          setSuiDemoProgress([...progress]);
          continue;
        }

        const isAgentAction = step === "create-balance-manager" || step === "run-deepbook-strategy";
        setSuiActionStatus(`${suiDemoStepLabel(step)}...`);
        const result = await submitSuiDashboardAction({
          action: step,
          config: currentConfig,
          privateKey: isAgentAction ? unlockedSuiWallets.agent.privateKey : unlockedSuiWallets.owner.privateKey
        });

        if (!result.ok) {
          setSuiActionExplorerUrl(result.explorerUrl ?? null);
          throw new Error(`${suiDemoStepLabel(step)} failed: ${result.error}`);
        }

        currentConfig = normalizeSuiDashboardConfig({
          ...mergeSuiActionResultIntoConfig(currentConfig, result),
          lastDeepBookTransactionDigest:
            step === "run-deepbook-strategy"
              ? result.digest
              : currentConfig.lastDeepBookTransactionDigest
        });
        setConfig(currentConfig);
        setSuiActionExplorerUrl(result.explorerUrl);
        progress.push(`${suiDemoStepLabel(step)} confirmed`);
        setSuiDemoProgress([...progress]);
      }

      setSuiActionStatus(
        "Agent launched. Policy, vault funding, and DeepBook manager are ready. Use the agent command console to submit the first real DeepBook transaction."
      );
      await fetchSuiActivity(currentConfig);
    } catch (error) {
      setSuiActionStatus(getErrorMessage(error));
    } finally {
      setIsSubmittingSuiAction(false);
      setIsRunningSuiDemo(false);
    }
  }

  const suiGasReadiness = getSuiGasReadiness({
    ownerBalance: ownerSuiBalance,
    agentBalance: agentSuiBalance
  });
  const suiLaunchStage = getSuiLaunchStage({
    hasPassword: passwordConfirmed,
    hasWallets: Boolean(encryptedSuiWallets),
    walletsFunded: fundingConfirmed,
    unlocked: Boolean(unlockedSuiWallets),
    mandateApplied,
    launched: Boolean(config.balanceManagerId) ||
      suiDemoProgress.some((entry) => entry.includes("Agent DeepBook manager creation confirmed"))
  });

  return (
    <SuiGuidedDashboard
      stage={suiLaunchStage}
      password={suiWalletPassword}
      setPassword={setSuiWalletPassword}
      confirmPassword={() => {
        if (suiWalletPassword.length < 8) {
          setSuiWalletStatus("Use at least 8 characters for the local wallet password.");
          return;
        }
        setPasswordConfirmed(true);
        setSuiWalletStatus("Password ready. Generate the owner and agent wallets.");
      }}
      encryptedWallets={encryptedSuiWallets}
      unlockedWallets={unlockedSuiWallets}
      generateWallets={generateLocalSuiWallets}
      unlockWallets={unlockLocalSuiWallets}
      walletStatus={suiWalletStatus}
      ownerBalance={ownerSuiBalance}
      agentBalance={agentSuiBalance}
      requiredOwnerBalance={suiGasReadiness.requiredOwnerBalance}
      requiredAgentBalance={suiGasReadiness.requiredAgentBalance}
      balanceStatus={balanceStatus}
      fetchBalances={fetchSuiBalances}
      isFetchingBalances={isFetchingBalances}
      canContinueFunding={suiGasReadiness.ready}
      continueFromFunding={() => setFundingConfirmed(true)}
      mandate={suiMandate}
      setMandate={(value) => {
        setSuiMandate(value);
        setMandateApplied(false);
      }}
      parsedMandate={parsedSuiMandate}
      applyMandate={applySuiMandateToConfig}
      runProof={runSuiAutonomousDemo}
      revoke={() => void runSuiAction("revoke-policy")}
      isRunning={isRunningSuiDemo}
      actionStatus={suiActionStatus}
      explorerUrl={suiActionExplorerUrl}
      progress={suiDemoProgress}
      config={config}
      updateConfig={updateConfig}
      activityEvents={activityEvents}
      activityStatus={activityStatus}
      fetchActivity={() => void fetchSuiActivity()}
      isFetchingActivity={isFetchingActivity}
      deepBookOrders={deepBookOrders}
      deepBookOrderStatus={deepBookOrderStatus}
      fetchDeepBookOrders={() => void fetchDeepBookOrders()}
      isFetchingDeepBookOrders={isFetchingDeepBookOrders}
      agentCommand={suiAgentCommand}
      setAgentCommand={setSuiAgentCommand}
      agentMessages={suiAgentMessages}
      submitAgentCommand={() => void submitSuiAgentCommand()}
      isAgentExecuting={isSuiAgentExecuting}
    />
  );

  return (
    <section className="grid workspace" style={{ marginTop: 16 }}>
      <section className="panel span-2">
        <div className="section-header">
          <div>
            <span className="eyebrow">Sui wallet setup</span>
            <h2>Generate owner and agent wallets</h2>
          </div>
          <span className={`registry-status ${unlockedSuiWallets ? "initialized" : "pending"}`}>
            {unlockedSuiWallets ? "unlocked locally" : encryptedSuiWallets ? "encrypted locally" : "not created"}
          </span>
        </div>
        <p className="section-note">
          This creates a Sui owner wallet and a separate agent wallet in your browser for testnet demos. AgentWallet
          encrypts the private keys with your password and stores the encrypted vault only in local storage.
        </p>
        <div className="setup-grid" style={{ marginTop: 12 }}>
          <div className="devnet-card">
            <span className="eyebrow">Owner wallet</span>
            <strong>{encryptedSuiWallets ? shortAddress(encryptedSuiWallets?.ownerAddress ?? "") : "Not generated"}</strong>
            {encryptedSuiWallets ? (
              <CopyField value={encryptedSuiWallets?.ownerAddress ?? ""} label="Copy Sui owner address" />
            ) : (
              <p>Creates and owns the Sui policy object for the Overflow demo.</p>
            )}
          </div>
          <div className="devnet-card">
            <span className="eyebrow">Agent wallet</span>
            <strong>{encryptedSuiWallets ? shortAddress(encryptedSuiWallets?.agentAddress ?? "") : "Not generated"}</strong>
            {encryptedSuiWallets ? (
              <CopyField value={encryptedSuiWallets?.agentAddress ?? ""} label="Copy Sui agent address" />
            ) : (
              <p>This address is allowed to spend from the Move policy vault.</p>
            )}
          </div>
          <div className="devnet-card">
            <span className="eyebrow">Testnet funding</span>
            <strong>Fund both Sui addresses</strong>
            <p>
              Use the Sui testnet faucet for gas. The owner signs policy actions; the agent signs autonomous strategy
              transactions.
            </p>
            <a className="explorer-link" href="https://faucet.sui.io/" target="_blank" rel="noreferrer">
              <ExternalLink size={15} /> Open Sui faucet
            </a>
          </div>
        </div>
        <div className="policy-form" style={{ marginTop: 14 }}>
          <PasswordField
            label="Local Sui wallet password"
            help="Minimum 8 characters. AgentWallet does not store this password."
            value={suiWalletPassword}
            onChange={setSuiWalletPassword}
          />
        </div>
        <div className="devnet-card" style={{ marginTop: 14 }}>
          <span className="eyebrow">Sui agent setup</span>
          <strong>Launch the policy-controlled agent</strong>
          <p>
            Creates missing policy objects, funds the vault with the selected operating balance, and creates the
            DeepBook manager. Submit the first real order from the agent command console after launch.
          </p>
          <div className="button-row" style={{ marginTop: 12 }}>
            <button
              className="button"
              type="button"
              disabled={isRunningSuiDemo || !unlockedSuiWallets || !config.packageId.trim()}
              onClick={() => void runSuiAutonomousDemo()}
            >
              <PlayCircle size={17} /> {isRunningSuiDemo ? "Launching agent..." : "Launch agent"}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={isSubmittingSuiAction || !unlockedSuiWallets || !config.policyId.trim()}
              onClick={() => void runSuiAction("revoke-policy")}
            >
              <X size={17} /> Revoke policy
            </button>
          </div>
          {suiDemoProgress.length ? (
            <div className="audit-list" style={{ marginTop: 12 }}>
              {suiDemoProgress.map((entry, index) => (
                <div className="audit-item" key={`${entry}-${index}`}>
                  <CheckCircle2 size={16} />
                  <span>{entry}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="button-row" style={{ marginTop: 12 }}>
          <button className="button" type="button" onClick={generateLocalSuiWallets}>
            <KeyRound size={17} /> {encryptedSuiWallets ? "Replace local Sui wallets" : "Generate Sui wallets"}
          </button>
          <button className="button secondary" type="button" disabled={!encryptedSuiWallets} onClick={unlockLocalSuiWallets}>
            <ShieldCheck size={17} /> Unlock private keys
          </button>
        </div>
        <p className="inline-status">
          <Info size={15} /> {suiWalletStatus}
        </p>
        {unlockedSuiWallets ? (
          <div className="setup-grid" style={{ marginTop: 12 }}>
            <div className="devnet-card">
              <span className="eyebrow">Owner private key</span>
              <strong>Unlocked for CLI commands</strong>
              <CopyField value={unlockedSuiWallets?.owner.privateKey ?? ""} label="Copy Sui owner private key" />
            </div>
            <div className="devnet-card">
              <span className="eyebrow">Agent private key</span>
              <strong>Unlocked for autonomous execution</strong>
              <CopyField value={unlockedSuiWallets?.agent.privateKey ?? ""} label="Copy Sui agent private key" />
            </div>
          </div>
        ) : null}
      </section>
      <section className="panel span-2">
        <div className="section-header">
          <div>
            <span className="eyebrow">Sui autonomous agent mandate</span>
            <h2>Ask the agent to execute under policy</h2>
          </div>
          <span className={`registry-status ${unlockedSuiWallets ? "initialized" : "pending"}`}>
            {unlockedSuiWallets ? "wallet unlocked" : "unlock required"}
          </span>
        </div>
        <p className="section-note">
          Model the Overflow requirement directly: the owner gives the AI agent a natural-language mandate, AgentWallet
          publishes the Move policy, then the agent signs and submits the DeepBook strategy with its own wallet.
        </p>
        <div className="policy-form" style={{ marginTop: 14 }}>
          <label className="field">
            <span>
              DeepBook market
              <small>
                Choose a verified market to fill the pool, package, coin, base, quote, quantity, and price automatically.
              </small>
            </span>
            <select
              value={selectedSuiMarketId}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setConfig((current) =>
                    normalizeSuiDashboardConfig({
                      ...current,
                      allowedPoolId: "",
                      deepbookPackageId: ""
                    })
                  );
                  setSuiActionStatus("Custom DeepBook market enabled. Enter verified pool and package IDs below.");
                  return;
                }

                setConfig((current) => applySuiDeepBookMarket(current, event.target.value));
                setSuiActionStatus("Verified DeepBook market configuration applied.");
              }}
            >
              {suiDeepBookMarkets.map((market) => (
                <option key={market.id} value={market.id}>
                  {market.label} · {market.network}
                </option>
              ))}
              <option value="custom">Custom market settings</option>
            </select>
          </label>
        </div>
        {selectedSuiMarketId !== "custom" ? (
          <div className="setup-grid" style={{ marginTop: 12 }}>
            <div className="devnet-card">
              <span className="eyebrow">Selected market</span>
              <strong>{suiDeepBookMarkets.find((market) => market.id === selectedSuiMarketId)?.label}</strong>
              <p>{suiDeepBookMarkets.find((market) => market.id === selectedSuiMarketId)?.description}</p>
            </div>
            <div className="devnet-card">
              <span className="eyebrow">Pool scope</span>
              <strong>{shortAddress(config.allowedPoolId)}</strong>
              <p>This pool object is written into the owner policy as the agent&apos;s allowed protocol scope.</p>
            </div>
            <div className="devnet-card">
              <span className="eyebrow">Order assets</span>
              <strong>
                {config.deepbookBaseType.includes("::deep::DEEP") ? "DEEP" : "Base"} / {config.tokenTypeLabel}
              </strong>
              <p>Asset Move types and known working testnet order parameters are configured automatically.</p>
            </div>
          </div>
        ) : null}
        <div className="policy-form" style={{ marginTop: 14 }}>
          <EditableField
            label="Owner instruction to AI agent"
            help="Examples: max 0.5 SUI, DeepBook only, expires 5m · expires 24h."
            value={suiMandate}
            onChange={setSuiMandate}
          />
        </div>
        <div className="setup-grid" style={{ marginTop: 12 }}>
          <div className="devnet-card">
            <span className="eyebrow">Budget ceiling</span>
            <strong>{parsedSuiMandate.budgetLabel}</strong>
            <p>Stored as {parsedSuiMandate.maxBudget} base units in the Move policy.</p>
          </div>
          <div className="devnet-card">
            <span className="eyebrow">Protocol scope</span>
            <strong>{parsedSuiMandate.allowedProtocol} only</strong>
            <p>The allowed pool object constrains where the agent can spend.</p>
          </div>
          <div className="devnet-card">
            <span className="eyebrow">Expiry</span>
            <strong>{parsedSuiMandate.durationLabel}</strong>
            <p>Applied as an absolute timestamp when you create the policy.</p>
          </div>
        </div>
        <div className="button-row" style={{ marginTop: 12 }}>
          <button className="button secondary" type="button" onClick={applySuiMandateToConfig}>
            <Bot size={17} /> Apply mandate
          </button>
          <button
            className="button"
            type="button"
            disabled={isSubmittingSuiAction || !unlockedSuiWallets}
            onClick={() => void runSuiAction("create-policy")}
          >
            <ShieldCheck size={17} /> Create policy
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={isSubmittingSuiAction || !unlockedSuiWallets || !config.policyId.trim()}
            onClick={() => void runSuiAction("create-vault")}
          >
            <WalletCards size={17} /> Create vault
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={isSubmittingSuiAction || !unlockedSuiWallets || !config.vaultId.trim()}
            onClick={() => void runSuiAction("fund-vault")}
          >
            <CircleDollarSign size={17} /> Fund vault
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={isSubmittingSuiAction || !unlockedSuiWallets || !config.deepbookPackageId.trim()}
            onClick={() => void runSuiAction("create-balance-manager")}
          >
            <Bot size={17} /> Agent creates DeepBook manager
          </button>
          <button
            className="button"
            type="button"
            disabled={
              isSubmittingSuiAction ||
              !unlockedSuiWallets ||
              !config.policyId.trim() ||
              !config.vaultId.trim() ||
              !config.balanceManagerId.trim() ||
              !config.allowedPoolId.trim() ||
              !config.deepbookPackageId.trim() ||
              !config.coinType.trim() ||
              !config.deepbookBaseType.trim() ||
              !config.deepbookQuoteType.trim()
            }
            onClick={() => void runSuiAction("run-deepbook-strategy")}
          >
            <Activity size={17} /> Agent runs DeepBook strategy
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={isSubmittingSuiAction || !unlockedSuiWallets || !config.policyId.trim()}
            onClick={() => void runSuiAction("revoke-policy")}
          >
            <X size={17} /> Revoke policy
          </button>
        </div>
        <p className="inline-status">
          <Info size={15} /> {suiActionStatus}
        </p>
        {suiActionExplorerUrl ? (
          <a className="explorer-link" href={suiActionExplorerUrl ?? undefined} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> View Sui transaction
          </a>
        ) : null}
      </section>
      <section className="panel span-2">
        <div className="section-header">
          <div>
            <span className="eyebrow">Sui testnet workspace</span>
            <h2>Object IDs and proof state</h2>
          </div>
          <span className="registry-status pending">saved locally</span>
        </div>
        <p className="section-note">
          Paste the Sui testnet IDs after publishing the Move package and creating the policy/vault.
          AgentWallet stores these values in browser local storage and uses them to generate commands
          and fetch the on-chain event trail.
        </p>
        <div className="policy-form">
          <EditableField
            label="Sui package ID"
            help="The package id returned by publishing sui/agent_wallet."
            value={config.packageId}
            onChange={(value) => updateConfig("packageId", value)}
          />
          <EditableField
            label="Policy object ID"
            help="The AgentPolicy object created by the owner."
            value={config.policyId}
            onChange={(value) => updateConfig("policyId", value)}
          />
          <EditableField
            label="Vault object ID"
            help="The AgentVault object bound to the agent."
            value={config.vaultId}
            onChange={(value) => updateConfig("vaultId", value)}
          />
          <EditableField
            label="Agent address"
            help="The Sui address allowed to execute from the policy vault."
            value={config.agentAddress}
            onChange={(value) => updateConfig("agentAddress", value)}
          />
          <EditableField
            label="DeepBook pool ID"
            help="The allowed DeepBook pool object id for the agent strategy."
            value={config.allowedPoolId}
            onChange={(value) => updateConfig("allowedPoolId", value)}
          />
          <EditableField
            label="Balance manager ID"
            help="The DeepBook balance manager used by the agent order plan."
            value={config.balanceManagerId}
            onChange={(value) => updateConfig("balanceManagerId", value)}
          />
          <EditableField
            label="DeepBook package ID"
            help="The DeepBook package id used by the testnet order plan."
            value={config.deepbookPackageId}
            onChange={(value) => updateConfig("deepbookPackageId", value)}
          />
          <EditableField
            label="Vault coin type"
            help="Move coin type held by the AgentWallet vault, for example 0x2::sui::SUI or a testnet USDC type."
            value={config.coinType}
            onChange={(value) => updateConfig("coinType", value)}
          />
          <EditableField
            label="Token label"
            help="Human-readable token label stored in the vault event, for example SUI or USDC."
            value={config.tokenTypeLabel}
            onChange={(value) => updateConfig("tokenTypeLabel", value)}
          />
          <EditableField
            label="DeepBook base asset type"
            help="Base asset Move type for pool::place_limit_order."
            value={config.deepbookBaseType}
            onChange={(value) => updateConfig("deepbookBaseType", value)}
          />
          <EditableField
            label="DeepBook quote asset type"
            help="Quote asset Move type for pool::place_limit_order."
            value={config.deepbookQuoteType}
            onChange={(value) => updateConfig("deepbookQuoteType", value)}
          />
          <EditableField
            label="Budget in base units"
            help="The policy budget ceiling in the selected vault coin's smallest unit."
            value={config.budgetMist}
            onChange={(value) => updateConfig("budgetMist", value)}
          />
          <EditableField
            label="Expires at ms"
            help="Policy expiration timestamp in Unix milliseconds."
            value={config.expiresAtMs}
            onChange={(value) => updateConfig("expiresAtMs", value)}
          />
          <EditableField
            label="Spend amount"
            help="Amount released from the vault for the agent strategy, in the selected coin's smallest unit."
            value={config.spendAmount}
            onChange={(value) => updateConfig("spendAmount", value)}
          />
          <EditableField
            label="Order quantity"
            help="DeepBook order quantity passed to place_limit_order."
            value={config.orderQuantity}
            onChange={(value) => updateConfig("orderQuantity", value)}
          />
          <EditableField
            label="Limit price"
            help="Limit price used by the DeepBook demo transaction plan."
            value={config.limitPrice}
            onChange={(value) => updateConfig("limitPrice", value)}
          />
        </div>
        <div className="button-row" style={{ marginTop: 16 }}>
          <button className="button" type="button" disabled={isFetchingActivity} onClick={() => void fetchSuiActivity()}>
            <Activity size={17} /> {isFetchingActivity ? "Fetching activity..." : "Fetch Sui activity"}
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              const resetConfig = applySuiDeepBookMarket(null, "deep-sui-testnet");
              setConfig(resetConfig);
              setActivityEvents([]);
              setActivityStatus("Sui workspace cleared.");
            }}
          >
            <X size={17} /> Clear Sui IDs
          </button>
        </div>
        <p className="inline-status">
          <Info size={15} /> {activityStatus}
        </p>
      </section>

      <SuiOverflowPanel config={config} activityEvents={activityEvents} onFetchActivity={() => void fetchSuiActivity()} isFetchingActivity={isFetchingActivity} />
    </section>
  );
}

function SuiGuidedDashboard({
  stage,
  password,
  setPassword,
  confirmPassword,
  encryptedWallets,
  unlockedWallets,
  generateWallets,
  unlockWallets,
  walletStatus,
  ownerBalance,
  agentBalance,
  requiredOwnerBalance,
  requiredAgentBalance,
  balanceStatus,
  fetchBalances,
  isFetchingBalances,
  canContinueFunding,
  continueFromFunding,
  mandate,
  setMandate,
  parsedMandate,
  applyMandate,
  runProof,
  revoke,
  isRunning,
  actionStatus,
  explorerUrl,
  progress,
  config,
  updateConfig,
  activityEvents,
  activityStatus,
  fetchActivity,
  isFetchingActivity,
  deepBookOrders,
  deepBookOrderStatus,
  fetchDeepBookOrders,
  isFetchingDeepBookOrders,
  agentCommand,
  setAgentCommand,
  agentMessages,
  submitAgentCommand,
  isAgentExecuting
}: {
  stage: ReturnType<typeof getSuiLaunchStage>;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: () => void;
  encryptedWallets: EncryptedSuiLocalWalletBundle | null;
  unlockedWallets: SuiLocalWalletBundle | null;
  generateWallets: () => void;
  unlockWallets: () => void;
  walletStatus: string;
  ownerBalance: string;
  agentBalance: string;
  requiredOwnerBalance: string;
  requiredAgentBalance: string;
  balanceStatus: string;
  fetchBalances: () => void;
  isFetchingBalances: boolean;
  canContinueFunding: boolean;
  continueFromFunding: () => void;
  mandate: string;
  setMandate: (value: string) => void;
  parsedMandate: ReturnType<typeof parseSuiAgentMandate>;
  applyMandate: () => void;
  runProof: () => void;
  revoke: () => void;
  isRunning: boolean;
  actionStatus: string;
  explorerUrl: string | null;
  progress: string[];
  config: SuiDashboardConfig;
  updateConfig: (key: keyof SuiDashboardConfig, value: string) => void;
  activityEvents: SuiActivityEvent[];
  activityStatus: string;
  fetchActivity: () => void;
  isFetchingActivity: boolean;
  deepBookOrders: SuiDeepBookOrder[];
  deepBookOrderStatus: string;
  fetchDeepBookOrders: () => void;
  isFetchingDeepBookOrders: boolean;
  agentCommand: string;
  setAgentCommand: (value: string) => void;
  agentMessages: AgentChatMessage[];
  submitAgentCommand: () => void;
  isAgentExecuting: boolean;
}) {
  const [reviewStage, setReviewStage] = useState<SuiLaunchStage | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const steps = [
    ["password", "Secure"],
    ["wallets", "Create"],
    ["fund", "Fund"],
    ["unlock", "Unlock"],
    ["mandate", "Mandate"],
    ["launch", "Launch"],
    ["console", "Live"]
  ] as const;
  const activeIndex = steps.findIndex(([id]) => id === stage);
  const isLive = stage === "console";
  const isReviewing = reviewStage !== null && reviewStage !== stage;
  const launchReadiness = getSuiFundingReadiness({
    ownerBalance,
    agentBalance,
    budgetMist: config.budgetMist,
    coinType: config.coinType
  });
  const budgetMetrics = getSuiBudgetMetrics(config.budgetMist, activityEvents);
  const expiryState = getSuiPolicyExpiryState(config.expiresAtMs, nowMs);

  useEffect(() => {
    if (!isLive || expiryState.expired) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isLive, expiryState.expired]);

  return (
    <section className="sui-guided-shell">
      <section className="panel sui-launch-header">
        <div>
          <span className="eyebrow">Sui autonomous agent wallet</span>
          <h2>{isLive ? "Your agent is live." : "Launch an autonomous DeepBook agent."}</h2>
          <p className="section-note">
            Set one mandate. AgentWallet handles pool selection, Move policy creation, vault setup, and autonomous execution.
          </p>
        </div>
        <div className="button-row compact">
          {isReviewing ? (
            <button className="button secondary small" type="button" onClick={() => setReviewStage(null)}>
              Return to current step
            </button>
          ) : null}
          <span className={`registry-status ${isLive ? "initialized" : "pending"}`}>
            {isReviewing ? "reviewing history" : isLive ? "policy active" : `step ${activeIndex + 1} of ${steps.length}`}
          </span>
        </div>
      </section>

      <nav className="sui-stepper" aria-label="Sui setup progress">
        {steps.map(([id, label], index) => (
          <button
            className={`${index <= activeIndex ? "sui-step complete" : "sui-step"} ${reviewStage === id ? "reviewing" : ""}`}
            disabled={!canReviewSuiLaunchStage(stage, id)}
            key={id}
            onClick={() => setReviewStage(id === stage ? null : id)}
            type="button"
          >
            <span>{index < activeIndex ? "✓" : index + 1}</span>
            <strong>{label}</strong>
          </button>
        ))}
      </nav>

      {isReviewing && reviewStage ? (
        <SuiStepReview
          stage={reviewStage}
          encryptedWallets={encryptedWallets}
          ownerBalance={ownerBalance}
          agentBalance={agentBalance}
          parsedMandate={parsedMandate}
          progress={progress}
          config={config}
          onReturn={() => setReviewStage(null)}
        />
      ) : null}

      {!isReviewing && stage === "password" ? (
        <section className="panel sui-focus-card">
          <span className="eyebrow">Step 1 · Secure locally</span>
          <h2>Set your wallet password</h2>
          <p className="section-note">This password encrypts the owner and agent private keys in this browser. AgentWallet never stores it.</p>
          <PasswordField label="Local encryption password" value={password} onChange={setPassword} help="Use at least 8 characters." />
          <button className="button" type="button" onClick={confirmPassword}>
            <ShieldCheck size={17} /> Set password
          </button>
        </section>
      ) : null}

      {!isReviewing && stage === "wallets" ? (
        <section className="panel sui-focus-card">
          <span className="eyebrow">Step 2 · Create wallets</span>
          <h2>Create owner and agent wallets</h2>
          <p className="section-note">The owner controls policy and revocation. The separate agent wallet signs autonomous DeepBook actions.</p>
          <button className="button" type="button" onClick={generateWallets}>
            <KeyRound size={17} /> Generate wallets
          </button>
          <p className="inline-status"><Info size={15} /> {walletStatus}</p>
        </section>
      ) : null}

      {!isReviewing && stage === "fund" && encryptedWallets ? (
        <section className="panel sui-focus-card">
          <span className="eyebrow">Step 3 · Fund testnet wallets</span>
          <h2>Give both wallets gas</h2>
          <p className="section-note">Fund both addresses with Sui testnet SUI. AgentWallet checks readiness before continuing.</p>
          <div className="setup-grid">
            <SuiWalletReadinessCard label="Owner wallet" address={encryptedWallets.ownerAddress} balance={ownerBalance} requiredBalance={requiredOwnerBalance} />
            <SuiWalletReadinessCard label="Agent wallet" address={encryptedWallets.agentAddress} balance={agentBalance} requiredBalance={requiredAgentBalance} />
          </div>
          <div className="button-row">
            <a className="button secondary" href="https://faucet.sui.io/" target="_blank" rel="noreferrer">
              <ExternalLink size={17} /> Open Sui faucet
            </a>
            <button className="button" type="button" disabled={isFetchingBalances} onClick={fetchBalances}>
              <Activity size={17} /> {isFetchingBalances ? "Checking..." : "Check balances"}
            </button>
            <button className="button" type="button" disabled={!canContinueFunding || isFetchingBalances} onClick={continueFromFunding}>
              Next
            </button>
          </div>
          <p className="inline-status"><Info size={15} /> {balanceStatus}</p>
        </section>
      ) : null}

      {!isReviewing && stage === "unlock" ? (
        <section className="panel sui-focus-card">
          <span className="eyebrow">Step 4 · Unlock locally</span>
          <h2>Unlock AgentWallet</h2>
          <p className="section-note">Enter the same password so the owner and agent can sign the launch transactions locally.</p>
          <PasswordField label="Wallet password" value={password} onChange={setPassword} />
          <button className="button" type="button" onClick={unlockWallets}>
            <KeyRound size={17} /> Unlock wallets
          </button>
          <p className="inline-status"><Info size={15} /> {walletStatus}</p>
        </section>
      ) : null}

      {!isReviewing && stage === "mandate" ? (
        <section className="panel sui-focus-card">
          <span className="eyebrow">Step 5 · Agent mandate</span>
          <h2>Tell the agent its limits</h2>
          <p className="section-note">AgentWallet automatically selects the verified DEEP/SUI pool and translates this instruction into a Move policy.</p>
          <EditableField label="Instruction to agent" value={mandate} onChange={setMandate} help="Examples: max 0.5 SUI, DeepBook only, expires 5m · expires 24h" />
          <div className="setup-grid">
            <SuiSummaryCard label="Budget" value={parsedMandate.budgetLabel} />
            <SuiSummaryCard label="Protocol" value={`${parsedMandate.allowedProtocol} only`} />
            <SuiSummaryCard label="Expires" value={parsedMandate.durationLabel} />
          </div>
          <button className="button" type="button" onClick={applyMandate}>
            <Bot size={17} /> Review mandate
          </button>
        </section>
      ) : null}

      {!isReviewing && stage === "launch" ? (
        <section className="panel sui-focus-card">
          <span className="eyebrow">Step 6 · Owner confirmation</span>
          <h2>Approve and launch agent</h2>
          <div className="setup-grid">
            <SuiSummaryCard label="Maximum budget" value={parsedMandate.budgetLabel} />
            <SuiSummaryCard label="Vault deposit" value={parsedMandate.budgetLabel} />
            <SuiSummaryCard label="Allowed venue" value="DeepBook · DEEP/SUI" />
            <SuiSummaryCard label="Policy duration" value={parsedMandate.durationLabel} />
          </div>
          <p className="section-note">
            Launch requires approximately {formatSuiBalance(launchReadiness.requiredOwnerBalance)} SUI in the owner wallet
            to deposit the full mandate budget plus gas, and {formatSuiBalance(launchReadiness.requiredAgentBalance)} SUI in the agent
            wallet for gas.
          </p>
          <button className="button" type="button" disabled={isRunning} onClick={runProof}>
            <PlayCircle size={17} /> {isRunning ? "Launching agent..." : "Approve and launch agent"}
          </button>
          <SuiProgress entries={progress} />
          <p className="inline-status"><Info size={15} /> {actionStatus}</p>
        </section>
      ) : null}

      {!isReviewing && isLive ? (
        <>
          <section className="panel">
            <div className="section-header">
              <div><span className="eyebrow">Agent console</span><h2>{expiryState.expired ? "Policy expired" : "Autonomous policy active"}</h2></div>
              <button className="button secondary" type="button" disabled={expiryState.expired} onClick={revoke}><X size={17} /> Revoke agent access</button>
            </div>
            <div className="setup-grid">
              <SuiSummaryCard
                label="Budget used"
                value={`${formatSuiTokenAmount(budgetMetrics.usedBudget, config.tokenTypeLabel)} / ${formatSuiTokenAmount(budgetMetrics.maxBudget, config.tokenTypeLabel)}`}
              />
              <SuiSummaryCard
                label="Remaining budget"
                value={formatSuiTokenAmount(budgetMetrics.remainingBudget, config.tokenTypeLabel)}
              />
              <SuiSummaryCard
                label="Budget ceiling"
                value={formatSuiTokenAmount(budgetMetrics.maxBudget, config.tokenTypeLabel)}
              />
              <SuiSummaryCard label="Policy status" value={expiryState.label} />
              <SuiSummaryCard label="Market" value="DeepBook · DEEP/SUI" />
              <SuiSummaryCard label="Latest action" value={progress.at(-1) ?? "Waiting"} />
            </div>
            <div className="sui-agent-command-console">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Rule-based agent action</span>
                  <h2>Command the agent wallet</h2>
                </div>
                <span className={`registry-status ${expiryState.expired ? "paused" : "initialized"}`}>
                  {expiryState.expired ? "Expired · actions blocked" : "Move policy enforced"}
                </span>
              </div>
              <div className="chat-messages" aria-live="polite">
                {agentMessages.map((message) => (
                  <div className={`chat-message ${message.role}`} key={message.id}>
                    <span>{message.role === "owner" ? "Owner" : "Sui agent"}</span>
                    <p>{message.content}</p>
                    {message.explorerUrl ? (
                      <a className="explorer-link" href={message.explorerUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={15} /> View transaction
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
              <EditableField
                label="Agent command"
                value={agentCommand}
                onChange={setAgentCommand}
                help="Rule-based examples: market buy 0.1 SUI of DEEP · limit buy 0.1 SUI of DEEP · show budget · test over budget"
              />
              <div className="button-row">
                <button className="button" type="button" disabled={isAgentExecuting || !agentCommand.trim()} onClick={submitAgentCommand}>
                  <Bot size={17} /> {isAgentExecuting ? "Agent executing..." : "Run agent action"}
                </button>
                {["market buy 0.1 SUI of DEEP", "limit buy 0.1 SUI of DEEP", "show budget", "test over budget"].map((example) => (
                  <button className="button secondary small" type="button" key={example} onClick={() => setAgentCommand(example)}>
                    {example}
                  </button>
                ))}
              </div>
            </div>
            <SuiProgress entries={progress} />
            <p className="inline-status"><Info size={15} /> {actionStatus}</p>
            {explorerUrl ? <a className="explorer-link" href={explorerUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> View latest transaction</a> : null}
          </section>
          <section className="panel">
            <div className="section-header">
              <div><span className="eyebrow">DeepBook</span><h2>Agent orders</h2></div>
              <button className="button secondary small" type="button" disabled={isFetchingDeepBookOrders} onClick={fetchDeepBookOrders}>
                <Activity size={15} /> {isFetchingDeepBookOrders ? "Refreshing..." : "Refresh orders"}
              </button>
            </div>
            <p className="inline-status"><Info size={15} /> {deepBookOrderStatus}</p>
            <SuiDeepBookOrders orders={deepBookOrders} />
          </section>
          <section className="panel">
            <div className="section-header">
              <div><span className="eyebrow">On-chain activity</span><h2>Agent activity</h2></div>
              <button className="button secondary small" type="button" disabled={isFetchingActivity} onClick={fetchActivity}><Activity size={15} /> Refresh</button>
            </div>
            <p className="inline-status"><Info size={15} /> {activityStatus}</p>
            <SuiActivityLog events={activityEvents} />
          </section>
        </>
      ) : null}

      <details className="panel sui-technical-details">
        <summary>Technical details</summary>
        <p className="section-note">Object IDs and advanced controls for judges and debugging.</p>
        <div className="policy-form">
          <EditableField label="Sui package ID" value={config.packageId} onChange={(value) => updateConfig("packageId", value)} />
          <EditableField label="Policy object ID" value={config.policyId} onChange={(value) => updateConfig("policyId", value)} />
          <EditableField label="Vault object ID" value={config.vaultId} onChange={(value) => updateConfig("vaultId", value)} />
          <EditableField label="Balance manager ID" value={config.balanceManagerId} onChange={(value) => updateConfig("balanceManagerId", value)} />
        </div>
        {unlockedWallets ? (
          <div className="setup-grid">
            <CopyField value={unlockedWallets.owner.privateKey} label="Copy owner private key" />
            <CopyField value={unlockedWallets.agent.privateKey} label="Copy agent private key" />
          </div>
        ) : null}
      </details>
    </section>
  );
}

function SuiStepReview({
  stage,
  encryptedWallets,
  ownerBalance,
  agentBalance,
  parsedMandate,
  progress,
  config,
  onReturn
}: {
  stage: SuiLaunchStage;
  encryptedWallets: EncryptedSuiLocalWalletBundle | null;
  ownerBalance: string;
  agentBalance: string;
  parsedMandate: ReturnType<typeof parseSuiAgentMandate>;
  progress: string[];
  config: SuiDashboardConfig;
  onReturn: () => void;
}) {
  const titles: Record<SuiLaunchStage, string> = {
    password: "Wallet security configured",
    wallets: "Owner and agent wallets created",
    fund: "Wallet funding readiness",
    unlock: "Local signing access unlocked",
    mandate: "Owner mandate",
    launch: "Approved launch configuration",
    console: "Live autonomous proof"
  };

  return (
    <section className="panel sui-focus-card sui-review-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Read-only step review</span>
          <h2>{titles[stage]}</h2>
        </div>
        <button className="button secondary small" type="button" onClick={onReturn}>Return to current step</button>
      </div>

      {stage === "password" ? <p className="section-note">A local encryption password was configured. AgentWallet never displays or stores the password itself.</p> : null}
      {stage === "wallets" && encryptedWallets ? (
        <div className="setup-grid">
          <SuiSummaryCard label="Owner wallet" value={shortAddress(encryptedWallets.ownerAddress)} />
          <SuiSummaryCard label="Agent wallet" value={shortAddress(encryptedWallets.agentAddress)} />
        </div>
      ) : null}
      {stage === "fund" ? (
        <div className="setup-grid">
          <SuiSummaryCard label="Owner balance" value={`${formatSuiBalance(ownerBalance)} SUI`} />
          <SuiSummaryCard label="Agent balance" value={`${formatSuiBalance(agentBalance)} SUI`} />
        </div>
      ) : null}
      {stage === "unlock" ? <p className="section-note">Both encrypted wallets were unlocked locally for signing. Private keys remain hidden in this review.</p> : null}
      {stage === "mandate" || stage === "launch" ? (
        <div className="setup-grid">
          <SuiSummaryCard label="Maximum budget" value={parsedMandate.budgetLabel} />
          <SuiSummaryCard label="Allowed venue" value="DeepBook · DEEP/SUI" />
          <SuiSummaryCard label="Policy duration" value={parsedMandate.durationLabel} />
        </div>
      ) : null}
      {stage === "launch" ? (
        <div className="setup-grid">
          <SuiSummaryCard label="Policy object" value={config.policyId ? shortAddress(config.policyId) : "Created during launch"} />
          <SuiSummaryCard label="Agent vault" value={config.vaultId ? shortAddress(config.vaultId) : "Created during launch"} />
          <SuiSummaryCard label="DeepBook manager" value={config.balanceManagerId ? shortAddress(config.balanceManagerId) : "Created during launch"} />
        </div>
      ) : null}
      {stage === "console" ? <SuiProgress entries={progress} /> : null}
      <p className="inline-status"><Info size={15} /> Review mode cannot rerun or modify this step.</p>
    </section>
  );
}

function SuiSummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="devnet-card"><span className="eyebrow">{label}</span><strong>{value}</strong></div>;
}

function SuiWalletReadinessCard({ label, address, balance, requiredBalance }: { label: string; address: string; balance: string; requiredBalance: string }) {
  const funded = BigInt(balance || "0") >= BigInt(requiredBalance || "0");
  return (
    <div className="devnet-card">
      <span className="eyebrow">{label}</span>
      <strong>{formatSuiBalance(balance)} SUI · {funded ? "Ready" : "Needs funding"}</strong>
      <p>Required: at least {formatSuiBalance(requiredBalance)} SUI.</p>
      <CopyField value={address} label={`Copy ${label} address`} />
    </div>
  );
}

function SuiProgress({ entries }: { entries: string[] }) {
  if (!entries.length) return null;
  return <div className="audit-list sui-progress-list">{entries.map((entry, index) => <div className="audit-item" key={`${entry}-${index}`}><CheckCircle2 size={16} /><span>{entry}</span></div>)}</div>;
}

function formatSuiBalance(balance: string) {
  return (Number(balance || "0") / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function SuiOverflowPanel({
  config,
  activityEvents,
  onFetchActivity,
  isFetchingActivity
}: {
  config: SuiDashboardConfig;
  activityEvents: SuiActivityEvent[];
  onFetchActivity: () => void;
  isFetchingActivity: boolean;
}) {
  const commands = buildSuiDashboardCommands(config);

  return (
    <section className="panel span-2">
      <div className="section-header">
        <div>
          <span className="eyebrow">Sui Overflow proof</span>
          <h2>Sui agent wallet path</h2>
        </div>
        <span className="registry-status pending">testnet manual mode</span>
      </div>
      <p className="section-note">
        This is the Sui implementation track: a Move policy object grants an agent a capped vault, limits the
        DeepBook scope, emits an activity trail, and can be revoked by the owner. Use these commands after
        installing the Sui CLI and filling in the object ids from testnet.
      </p>

      <div className="proof-grid" style={{ marginTop: 12 }}>
        {suiOverflowProofItems.map((item) => (
          <div className="proof-link" key={item.title}>
            <span className="eyebrow">{item.title}</span>
            <strong>{item.detail}</strong>
          </div>
        ))}
      </div>

      <div className="setup-grid" style={{ marginTop: 12 }}>
        <div className="devnet-card">
          <span className="eyebrow">Move objects</span>
          <strong>Policy, vault, and revocation are on-chain</strong>
          <p>
            The dashboard stays Solana-first for production, but the Sui package is ready for Overflow demos
            where judges need to see Move policy objects and owner revocation.
          </p>
        </div>
        <div className="devnet-card">
          <span className="eyebrow">DeepBook path</span>
          <strong>Budgeted order plan</strong>
          <p>
            The agent takes a capped coin from the vault, places a DeepBook limit order, then returns any
            remaining balance through the policy-controlled flow.
          </p>
        </div>
        <div className="devnet-card">
          <span className="eyebrow">Activity events</span>
          <strong>On-chain log parser</strong>
          <p>{suiActivityEventLabels.join(", ")}</p>
        </div>
      </div>

      <div className="setup-grid sui-command-grid" style={{ marginTop: 12 }}>
        {commands.map((command) => (
          <SuiCommandCard command={command} key={command.id} />
        ))}
      </div>

      <div className="section-header" style={{ marginTop: 24 }}>
        <div>
          <span className="eyebrow">Sui on-chain activity</span>
          <h2>Event log</h2>
        </div>
        <button className="button secondary small" type="button" disabled={isFetchingActivity} onClick={() => onFetchActivity()}>
          <Activity size={15} /> Refresh
        </button>
      </div>
      <SuiActivityLog events={activityEvents} />
    </section>
  );
}

function SuiActivityLog({ events }: { events: SuiActivityEvent[] }) {
  if (!events.length) {
    return (
      <div className="log-list">
        <div className="log-list-row">
          <div className="log-list-main">
            <strong>No Sui events loaded yet.</strong>
            <p>Fetch activity after publishing the package and running policy/vault/DeepBook actions.</p>
          </div>
          <span className="decision-pill">waiting</span>
        </div>
      </div>
    );
  }

  return (
    <div className="log-list" role="list">
      {events.map((event) => (
        <div className="log-list-row audit-log-row" key={event.id} role="listitem">
          <div className="log-list-time">
            <span>{formatAuditDateFromMs(event.timestampMs)}</span>
          </div>
          <div className="log-list-main">
            <strong>{event.type}</strong>
            <p>{event.summary}</p>
            {event.digest ? (
              <a
                className="explorer-link"
                href={`https://suiexplorer.com/txblock/${event.digest}?network=testnet`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} /> View Sui transaction
              </a>
            ) : null}
          </div>
          <span className="decision-pill sim-passed">on-chain</span>
        </div>
      ))}
    </div>
  );
}

function SuiDeepBookOrders({ orders }: { orders: SuiDeepBookOrder[] }) {
  if (!orders.length) {
    return (
      <div className="log-list">
        <div className="log-list-row">
          <div className="log-list-main">
            <strong>No DeepBook orders loaded yet.</strong>
            <p>Run the autonomous strategy or refresh after a confirmed DeepBook transaction.</p>
          </div>
          <span className="decision-pill">waiting</span>
        </div>
      </div>
    );
  }

  return (
    <div className="log-list" role="list">
      {orders.map((order) => (
        <div className="log-list-row audit-log-row" key={order.orderId} role="listitem">
          <div className="log-list-time">
            <span>{formatAuditDateFromMs(order.timestampMs)}</span>
          </div>
          <div className="log-list-main">
            <strong>{order.market} · {order.side === "buy" ? "Buy DEEP" : "Sell DEEP"}</strong>
            <p>Order {order.orderId} · quantity {order.quantity} · price {order.price}</p>
            {order.digest ? (
              <a
                className="explorer-link"
                href={`https://suiexplorer.com/txblock/${order.digest}?network=testnet`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} /> View DeepBook transaction
              </a>
            ) : null}
          </div>
          <span className={`decision-pill ${order.status === "filled" ? "sim-passed" : ""}`}>{order.status}</span>
        </div>
      ))}
    </div>
  );
}

function SuiCommandCard({ command }: { command: ReturnType<typeof buildSuiDashboardCommands>[number] }) {
  return (
    <div className="devnet-card sui-command-card">
      <span className="eyebrow">{command.eyebrow}</span>
      <strong>{command.title}</strong>
      <p>{command.description}</p>
      <pre className="code-panel">{command.command}</pre>
      <CopyField value={command.command} label={`Copy ${command.title} command`} />
    </div>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  return (
    <div className="copy-field">
      <input readOnly value={value} aria-label={label} onFocus={(event) => event.currentTarget.select()} />
      <button
        className="icon-button"
        type="button"
        aria-label={label}
        title={label}
        onClick={() => void navigator.clipboard?.writeText(value)}
      >
        <Copy size={15} />
      </button>
    </div>
  );
}

function TelegramLinkStatus({ text }: { text: string }) {
  const marker = "Open @agentspendbot";
  const [before, after] = text.split(marker);

  if (after === undefined) {
    return <p>{text}</p>;
  }

  return (
    <p>
      {before}
      <a className="explorer-link inline-link" href="https://t.me/agentspendbot" target="_blank" rel="noreferrer">
        {marker}
      </a>
      {after}
    </p>
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

function ApprovalToast({
  approval,
  onApprove,
  onReject,
  onDismiss
}: {
  approval: AgentApproval;
  onApprove: (approval: AgentApproval) => void;
  onReject: (approval: AgentApproval) => void;
  onDismiss: (approvalId: string) => void;
}) {
  return (
    <aside className="approval-toast" role="status" aria-live="polite">
      <button
        className="icon-button ghost approval-toast-close"
        type="button"
        aria-label="Dismiss approval notification"
        onClick={() => onDismiss(approval.id)}
      >
        <X size={15} />
      </button>
      <span className="eyebrow">Owner approval needed</span>
      <strong>{approval.amount} token payment</strong>
      <p>
        Agent wants to pay {shortAddress(approval.recipient)}. Approve to execute
        automatically, or reject the request.
      </p>
      <div className="button-row compact">
        <button className="button small" type="button" onClick={() => onApprove(approval)}>
          <ShieldCheck size={15} /> Approve
        </button>
        <button className="button secondary small" type="button" onClick={() => onReject(approval)}>
          <X size={15} /> Reject
        </button>
      </div>
    </aside>
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
      <div className="log-list" role="list">
        {findings.map((finding) => (
          <div className="log-list-row" key={finding.id} role="listitem">
            <div className="log-list-main">
              <strong>{finding.title}</strong>
              <p>{finding.detail}</p>
            </div>
            <span className={`decision-pill sim-${finding.status}`}>{finding.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AuditTimeline({ events }: { events: SpendEvent[] }) {
  return (
    <div className="log-list" role="list">
      {events.map((event) => (
        <div className="log-list-row audit-log-row" key={event.id} role="listitem">
          <div className="log-list-time">
            <span>{formatAuditDate(event.createdAt)}</span>
          </div>
          <div className="log-list-main">
            <strong>{event.vendorName}</strong>
            <p>
              {event.amountUsd > 0 ? `$${event.amountUsd} for ` : ""}
              {event.category}. {event.reasons.join(" ")}
            </p>
          </div>
          <DecisionIcon decision={event.decision} />
        </div>
      ))}
    </div>
  );
}

function formatAuditDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Now";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatAuditDateFromMs(value: string | null) {
  if (!value) {
    return "No time";
  }

  const date = new Date(Number(value));

  if (Number.isNaN(date.getTime())) {
    return "No time";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function AgentWalletMark() {
  return (
    <svg width="21" height="21" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M17 21H20.5V18.5H27.5V21H29.5V14.5H34.5V21H36.5V14.5H41.5V21H48V43H45.5V46H18.5V43H16V21H17Z" fill="#7B8188" />
      <path d="M19.5 26.5H44.5V40.5H19.5V26.5Z" fill="#111315" />
      <path d="M24 23H27V26H24V23Z" fill="#111315" />
      <path d="M30 23H33V26H30V23Z" fill="#111315" />
      <path d="M36 23H39V26H36V23Z" fill="#111315" />
      <path d="M26.5 31H30V38H26.5V31Z" fill="#E4E6E9" />
      <path d="M36.5 31H40V38H36.5V31Z" fill="#E4E6E9" />
      <path d="M8.5 32H12.5V29H16V34.5H12.5V38H8.5V32Z" fill="#5A5E66" />
      <path d="M55.5 32H51.5V29H48V34.5H51.5V38H55.5V32Z" fill="#5A5E66" />
      <path d="M24 49H30.5V52H24V49Z" fill="#5A5E66" />
      <path d="M37 49H43.5V52H37V49Z" fill="#5A5E66" />
      <path d="M17 21H20.5V18.5H27.5V21H29.5V14.5H34.5V21H36.5V14.5H41.5V21H48V43H45.5V46H18.5V43H16V21H17Z" stroke="#B8C4CC" strokeOpacity="0.22" strokeWidth="1" />
    </svg>
  );
}

function auditEventToSpendEvent(event: AgentWalletAuditEvent): SpendEvent {
  return {
    id: event.id,
    policyId: "agentwallet",
    paymentId: event.type,
    decision: event.status === "rejected" ? "denied" : "approved",
    amountUsd: 0,
    vendorName: event.type.replaceAll("_", " "),
    category: "agentwallet",
    createdAt: event.createdAt,
    reasons: [
      event.message,
      event.signature ? `Signature: ${event.signature}.` : ""
    ].filter(Boolean)
  };
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

function PasswordField({
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
      <input
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
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
        {options.length ? (
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
        ) : null}
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
        {options.length ? (
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
        ) : null}
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}

function TokenCatalogField({
  label,
  items,
  activeValue,
  onActiveChange,
  onChange,
  help,
  className
}: {
  label: string;
  items: CatalogItem[];
  activeValue: string;
  onActiveChange: (value: string) => void;
  onChange: Dispatch<SetStateAction<CatalogItem[]>>;
  help?: string;
  className?: string;
}) {
  const [draftLabel, setDraftLabel] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const selectedItems = items.filter((item) => item.selected);

  function addToken() {
    const value = draftValue.trim();
    const nextLabel = draftLabel.trim() || labelForTokenMint(value);

    if (!value) {
      return;
    }

    onChange((current) => addCatalogItem(current, nextLabel, value, true));
    onActiveChange(value);
    setDraftLabel("");
    setDraftValue("");
  }

  function toggleToken(item: CatalogItem, selected: boolean) {
    const remainingSelected = items.filter(
      (candidate) => candidate.id !== item.id && candidate.selected
    );

    onChange((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, selected } : candidate
      )
    );

    if (selected) {
      onActiveChange(item.value);
      return;
    }

    if (activeValue === item.value) {
      onActiveChange(remainingSelected[0]?.value ?? "");
    }
  }

  return (
    <div className={`field checklist-field ${className ?? ""}`}>
      <FieldLabel label={label} help={help} />
      <div className="catalog-add-row">
        <input
          value={draftLabel}
          placeholder="Token name"
          onChange={(event) => setDraftLabel(event.target.value)}
        />
        <input
          value={draftValue}
          placeholder="SPL token mint / contract address"
          onChange={(event) => setDraftValue(event.target.value)}
        />
        <button className="icon-button" type="button" aria-label={`Add ${label}`} onClick={addToken}>
          <Plus size={16} />
        </button>
      </div>
      <div className="checklist-card token-checklist">
        {items.length ? (
          items.map((item) => (
            <label className="checklist-item" key={item.id}>
              <input
                type="checkbox"
                checked={item.selected}
                onChange={(event) => toggleToken(item, event.target.checked)}
              />
              <span>
                <strong>{item.label}</strong>
                <small>{item.value}</small>
              </span>
              <button
                className="icon-button ghost"
                type="button"
                aria-label={`Remove ${item.label}`}
                disabled={item.value === defaultDevnetUsdcMint}
                title={
                  item.value === defaultDevnetUsdcMint
                    ? "The AgentWallet devnet test token stays available for demos."
                    : `Remove ${item.label}`
                }
                onClick={(event) => {
                  event.preventDefault();
                  const nextSelected = items.filter(
                    (candidate) => candidate.id !== item.id && candidate.selected
                  );
                  onChange((current) =>
                    current.filter((candidate) => candidate.id !== item.id)
                  );
                  if (activeValue === item.value) {
                    onActiveChange(nextSelected[0]?.value ?? "");
                  }
                }}
              >
                <X size={15} />
              </button>
            </label>
          ))
        ) : (
          <p className="empty-note">No tokens saved yet. Add a devnet SPL token mint above.</p>
        )}
      </div>
      <div className="token-active-row">
        <FieldLabel
          label="Default token for tests"
          help="All checked token mints are allowlisted on-chain. This selected token is only the default used by simple dashboard tests, Telegram, and SDK snippets."
        />
        <select
          value={activeValue}
          disabled={!selectedItems.length}
          onChange={(event) => onActiveChange(event.target.value)}
        >
          {!selectedItems.length ? <option value="">No token selected</option> : null}
          {selectedItems.map((item) => (
            <option key={item.id} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
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

function labelForTokenMint(tokenMint: string): string {
  return tokenMint === defaultDevnetUsdcMint
    ? "AgentWallet devnet test token"
    : shortAddress(tokenMint);
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

function parseCatalogItems(value: string | null, fallback: CatalogItem[]): CatalogItem[] | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as CatalogItem[];

    if (!Array.isArray(parsed)) {
      return null;
    }

    const items = parsed
      .filter(
        (item) =>
          typeof item.id === "string" &&
          typeof item.label === "string" &&
          typeof item.value === "string" &&
          typeof item.selected === "boolean"
      )
      .map((item) => ({
        ...item,
        label: item.label.trim() || labelForTokenMint(item.value),
        value: item.value.trim()
      }))
      .filter((item) => item.value);

    const withFallbacks = fallback.reduce(
      (current, item) =>
        current.some((candidate) => candidate.value === item.value)
          ? current
          : [...current, item],
      items
    );

    return withFallbacks.length ? withFallbacks : fallback;
  } catch {
    return null;
  }
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

function suiDemoStepLabel(action: SuiDashboardActionId) {
  const labels: Record<SuiDashboardActionId, string> = {
    "create-policy": "Owner policy creation",
    "create-vault": "Agent vault creation",
    "fund-vault": "Vault funding",
    "create-balance-manager": "Agent DeepBook manager creation",
    "run-deepbook-strategy": "Agent DeepBook strategy",
    "revoke-policy": "Owner policy revocation"
  };

  return labels[action];
}

async function readJsonResponse<T = unknown>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with ${response.status}.`);
  }

  return payload;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatUsdMetric(value: number) {
  return value > 0 ? `$${value}` : "Not set";
}
