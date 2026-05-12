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
