import Link from "next/link";

export default function Home() {
  return (
    <main className="landing-page">
      <section className="landing-hero" aria-label="AgentWallet landing page">
        <div className="landing-logo">
          <div className="logo-mark" aria-hidden="true">
            <AgentWalletMark />
          </div>
          <div>
            <div className="logo-name">AgentWallet</div>
            <div className="logo-sub">non-custodial · policy-enforced</div>
          </div>
        </div>

        <h1>
          The wallet that
          <br />
          <span>thinks before it spends.</span>
        </h1>

        <p className="landing-subtitle">
          On-chain spend policy for autonomous AI agents.
          <br />
          Set rules. Deploy agents. Trust the chain.
        </p>

        <div className="landing-actions">
          <Link className="button landing-primary" href="/app">
            Deploy policy <span aria-hidden="true">→</span>
          </Link>
          <a className="button secondary" href="#product">
            Read the docs
          </a>
          <Link className="button ghost" href="/app">
            View demo
          </Link>
        </div>
      </section>

      <section className="landing-support" id="product" aria-label="AgentWallet product summary">
        <div className="landing-card">
          <span>01</span>
          <h2>Not a wallet for people.</h2>
          <p>A wallet for the agents people build. Infrastructure, not interface.</p>
        </div>
        <div className="landing-card">
          <span>02</span>
          <h2>Policy before payment.</h2>
          <p>Agents submit intents. AgentWallet checks owner policy before settlement.</p>
        </div>
        <div className="landing-card">
          <span>03</span>
          <h2>Auditable by default.</h2>
          <p>Every approved, blocked, and policy-changing action leaves a trace.</p>
        </div>
      </section>
    </main>
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
