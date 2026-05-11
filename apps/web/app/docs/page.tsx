import Link from "next/link";

const liveBaseUrl = "https://agentspend-eight.vercel.app";

export default function DocsPage() {
  return (
    <main className="docs-page">
      <header className="docs-hero">
        <Link className="explorer-link" href="/">
          AgentWallet
        </Link>
        <p className="eyebrow">Agent integration docs</p>
        <h1>Give any AI agent a policy-enforced Solana wallet.</h1>
        <p>
          AgentWallet hosts the agent wallet, keeps the signing key encrypted,
          and exposes a small SDK/API. Your agent sends payment intents;
          AgentWallet settles only if the owner policy allows it.
        </p>
        <div className="landing-actions">
          <Link className="button" href="/app">
            Open dashboard
          </Link>
          <a className="button secondary" href="#sdk">
            SDK quickstart
          </a>
        </div>
      </header>

      <section className="docs-grid">
        <article className="panel">
          <span className="eyebrow">01</span>
          <h2>Owner setup</h2>
          <ol className="docs-list">
            <li>Connect Phantom on devnet and sign in.</li>
            <li>Create a hosted agent wallet and copy the API key once.</li>
            <li>Fund the hosted agent with devnet SOL and test tokens.</li>
            <li>Configure recipients, limits, token mint, and publish policy on-chain.</li>
          </ol>
        </article>

        <article className="panel">
          <span className="eyebrow">02</span>
          <h2>Agent runtime</h2>
          <p>
            The agent never receives the private key. It only receives an
            AgentWallet API key. Every call is checked against the policy PDA
            before tokens move on Solana devnet.
          </p>
        </article>
      </section>

      <section className="panel docs-section" id="sdk">
        <span className="eyebrow">SDK quickstart</span>
        <h2>Use from a Node or TypeScript agent</h2>
        <pre className="code-panel">{`import { AgentWallet } from "@agentwallet/sdk";

const wallet = new AgentWallet({
  baseUrl: "${liveBaseUrl}",
  apiKey: process.env.AGENTWALLET_API_KEY!
});

const me = await wallet.getAgent();
if (!me.status.readyForPayments) {
  throw new Error("AgentWallet setup incomplete: " + me.status.missing.join(", "));
}

const payment = await wallet.pay({
  recipient: "6tNgWp8rq4UJ77q2cZ8WPeBn5eUDhcSuC5nSEXd1W8yA",
  amount: "1"
});

console.log(payment.explorerUrl);`}</pre>
      </section>

      <section className="panel docs-section">
        <span className="eyebrow">REST API</span>
        <h2>Use from any agent framework</h2>
        <pre className="code-panel">{`GET /api/agent-wallet/me
Authorization: Bearer <agent-api-key>

POST /api/agent-wallet/pay
Authorization: Bearer <agent-api-key>
Content-Type: application/json

{
  "recipient": "6tNgWp8rq4UJ77q2cZ8WPeBn5eUDhcSuC5nSEXd1W8yA",
  "amount": "1"
}`}</pre>
        <p className="section-note">
          The server uses the stored program ID, policy PDA, token mint, and decimals
          from the hosted agent record. Override fields only when you are building
          an advanced integration and still expect the on-chain policy to enforce them.
        </p>
      </section>

      <section className="panel docs-section">
        <span className="eyebrow">x402 flow</span>
        <h2>Pay APIs without API keys</h2>
        <pre className="code-panel">{`const response = await wallet.fetch("https://merchant.example/resource");

// If the merchant returns 402 + PAYMENT-REQUIRED,
// AgentWallet pays through policy and retries with PAYMENT-SIGNATURE.
console.log(await response.json());`}</pre>
      </section>
    </main>
  );
}
