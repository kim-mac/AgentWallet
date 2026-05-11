# AgentWallet Design Direction

AgentWallet is the wallet for AI agents: a control plane where owners create agent wallets, define spending policies, route agent payments through on-chain enforcement, and inspect every action through an audit trail.

This document is the brand and product design source of truth for the public marketing website and the logged-in AgentWallet app.

## Brand Positioning

AgentWallet gives AI agents wallets with owner-controlled policy rails.

The core promise is simple: agents can hold and spend from wallets, but owners define the rules. Those rules should feel durable, inspectable, and non-bypassable. The product should not look like a hackathon dashboard or a speculative crypto app. It should feel like financial infrastructure for autonomous software.

AgentWallet should occupy the space between consumer wallet polish, playful wallet personality, and serious policy controls:

- Approachable enough that a solo builder can understand it quickly.
- Serious enough that a company could trust it with agent spending.
- Agent-native enough that the SDK, API, audit log, and x402 flows feel like first-class product surfaces.
- Playful enough to feel like a wallet product people want to use, not an institutional admin console.

### Product Sentence

The wallet for AI agents.

### Expanded Promise

Give every AI agent a wallet, then control how it spends with owner-defined policies, Solana devnet settlement, x402-compatible payments, and a complete audit trail.

### Tone

AgentWallet should sound calm, exact, secure, and lightly playful. It should avoid hype-heavy crypto language, but it should not sound like a bank compliance portal.

Use:

- "Policy-controlled agent wallets"
- "Owner-approved spending"
- "Agent payments with auditability"
- "Non-bypassable spend controls"
- "Programmable wallets for autonomous agents"
- "Give your agent a wallet"
- "Let agents spend inside the lines"
- "Every payment gets checked before it moves"

Avoid:

- "Revolutionary"
- "DeFi super app"
- "AI magic"
- "Unleash your agents"
- "The future of everything"

## Inspiration Notes

AgentWallet can take inspiration from Phantom and Ctrl without copying either.

### Phantom

Reference: [phantom.com](https://phantom.com/)

Phantom feels friendly, polished, and consumer-ready. Its strongest lesson for AgentWallet is clarity. Phantom makes the wallet feel like a home base for crypto activity, not a technical object.

Borrow:

- A simple, memorable promise.
- Friendly wallet language.
- High trust around ownership and security.
- Product visuals that make the wallet feel tangible.

Do not copy:

- Phantom's purple-forward identity.
- Consumer-only framing.
- Large playful brand gestures that would weaken AgentWallet's policy/security posture.

### Ctrl

Reference: [ctrl.xyz](https://ctrl.xyz/)

Ctrl feels more command-oriented and security-forward. Its strongest lesson for AgentWallet is control. It highlights transaction safety, wallet capability, and multi-surface access clearly.

Borrow:

- Strong control language.
- Capability-dense sections.
- Security and transaction-safety framing.
- Clear wallet/product utility.

Do not copy:

- Exact layout patterns.
- Aggressive wallet-switching language.
- Broad chain coverage as the main story.

### AgentWallet's Own Lane

AgentWallet should feel like:

Phantom-level polish + Ctrl-level control + playful agent-native wallet infrastructure.

The product should be calmer than a consumer wallet, but not stiff. Autonomous spending needs governance, yet the interface should still feel tactile, friendly, and alive.

## Visual Identity

### Direction

Premium wallet interface for autonomous agents.

The visual system should communicate:

- Money movement is controlled.
- Agent autonomy is permitted, not uncontrolled.
- Every action is visible.
- Policies are the product, not settings hidden in a corner.
- The product is friendly enough for builders, not only compliance teams.

### Palette

Use a dark, premium foundation with soft pastel wallet accents.

Recommended palette direction:

- Graphite black: primary app background.
- Charcoal: sidebar and base surfaces.
- Soft stone: elevated panels.
- Porcelain: primary text.
- Mist gray: secondary text.
- Muted sage: primary action and approval states. Reference value: `#8FB399`.
- Mist blue: links, secondary highlights, technical surfaces. Reference value: `#8EA6C2`.
- Dusty rose: agent/AI accents, warnings, policy attention, and selected tertiary actions. Reference value: `#D39CA1`.
- Warm gray: neutral rails, inactive states, dividers, and quiet metadata. Reference value: `#767775`.

Avoid:

- Neon green or cyan as dominant colors.
- Gold accents.
- Loud purple/blue crypto gradients.
- Beige, sand, or brown as dominant themes.
- Decorative glow orbs and generic bokeh backgrounds.

Color should be used as a signal and as wallet personality, not decoration. Most of the interface should be graphite, stone, border, and text. Pastel accents should appear in buttons, chips, active states, charts, icons, small navigation moments, and important proof points.

The palette can feel playful through contrast and component shape, not through neon brightness. Think soft mint wallet buttons, powder-blue technical links, dusty-rose policy warnings, and warm-gray quiet surfaces.

### Typography

Use a premium sans-serif for product UI and marketing copy. It should feel precise, modern, and friendly. Geist Sans is a strong fit for the app because it is clean, technical, and readable in dense dashboards.

Use a mono font for:

- Wallet addresses
- Program IDs
- Policy PDAs
- Transaction signatures
- SDK snippets
- API examples
- Audit metadata

Typography rules:

- No negative letter spacing.
- Keep headings calm and direct.
- Do not use oversized hero type inside app panels.
- Use short labels and strong information hierarchy in forms.

### Logo

Use a refined AW monogram plus an AgentWallet wordmark.

The monogram should feel like:

- Wallet
- Agent
- Policy
- Infrastructure

It should not feel like:

- A meme coin
- A generic robot face
- A bank seal or institutional crest
- A copied crypto wallet logo

The mark must work in:

- Sidebar avatar
- Favicon
- App loading state
- Marketing website header
- Social preview image

## Marketing Website Design

The public website should explain AgentWallet as a real startup product, not just a demo.

### First Message

The wallet for AI agents.

Supporting copy should explain the value:

Create wallets for autonomous agents, set owner-controlled spending policies, route payments through Solana and x402, and audit every action.

### Hero

The hero should show the actual product concept immediately. Use real product UI, wallet cards, policy controls, and audit/payment surfaces. Avoid generic abstract AI illustrations, but a tasteful agent-wallet product object or monogram-driven visual system is welcome.

The hero should communicate three ideas in the first viewport:

- The agent has a wallet.
- The owner controls the policy.
- Payments are auditable.

Good hero visual:

- A dark product UI composition with an agent wallet card, policy limits, an approved payment, and a rejected over-limit attempt.
- A tactile agent wallet object with pastel rails for policy, payment, and audit.
- A monogram-led product scene that feels like a real wallet brand.

Bad hero visual:

- A robot illustration.
- A generic blockchain network graphic.
- A gradient blob background.
- A split card layout where the product is a decoration.
- A corporate banking page with no personality.

### Website Sections

Recommended public-site flow:

1. Hero: The wallet for AI agents.
2. Agent wallets: create hosted wallets for agents.
3. Owner policies: set budgets, recipients, programs, categories, approval thresholds.
4. x402 and Solana payments: agents pay APIs and services through policy-gated settlement.
5. Audit ledger: every approved, rejected, and policy-changing action is recorded.
6. SDK/API: integrate AgentWallet into any agent runtime.
7. Live devnet proof: show Solana Explorer links, program ID, policy PDA, and transaction examples.
8. Developer call to action: launch the app, create an agent wallet, run the SDK example.

### Marketing Copy Rules

Use concise, product-led copy with a little wallet personality.

Good:

- "Create an agent wallet."
- "Set the policy."
- "Let the agent pay within limits."
- "Review every action."
- "Reject unsafe payments before they settle."
- "Your agent can spend. Your policy decides."
- "A wallet your agent can use, with controls you can trust."

Avoid:

- Long educational blocks.
- Explaining basic crypto concepts in the hero.
- Repeating "AI agent" in every sentence.
- Claims that imply production mainnet custody before the product supports it.

## App Dashboard Design

The logged-in app should open directly into the product. Do not put a landing page in front of the dashboard.

The app is the command center for agent money, but it should still feel like a wallet. It should have moments of delight through cards, chips, icons, compact product objects, and small interaction details.

### Primary Flow

The main dashboard flow is:

1. Connect owner wallet.
2. Sign in with wallet.
3. Generate or select a hosted agent wallet.
4. Fund the agent wallet.
5. Register the agent and derive the policy PDA.
6. Initialize or update the on-chain policy.
7. Execute a payment or x402 paid API call.
8. Inspect the audit log and Explorer links.

This flow should be visually obvious without relying on instructional paragraphs.

### Information Priority

The first screen should prioritize:

- Active owner wallet.
- Selected agent wallet.
- Policy status.
- Agent spend limits.
- Allowed recipients and programs.
- Latest execution result.
- Audit log entry point.

Manual payment tools and raw debug controls should remain available, but visually secondary.

### Dashboard Surfaces

#### Owner Wallet

Show the connected owner wallet clearly. The owner wallet is the authority that creates and updates policies.

States:

- Not connected
- Connected
- Signed in
- Session expired

#### Agent Wallet

Show the active agent wallet as a first-class wallet object, not as a text field.

Include:

- Agent name
- Public key
- Policy PDA
- Funding state
- API key status
- Token account status
- Latest activity

#### Policy

Policy configuration should feel like the central product, not a form dump.

Group controls by intent:

- Budget controls
- Approval threshold
- Allowed recipients
- Allowed programs/products
- Spend categories
- Time window
- Pause/resume state

Policy status should be visible:

- Draft
- Derived
- Initialized
- Updated
- Paused
- Needs wallet signature
- Rejected by policy

#### Agent Execution

The AI agent chat and SDK/x402 execution surfaces should show that the agent is using AgentWallet through an API, not acting as the owner. This area can be slightly more playful because it represents the agent in action.

Show:

- User command
- Parsed payment intent
- Policy decision
- On-chain transaction signature
- Explorer link
- Rejection reason when blocked

#### Audit Log

The audit log should feel like a financial ledger.

Each row should show:

- Action type
- Agent
- Policy or payment target
- Amount when relevant
- Status
- Timestamp
- Explorer link when relevant

The audit log should reinforce trust. It should not look like a console dump.

## Component Rules

### Cards And Panels

Cards should be purposeful, tactile, and restrained.

Rules:

- Maximum radius: 8px.
- Quiet borders.
- No nested decorative cards.
- Avoid heavy shadows.
- Use elevation through contrast, spacing, and borders rather than glow.
- Use pastel top bars, tiny color rails, icons, or chips to make cards feel wallet-native without becoming noisy.

### Buttons

Button hierarchy:

- Primary: muted sage fill for main productive actions.
- Secondary: quiet bordered surface.
- Destructive/risk: muted coral or dusty rose.
- Disabled: clearly unavailable with no hover excitement.

Primary buttons should be used sparingly. A screen should not have many competing primary actions. Buttons can feel tactile and wallet-like, but should never become cartoonish.

### Status States

Status should be consistent across the app.

Required states:

- Approved
- Rejected
- Needs approval
- Initialized
- Uninitialized
- Paused
- Draft
- Checking
- Error

Approved should use sage. Rejected and dangerous states should use muted coral/rose. Technical or informational states can use mist blue. Agent/AI-specific highlights can use pale lilac sparingly.

### Inputs

Inputs should feel precise and financial.

Rules:

- Clear labels.
- Short helper tooltips where needed.
- Strong focus state without neon glow.
- Addresses use mono text.
- Long addresses should truncate intelligently with copy affordances.

### Tables And Registries

Agent registry and audit tables should be scan-friendly.

Rules:

- Dense but not cramped.
- Clear active row state.
- Actions should be icon-led where obvious.
- Use status chips instead of long explanatory strings.
- Keep public keys copyable and Explorer-linkable.

### Code And SDK Snippets

SDK snippets are product surfaces.

Rules:

- Use high-quality code blocks.
- Include copy button.
- Use mono font.
- Keep examples short and runnable.
- Avoid overwhelming the first screen with raw API payloads.

## Interaction Principles

### Owner Control First

Owner authority should be visible whenever a policy changes or an agent is provisioned.

When wallet signing is required, the UI should say what is about to happen before Phantom opens.

### Agent Autonomy Second

Agents should feel autonomous only within the policy boundary.

The product should make it clear that the agent can request a payment, but AgentWallet decides whether it can settle.

### Auditability Always

Every meaningful action should leave a visible trail.

Important user-facing events:

- Agent created
- Agent funded
- Policy initialized
- Policy updated
- Policy paused or resumed
- Payment approved
- Payment rejected
- x402 challenge received
- x402 settlement completed

### Demo Without Feeling Like A Demo

The hackathon/demo flow should still work, but labels should make the product feel production-minded.

Use "Devnet proof" or "Devnet test token" where necessary. Avoid making the whole app feel temporary.

## Future Design Notes

Telegram and Jupiter swap support are future product surfaces.

When added, they should follow the same principles:

- Telegram is an agent command channel, not the source of policy truth.
- Jupiter swaps are payment actions routed through AgentWallet policy checks.
- The dashboard remains the owner's source of control and auditability.

## Acceptance Criteria

This design direction is successful if another engineer or designer can implement the next UI pass without guessing:

- What AgentWallet is.
- How it should feel.
- Which colors and visual signals to use.
- How the marketing website differs from the app dashboard.
- Which surfaces are primary versus secondary.
- How to preserve the current Solana devnet functionality while making the product feel real.
