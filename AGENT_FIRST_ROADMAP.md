# AgentWallet Agent-First Roadmap

AgentWallet already proves the core idea: AI agents can request payments while owners keep policy control over wallets, limits, approvals, and audit logs. This roadmap tracks the next features needed to make AgentWallet feel like software built for agents as first-class users, not only a human dashboard with an API.

## Current Foundation

- Hosted Solana devnet wallets for AI agents.
- Owner wallet sign-in with Phantom.
- Owner recovery password before hosted wallet creation.
- Agent API keys with hashed server-side storage.
- Encrypted hosted wallet private keys.
- Anchor policy accounts on Solana devnet.
- Allowed recipient wallets.
- Allowed token mints.
- Per-payment caps.
- Daily budget controls.
- Owner approval threshold.
- Pause/resume policy controls.
- Agent payment execution through API, SDK pattern, and Telegram.
- Audit logs for important actions.
- x402-style paid API demo.

## Sui Overflow Track: Autonomous Agent Wallet

Goal: add a Sui-native AgentWallet module for the Agentic Web track. This should
use Sui as part of the AI wallet safety layer, not as a payment rail bolted onto
the end.

- [x] Scaffold Sui Move package at `sui/agent_wallet`.
- [x] Add shared `AgentPolicy` object with owner, agent, budget, expiry, pool
  scope, revocation, and action count.
- [x] Add shared `AgentVault<T>` so strategy funds are held by policy-controlled
  custody instead of directly by the agent.
- [x] Add budgeted coin release function for DeepBook PTBs.
- [x] Emit Move events for policy creation, vault funding, budget usage, returns,
  and revocation.
- [x] Install Sui CLI locally.
- [x] Compile and test the Move package.
- [x] Add Move unit tests for over-budget, wrong-agent, expired, wrong-pool, and
  revoked failures.
- [x] Add TypeScript PTB plan builders for create policy, create vault, run
  budgeted DeepBook action, and revoke.
- [x] Convert TypeScript PTB plans into executable Sui-compatible transaction
  builder calls.
- [x] Add direct `@mysten/sui` dependency and test against real `Transaction`.
- [x] Add Sui transaction signing/submission wrapper with structured
  success/failure results.
- [x] Add high-level Sui SDK helpers to create and submit real transactions from
  AgentWallet PTB plans.
- [x] Add first concrete DeepBook limit-order PTB plan:
  policy budget release -> DeepBook call -> vault return.
- [x] Add Sui DeepBook demo runner that reads testnet object IDs from env and
  submits the policy-gated order transaction.
- [x] Add owner bootstrap/revoke CLI for create policy, create vault, and revoke
  policy transactions.
- [x] Add Sui event/object parsing helpers for the on-chain AgentWallet
  activity log.
- [ ] Add real DeepBook order demo using the budgeted coin release path.
- [ ] Add dashboard Sui tab with policy, vault, remaining budget, activity log,
  and revocation demo.
- [ ] Add Sui SDK/API docs for agents.

## Phase 1: Agent-Native Onboarding

Goal: make onboarding understandable to agents and agent developers without relying only on the dashboard.

- [x] Add an agent-readable onboarding endpoint.
- [x] Add `GET /api/agent-wallet/setup-status`.
- [x] Return missing setup steps in structured form.
- [x] Return next recommended action for the agent/developer.
- [ ] Add dashboard copy that explains owner setup vs agent runtime setup.
- [x] Add docs showing how an agent discovers whether its wallet is ready.

Example response:

```json
{
  "ready": false,
  "missing": ["policy_pda", "funded_wallet", "allowed_recipient"],
  "nextAction": "Ask the owner to initialize policy and fund the hosted wallet."
}
```

## Phase 2: MCP Server

Goal: let agents use AgentWallet as a native tool through MCP.

- [x] Create an AgentWallet MCP server package.
- [x] Tool: `get_wallet_status`.
- [x] Tool: `list_allowed_recipients`.
- [x] Tool: `list_allowed_tokens`.
- [x] Tool: `simulate_payment`.
- [x] Tool: `request_payment`.
- [ ] Tool: `request_owner_approval`.
- [ ] Tool: `get_approval_status`.
- [x] Tool: `get_audit_log`.
- [x] Add MCP setup docs.
- [x] Add an example agent using the MCP server.

Why this matters: agents increasingly discover and use tools through MCP. AgentWallet should be callable as a wallet tool, not only as a human-operated web app.

## Phase 3: Machine-Readable Docs And OpenAPI

Goal: make AgentWallet discoverable and usable by agents programmatically.

- [x] Add OpenAPI spec for public agent endpoints.
- [x] Add machine-readable error schema.
- [x] Add policy capability schema.
- [x] Add examples for payment, simulation, approval, audit, and x402.
- [x] Add `/api/openapi.json`.
- [x] Link OpenAPI from `/docs`.
- [ ] Add copyable prompt/instructions for giving AgentWallet to an AI agent.

Important schemas:

- Agent wallet status.
- Policy capability.
- Payment request.
- Payment result.
- Payment rejection.
- Approval request.
- Audit event.

## Phase 4: Agent Capability Discovery

Goal: let an agent know exactly what it can and cannot do before attempting actions.

- [x] Add `GET /api/agent-wallet/capabilities`.
- [x] Return agent wallet public key.
- [x] Return current policy PDA.
- [x] Return allowed token mints.
- [x] Return allowed recipients.
- [x] Return per-payment cap.
- [x] Return remaining daily budget.
- [x] Return approval threshold.
- [x] Return policy status.
- [x] Return supported actions.

Example questions this endpoint should answer:

- What wallet do I control?
- What tokens can I spend?
- Who can I pay?
- What is my max autonomous transaction?
- How much budget remains today?
- Will this need owner approval?
- Is my policy paused?

## Phase 5: Structured Error Responses

Goal: make rejection reasons actionable for agents.

- [x] Replace plain rejection strings with stable error codes.
- [x] Add `suggestedAction` to rejected payments.
- [x] Add `humanMessage` and `agentMessage` fields.
- [ ] Update Telegram and dashboard to render structured errors.
- [x] Add tests for core rejection codes.

Example:

```json
{
  "ok": false,
  "code": "RECIPIENT_NOT_ALLOWED",
  "message": "Recipient is not on the allowed list.",
  "suggestedAction": "request_owner_policy_update"
}
```

Initial error codes:

- `POLICY_NOT_INITIALIZED`
- `POLICY_PAUSED`
- `RECIPIENT_NOT_ALLOWED`
- `TOKEN_NOT_ALLOWED`
- `AMOUNT_ABOVE_PER_PAYMENT_CAP`
- `DAILY_BUDGET_EXCEEDED`
- `OWNER_APPROVAL_REQUIRED`
- `AGENT_WALLET_NOT_FUNDED`
- `TOKEN_ACCOUNT_MISSING`
- `INVALID_AGENT_API_KEY`

## Phase 6: Policy Simulation Endpoint

Goal: let an agent safely plan before trying a real payment.

- [x] Add `POST /api/agent-wallet/simulate-payment`.
- [x] Reuse policy evaluation logic without sending a transaction.
- [x] Return whether payment would approve, reject, or require owner approval.
- [x] Return structured rejection or approval reason.
- [x] Add SDK method `wallet.simulatePayment(...)`.
- [x] Add MCP tool `simulate_payment`.
- [ ] Add dashboard test panel for simulation.

Example:

```ts
const result = await wallet.simulatePayment({
  recipient,
  amount: "5",
  tokenMint
});
```

## Phase 7: Owner Approval Workflow For Agents

Goal: make approvals fully agent-readable and trackable.

- [ ] Return approval request ID when payment needs owner approval.
- [ ] Add `GET /api/agent-wallet/approvals/:id`.
- [ ] Add SDK method `wallet.getApproval(id)`.
- [ ] Add SDK method `wallet.waitForApproval(id)`.
- [ ] Add webhook/event support for approval status changes.
- [ ] Return statuses: `pending`, `approved`, `executed`, `rejected`, `expired`.
- [ ] Add readable owner rejection messages.

Desired agent flow:

```ts
const payment = await wallet.pay({ recipient, amount });

if (payment.status === "approval_required") {
  const final = await wallet.waitForApproval(payment.approvalId);
}
```

## Phase 8: Agent Memory And Transaction Context

Goal: give agents historical context so they can make better decisions.

- [ ] Add `GET /api/agent-wallet/history`.
- [ ] Add recent payments.
- [ ] Add recent failed attempts.
- [ ] Add recent approvals.
- [ ] Add remaining budget.
- [ ] Add policy changes.
- [ ] Add SDK method `wallet.getHistory()`.
- [ ] Add MCP tool `get_audit_log`.

Useful outputs:

- Last successful payment.
- Last rejected payment.
- Current day spend.
- Rejection rate.
- Most common rejection reason.
- Recently added recipients.

## Phase 9: CLI

Goal: give agents and developers a simple command-line interface.

- [ ] Add `@agentwallet/cli`.
- [ ] Command: `agentwallet status`.
- [ ] Command: `agentwallet pay --to <wallet> --amount <amount>`.
- [ ] Command: `agentwallet simulate --to <wallet> --amount <amount>`.
- [ ] Command: `agentwallet approvals`.
- [ ] Command: `agentwallet audit`.
- [ ] Support `AGENTWALLET_API_KEY` and `AGENTWALLET_BASE_URL`.

Example:

```bash
agentwallet status
agentwallet simulate --to 6tNg...W8yA --amount 5
agentwallet pay --to 6tNg...W8yA --amount 1
```

## Phase 10: Scoped API Keys

Goal: reduce blast radius if an agent API key leaks.

- [ ] Add key scopes.
- [ ] Add read-only keys.
- [ ] Add payment-only keys.
- [ ] Add approval-request-only keys.
- [ ] Add token-specific keys.
- [ ] Add recipient-specific keys.
- [ ] Add key expiration.
- [ ] Add key rotation history.
- [ ] Add dashboard UI for key scopes.

Possible scopes:

- `wallet:read`
- `payment:simulate`
- `payment:request`
- `approval:read`
- `audit:read`

## Phase 11: Webhooks And Event Streams

Goal: agents should react to wallet events instead of polling.

- [ ] Add webhook subscriptions per hosted agent.
- [ ] Event: `payment.approved`.
- [ ] Event: `payment.rejected`.
- [ ] Event: `approval.created`.
- [ ] Event: `approval.executed`.
- [ ] Event: `approval.rejected`.
- [ ] Event: `budget.low`.
- [ ] Event: `policy.updated`.
- [ ] Event: `wallet.funded`.
- [ ] Add signature verification for webhook delivery.
- [ ] Add retry behavior.

## Phase 12: Framework Examples

Goal: make AgentWallet easy to adopt in real agent stacks.

- [ ] Example with OpenAI Agents SDK.
- [ ] Example with Vercel AI SDK.
- [ ] Example with LangChain.
- [ ] Example with CrewAI.
- [ ] Example with MCP clients.
- [ ] Example with Telegram agents.
- [ ] Example with Discord agents.
- [ ] Example for x402 paid API agent.

## Phase 13: x402 And MCP Payments

Goal: make AgentWallet directly useful for agent-to-tool and agent-to-agent payments.

- [ ] Harden x402 payment challenge parsing.
- [ ] Add complete x402 response validation.
- [ ] Add merchant SDK/helper.
- [ ] Add MCP server payment example.
- [ ] Add paid MCP tool demo.
- [ ] Add agent-to-agent payment demo.
- [ ] Add support for refunds or failed-settlement handling.

## Phase 14: Policy Intelligence

Goal: move from static rules to intelligent spend management.

- [ ] Add policy recommendation engine.
- [ ] Suggest spend limits based on historical usage.
- [ ] Detect unusual recipients.
- [ ] Detect repeated micro-spend attacks.
- [ ] Detect sudden budget exhaustion.
- [ ] Add risk scoring for payment requests.
- [ ] Add owner-facing anomaly alerts.
- [ ] Add agent-facing risk explanation.

This is where AgentWallet starts becoming more like Brex/Ramp for AI agents instead of only a programmable wallet.

## Phase 15: Production Security Hardening

Goal: make hosted wallets safer for real funds.

- [ ] Add stronger secret management.
- [ ] Add encrypted key rotation plan.
- [ ] Add optional external KMS integration.
- [ ] Explore MPC signing.
- [ ] Explore TEE-based signing.
- [ ] Add rate limiting.
- [ ] Add abuse detection.
- [ ] Add audit export.
- [ ] Add organization/team roles.
- [ ] Add mainnet readiness checklist.

## Priority Order

Recommended implementation order:

1. MCP server.
2. OpenAPI and machine-readable docs.
3. Agent capability discovery.
4. Structured errors.
5. Payment simulation endpoint.
6. Agent-readable approval workflow.
7. Scoped API keys.
8. Webhooks/events.
9. CLI.
10. Framework examples.
11. x402/MCP payment hardening.
12. Policy intelligence.
13. Production security hardening.

## North Star

AgentWallet should become the default wallet and spend-control layer for autonomous agents.

An agent should be able to discover AgentWallet, understand its permissions, simulate a payment, request payment, handle approval, inspect audit history, and continue working without needing a human to click through a dashboard for every normal action.
