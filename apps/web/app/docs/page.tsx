import Link from "next/link";

const liveBaseUrl = "https://agentwallet-web.vercel.app";
const exampleRecipient = "6tNgWp8rq4UJ77q2cZ8WPeBn5eUDhcSuC5nSEXd1W8yA";

export default function DocsPage() {
  return (
    <main className="docs-page">
      <header className="docs-hero">
        <Link className="explorer-link" href="/">
          AgentWallet
        </Link>
        <p className="eyebrow">Agent integration docs</p>
        <h1>Give your AI agent a policy-enforced Solana wallet.</h1>
        <p>
          AgentWallet creates hosted devnet wallets for autonomous agents, keeps
          signing keys encrypted, and exposes SDK/API access that can only spend
          through owner-defined on-chain policy.
        </p>
        <div className="landing-actions">
          <Link className="button" href="/app">
            Open dashboard
          </Link>
          <a className="button secondary" href="#handoff">
            Agent handoff
          </a>
          <a className="button secondary" href="#sdk">
            SDK quickstart
          </a>
          <a className="button secondary" href="/api/openapi.json">
            OpenAPI JSON
          </a>
        </div>
      </header>

      <section className="docs-grid">
        <article className="panel">
          <span className="eyebrow">01</span>
          <h2>Owner setup</h2>
          <ol className="docs-list">
            <li>Connect Phantom on devnet and sign in.</li>
            <li>Set the owner recovery password before creating hosted wallets.</li>
            <li>Create a hosted agent wallet and copy the one-time API key.</li>
            <li>Fund the hosted wallet with devnet SOL and allowed test tokens.</li>
            <li>Choose allowed recipients, token mints, caps, and approval rules.</li>
            <li>Initialize or update the policy account on Solana devnet.</li>
          </ol>
        </article>

        <article className="panel">
          <span className="eyebrow">02</span>
          <h2>Agent runtime</h2>
          <p>
            The agent receives an AgentWallet API key, not the private key. It
            can request payments through the SDK, REST API, Telegram, or future
            agent frameworks. AgentWallet signs only after the policy program
            allows the payment or the owner approves it.
          </p>
        </article>
      </section>

      <section className="panel docs-section" id="handoff">
        <span className="eyebrow">Handoff checklist</span>
        <h2>What to give your AI agent</h2>
        <p className="section-note">
          After selecting a hosted agent in the dashboard, copy the generated
          handoff card. The minimum secret your agent needs is the API key.
        </p>
        <div className="docs-grid">
          <article className="event">
            <header>
              <strong>1. Environment secret</strong>
            </header>
            <pre className="code-panel">{`AGENTWALLET_API_KEY=<copy-from-dashboard>`}</pre>
          </article>
          <article className="event">
            <header>
              <strong>2. Base URL</strong>
            </header>
            <pre className="code-panel">{`AGENTWALLET_BASE_URL=${liveBaseUrl}`}</pre>
          </article>
        </div>
        <p className="section-note">
          Once the agent has those values, policy changes do not require a new
          SDK snippet. Update policy in AgentWallet; the next agent payment uses
          the latest on-chain policy account.
        </p>
      </section>

      <section className="panel docs-section" id="sdk">
        <span className="eyebrow">SDK quickstart</span>
        <h2>Use from a Node or TypeScript agent</h2>
        <pre className="code-panel">{`import { AgentWallet } from "@agentwallet/sdk";

const wallet = new AgentWallet({
  baseUrl: process.env.AGENTWALLET_BASE_URL ?? "${liveBaseUrl}",
  apiKey: process.env.AGENTWALLET_API_KEY!
});

const me = await wallet.getAgent();
console.log("Agent wallet:", me.agent.publicKey);
console.log("Ready:", me.status.readyForPayments);

const capabilities = await wallet.getCapabilities();
console.log("Allowed recipients:", capabilities.allowed.recipients);
console.log("Remaining budget:", capabilities.spend.remainingBudgetUnits);

const payment = await wallet.pay({
  recipient: "${exampleRecipient}",
  amount: "1"
});

console.log("Explorer:", payment.explorerUrl);`}</pre>
      </section>

      <section className="panel docs-section">
        <span className="eyebrow">Setup status</span>
        <h2>Let agents check readiness before spending</h2>
        <pre className="code-panel">{`curl "${liveBaseUrl}/api/agent-wallet/setup-status" \\
  -H "Authorization: Bearer $AGENTWALLET_API_KEY"

// Example response:
{
  "setup": {
    "ready": false,
    "missing": ["policy_pda"],
    "ownerActionRequired": true,
    "nextAction": "Ask the owner to initialize or update the on-chain policy for this hosted agent.",
    "availableActions": ["get_wallet_status", "get_audit_log"]
  }
}`}</pre>
      </section>

      <section className="panel docs-section">
        <span className="eyebrow">Capabilities</span>
        <h2>Let agents discover their exact boundaries</h2>
        <pre className="code-panel">{`curl "${liveBaseUrl}/api/agent-wallet/capabilities" \\
  -H "Authorization: Bearer $AGENTWALLET_API_KEY"

// Example response:
{
  "ok": true,
  "policy": {
    "status": "active",
    "pda": "<policy-pda>"
  },
  "allowed": {
    "recipients": ["${exampleRecipient}"],
    "tokenMints": ["<allowed-token-mint>"]
  },
  "spend": {
    "maxPerPaymentUnits": "3000000",
    "remainingBudgetUnits": "6000000",
    "approvalThresholdUnits": "2000000"
  },
  "supportedActions": ["simulate_payment", "request_payment", "get_audit_log"]
}`}</pre>
        <p className="section-note">
          Use capabilities before planning actions. It tells the agent what it
          controls, what it can pay, which tokens are allowed, and whether
          spending is currently paused.
        </p>
      </section>

      <section className="panel docs-section">
        <span className="eyebrow">REST API</span>
        <h2>Use from any agent framework</h2>
        <pre className="code-panel">{`curl "${liveBaseUrl}/api/agent-wallet/me" \\
  -H "Authorization: Bearer $AGENTWALLET_API_KEY"

curl "${liveBaseUrl}/api/agent-wallet/capabilities" \\
  -H "Authorization: Bearer $AGENTWALLET_API_KEY"

curl -X POST "${liveBaseUrl}/api/agent-wallet/simulate-payment" \\
  -H "Authorization: Bearer $AGENTWALLET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipient": "${exampleRecipient}",
    "amount": "5"
  }'

curl -X POST "${liveBaseUrl}/api/agent-wallet/pay" \\
  -H "Authorization: Bearer $AGENTWALLET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipient": "${exampleRecipient}",
    "amount": "1"
  }'`}</pre>
        <p className="section-note">
          The hosted agent record stores the program ID, policy PDA, token mint,
          and decimals. Advanced callers can send explicit fields, but the
          on-chain policy remains the final authority.
        </p>
      </section>

      <section className="panel docs-section">
        <span className="eyebrow">Payment simulation</span>
        <h2>Plan before moving tokens</h2>
        <pre className="code-panel">{`const preview = await wallet.simulatePayment({
  recipient: "${exampleRecipient}",
  amount: "5"
});

if (preview.decision === "approved") {
  await wallet.pay({ recipient: "${exampleRecipient}", amount: "5" });
}

if (preview.decision === "requires_approval") {
  console.log(preview.suggestedAction); // request_owner_approval
}`}</pre>
        <p className="section-note">
          Simulation reads the on-chain policy account and returns the same
          structured codes as a real payment attempt, without signing or sending
          a Solana transaction.
        </p>
      </section>

      <section className="panel docs-section">
        <span className="eyebrow">Structured errors</span>
        <h2>Handle rejections programmatically</h2>
        <pre className="code-panel">{`{
  "ok": false,
  "error": "Rejected: that recipient wallet is not on the allowed list.",
  "code": "RECIPIENT_NOT_ALLOWED",
  "message": "Recipient wallet is not on the allowed list.",
  "humanMessage": "That recipient wallet is not on the allowed list.",
  "agentMessage": "Choose an allowed recipient or ask the owner to update the policy.",
  "suggestedAction": "request_owner_policy_update"
}`}</pre>
        <p className="section-note">
          Agents should branch on `code` and `suggestedAction`, not free-form text.
        </p>
      </section>

      <section className="panel docs-section">
        <span className="eyebrow">Owner approvals</span>
        <h2>Above-threshold payments</h2>
        <p>
          If the agent requests a payment above the autonomous approval
          threshold, AgentWallet creates an approval request instead of moving
          tokens. The owner approves or rejects in the dashboard. Approved
          payments execute automatically with the hosted agent wallet.
        </p>
      </section>

      <section className="panel docs-section">
        <span className="eyebrow">x402 flow</span>
        <h2>Pay APIs without static API keys</h2>
        <pre className="code-panel">{`const response = await wallet.fetch("${liveBaseUrl}/api/demo-merchant/resource");

// The merchant can return 402 + PAYMENT-REQUIRED.
// AgentWallet settles through the policy engine, then retries with PAYMENT-SIGNATURE.
console.log(await response.json());`}</pre>
      </section>

      <section className="panel docs-section">
        <span className="eyebrow">Machine-readable API</span>
        <h2>Let tools discover AgentWallet</h2>
        <p>
          AgentWallet exposes an OpenAPI 3.1 document for agent frameworks,
          API clients, and tool-generation flows.
        </p>
        <pre className="code-panel">{`${liveBaseUrl}/api/openapi.json`}</pre>
      </section>

      <section className="panel docs-section">
        <span className="eyebrow">MCP server</span>
        <h2>Use AgentWallet as native agent tools</h2>
        <pre className="code-panel">{`{
  "mcpServers": {
    "agentwallet": {
      "command": "npx",
      "args": ["agentwallet-mcp"],
      "env": {
        "AGENTWALLET_BASE_URL": "${liveBaseUrl}",
        "AGENTWALLET_API_KEY": "<hosted-agent-api-key>"
      }
    }
  }
}`}</pre>
        <p className="section-note">
          The MCP server exposes tools for wallet status, capabilities, allowed
          recipients, allowed tokens, payment simulation, payment execution, and
          audit history.
        </p>
      </section>

      <section className="panel docs-section">
        <span className="eyebrow">Troubleshooting</span>
        <h2>Common setup misses</h2>
        <ul className="docs-list">
          <li>Invalid API key: rotate the selected hosted agent key and update the agent secret.</li>
          <li>Wallet not funded: send devnet SOL to the hosted wallet before minting or transferring tokens.</li>
          <li>Recipient rejected: add the recipient wallet to the policy and update the on-chain policy.</li>
          <li>Token rejected: add the token mint to the allowlist and fund the agent token account.</li>
          <li>Policy missing: initialize the selected agent policy account before calling the SDK.</li>
        </ul>
      </section>
    </main>
  );
}
