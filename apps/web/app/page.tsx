import Link from "next/link";

export default function Home() {
  return (
    <main className="landing-page">
      <section className="landing-hero" aria-label="AgentWallet landing page">
        <div className="landing-copy">
          <div className="landing-logo">
            <div className="logo-mark" aria-hidden="true">
              <AgentWalletMark />
            </div>
            <div>
              <div className="logo-name">AgentWallet</div>
              <div className="logo-sub">agent-native · policy-enforced</div>
            </div>
          </div>

          <p className="landing-kicker">Brex/Ramp for AI agents on Solana</p>

          <h1>
            The wallet that
            <br />
            <span>thinks before it spends.</span>
          </h1>

          <p className="landing-subtitle">
            Create hosted Solana wallets for AI agents, set owner-controlled spend
            policies, and let agents pay through SDK, API, Telegram, or x402-style flows.
          </p>

          <div className="landing-actions">
            <Link className="button landing-primary" href="/app">
              Deploy policy <span aria-hidden="true">→</span>
            </Link>
            <Link className="button secondary" href="/docs">
              Read the docs
            </Link>
            <Link className="button ghost" href="/app">
              View demo
            </Link>
          </div>
        </div>

        <div className="landing-product" aria-label="AgentWallet product preview">
          <div className="wallet-preview-card">
            <div className="preview-topline">
              <span>Hosted agent wallet</span>
              <strong>active</strong>
            </div>
            <div className="preview-wallet">
              <div>
                <span>Research agent</span>
                <strong>FoJQ...y6dN</strong>
              </div>
              <div>
                <span>Policy PDA</span>
                <strong>Ha8r...LaqD</strong>
              </div>
            </div>
            <div className="preview-policy-grid">
              <PreviewStat label="Daily budget" value="$40" />
              <PreviewStat label="Per payment" value="$5" />
              <PreviewStat label="Recipients" value="3" />
              <PreviewStat label="Violations" value="0" />
            </div>
            <div className="preview-command">
              <span>Agent command</span>
              <p>send 1 token to 6tNg...W8yA</p>
            </div>
            <div className="preview-ledger">
              <div>
                <span className="dot ok" />
                <p>Approved by policy. Sent on Solana devnet.</p>
              </div>
              <div>
                <span className="dot err" />
                <p>Rejected: recipient not on the allowed list.</p>
              </div>
              <div>
                <span className="dot info" />
                <p>SDK, API, Telegram, and x402 all route through policy.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-support" id="product" aria-label="AgentWallet product summary">
        <div className="landing-card">
          <span>01</span>
          <h2>Hosted agent wallets</h2>
          <p>Create a Solana devnet wallet and API key for each AI agent. Keys stay encrypted server-side.</p>
        </div>
        <div className="landing-card">
          <span>02</span>
          <h2>Owner spend policy</h2>
          <p>Set caps, allowed recipients, token mint, and pause/resume controls before the agent can spend.</p>
        </div>
        <div className="landing-card">
          <span>03</span>
          <h2>On-chain enforcement</h2>
          <p>Payments go through the shared Anchor policy program before SPL tokens move.</p>
        </div>
        <div className="landing-card">
          <span>04</span>
          <h2>Agent SDK and API</h2>
          <p>Give your private AI agent a small SDK snippet or REST API key instead of a raw wallet secret.</p>
        </div>
        <div className="landing-card">
          <span>05</span>
          <h2>Telegram interface</h2>
          <p>Link @agentspendbot to a hosted wallet and test real policy-gated commands in chat.</p>
        </div>
        <div className="landing-card">
          <span>06</span>
          <h2>x402-ready payments</h2>
          <p>Agents can pay API-style resources using HTTP 402 challenges backed by Solana settlement.</p>
        </div>
      </section>

      <section className="landing-flow" aria-label="AgentWallet workflow">
        <div>
          <span className="eyebrow">How it works</span>
          <h2>Owners issue controlled wallets. Agents request spend.</h2>
        </div>
        <div className="landing-flow-steps">
          <div>Connect owner wallet</div>
          <div>Create hosted agent</div>
          <div>Publish policy on-chain</div>
          <div>Agent pays through SDK/API</div>
          <div>Audit every result</div>
        </div>
      </section>
    </main>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AgentWalletMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="3" fill="#B8C4CC" opacity="0.9" />
      <circle cx="8" cy="8" r="6.5" stroke="#B8C4CC" strokeWidth="0.8" strokeOpacity="0.3" />
      <line x1="8" y1="1.5" x2="8" y2="4.5" stroke="#B8C4CC" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.5" />
      <line x1="8" y1="11.5" x2="8" y2="14.5" stroke="#B8C4CC" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.5" />
      <line x1="1.5" y1="8" x2="4.5" y2="8" stroke="#B8C4CC" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.5" />
      <line x1="11.5" y1="8" x2="14.5" y2="8" stroke="#B8C4CC" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.5" />
    </svg>
  );
}
