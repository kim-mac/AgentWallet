# AgentWallet
(Solana Hackathon Winner • Fast-Tracked for Solana Accelerator)
Brex/Ramp-style spend controls for AI agents on Solana.

## Sui Overflow 2026

AgentWallet also includes a Sui-native autonomous agent wallet built with
shared Move policy and vault objects plus real DeepBook V3 execution. Start with
the dedicated [AgentWallet on Sui guide](SUI_README.md) for the live dashboard
flow, deployed testnet package, architecture, Explorer evidence, and judge
demo instructions.

- Live app: [agentwallet-web.vercel.app/app](https://agentwallet-web.vercel.app/app)
- Public repo: [github.com/kim-mac/AgentWallet](https://github.com/kim-mac/AgentWallet)
- Sui testnet package: `0x768743700b22d533d228719672e17009a48a4dac473ae7f1d1d2733f6c1defa9`

`x402` lets agents pay. AgentWallet lets owners control how autonomous agents
spend: budgets, approvals, vendor allowlists, recipient allowlists, and audit
logs outside agent code.

## What is built.

- Next.js dashboard showing policies, approvals, payment decisions, and audit logs.
- Shared TypeScript policy evaluator used by the API and dashboard.
- API route for x402-style payment evaluation at `/api/payments/evaluate`.
- Agent executor API at `/api/agent/payments/execute` for Telegram bots or
  backend agents to submit real policy-gated payments.
- Self-serve hosted agent provisioning: owners sign with Phantom, generate an
  encrypted devnet agent wallet/API key, and link Telegram without touching env.
- Devnet faucet API at `/api/devnet/faucet` so judges can fund the test token
  account without using Docker.
- Policy simulator package for split-spend, unknown-vendor, and pause checks.
- Solana devnet wallet flow for real Anchor policy accounts and policy-checked
  SPL-token payment execution.
- Deployed devnet AgentWallet program:
  `9eZMFa68NmfF4YNz5cF96AsJukbRzvvP1TDktN4cfbDU`.
- Devnet test token mint:
  `6XigBN521xmNyFV4DDgLpfGVsXTP3JstsaSTkbpNRXgk`.

## Run the web demo.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Configure the devnet demo.

Copy `.env.example` to `.env.local` and fill the values you want to enable:

```bash
cp .env.example .env.local
```

For a fully self-serve judge demo:

- `AGENTSPEND_DEVNET_FAUCET_SECRET_KEY` must be the mint authority for the
  devnet test token.
- `AGENTSPEND_ENCRYPTION_KEY` encrypts generated hosted agent wallets.
- `AGENTSPEND_SESSION_SECRET` signs owner wallet sessions.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` come from a Vercel
  Marketplace Redis/Upstash integration.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` configure the shared
  AgentWallet Telegram bot.

Secret keys can be pasted as a JSON array from a Solana keypair file or as a
comma-separated 64-byte list. Keep these devnet-only.

## Judge-ready devnet flow

1. Install Phantom and switch it to Solana devnet.
2. Fund the wallet with devnet SOL from Phantom or a devnet faucet.
3. Start the app:

```bash
npm run dev
```

4. Open the dashboard and connect Phantom.
5. Click **Fund connected wallet**. This calls `/api/devnet/faucet` and mints
   AgentWallet test tokens to the connected wallet.
6. In **Production agent setup**, click **Sign in with wallet**, sign the
   challenge, then click **Generate hosted agent**.
7. Copy the one-time agent API key and fund the generated agent wallet/token
   account with devnet SOL and AgentWallet test tokens.
8. Click **Use** on the hosted agent row, add allowed recipients, then click
   **Initialize on-chain policy** and approve in Phantom.
9. Click **Link** on the hosted agent row and send the shown `/link CODE` to the
   shared Telegram bot.
10. Use Telegram or **AI agent chat** and type
    `send 1 token to <recipient-public-key>`. The chat calls the backend agent
    executor, which signs with the provisioned agent wallet and routes the
    transaction through the same on-chain policy.
11. Open the generated Solana Explorer links for the policy transaction, faucet
    transaction, and payment transaction.

This path creates real devnet transactions and the SPL token transfer is routed
through the deployed AgentWallet program.

## Run the Anchor policy account flow

The dashboard can now build real Anchor-compatible devnet transactions for the
AgentWallet program:

- `initialize_policy`
- `update_policy`
- `pause_policy`
- `resume_policy`

These transactions require the AgentWallet program to be deployed on devnet first.
Until then, Phantom can sign the transaction but devnet will reject it because the
program account does not exist.

### Deploy the program with Docker

Start the Anchor container from PowerShell:

```powershell
docker run --rm --platform linux/amd64 -it `
  -v agentspend-cargo:/root/.cargo `
  -v agentspend-target:/workspace/target `
  -v agentspend-solana:/root/.config/solana `
  -v "C:\Users\kim16\Documents\New project 2:/workspace" `
  -w /workspace `
  solanafoundation/anchor:v0.31.1 bash
```

Inside the container:

```bash
solana config set --url devnet
solana-keygen new --no-bip39-passphrase -o /root/.config/solana/id.json
solana airdrop 5
anchor keys sync
anchor build
anchor deploy --provider.cluster devnet
```

Copy the deployed program ID printed by Anchor into the dashboard's **Program ID**
field, then use **Initialize on-chain policy**. The app derives the policy PDA
from:

```text
["policy", owner_wallet, agent_public_key]
```

The dashboard now defaults to the deployed devnet program ID and locks it in the
UI. Owners should not enter arbitrary program IDs in normal use; that value is
part of the trusted AgentWallet deployment.

## Run the policy-gated payment executor

After the on-chain policy is initialized, the dashboard can submit the program's
`execute_payment` instruction. This is the first real payment path through the
policy engine.

For the browser smoke test, use the connected Phantom wallet as the agent:

1. Put your Phantom public key in **Agent public key**.
2. Put the recipient wallet in **Allowed recipient public keys**.
3. Initialize or update the on-chain policy.
4. Make sure the agent wallet has an associated token account for the selected
   token mint and enough token balance.
5. In **Agent payment executor**, enter the recipient, token amount, and decimals.
6. Click **Execute policy payment** and approve in Phantom.

The app creates the recipient associated token account if needed, then calls
`execute_payment`. The program validates the agent, recipient allowlist,
per-payment cap, daily budget, pause status, and approval threshold before
moving tokens.

If your policy agent is the Docker deploy wallet (`52rHw...`), Phantom cannot
sign agent payments unless that devnet wallet is imported into Phantom. For the
cleanest demo, create a second policy using your Phantom address as both owner
and agent. A separate backend signer can be added later for a real hosted agent
hot wallet.

## Agent executor API

The **Agent payment executor** panel is the browser proof. A real AI agent uses
the server-side executor API instead.

```bash
curl -X POST http://localhost:3000/api/agent/payments/execute \
  -H "Authorization: Bearer <one-time-agent-api-key-from-dashboard>" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "<recipient-wallet-public-key>",
    "amount": "1"
  }'
```

The API key resolves the provisioned agent wallet, policy PDA, token mint, and
decimals from Redis. The backend decrypts the stored agent key only for signing.
The on-chain program still enforces the policy, so the API cannot make the agent
spend outside the stored policy limits.

This is the integration point for Telegram:

1. Telegram bot receives `pay 1 token to <recipient>`.
2. Bot/backend parses the recipient, amount, token, and target policy.
3. Bot resolves the Telegram chat to a provisioned AgentWallet agent.
4. AgentWallet signs as that generated hosted agent wallet.
5. The Solana program approves or rejects the transfer on-chain.

The dashboard includes an **AI agent chat** tab that simulates the Telegram
message path locally. It parses natural commands like:

```text
send 1 token to DAzJZKmEUtHfXL69kLHMG4pu3oVTpo6RTSAYXPEPZugF
```

The parser extracts the amount and recipient, then calls
`/api/agent/payments/execute`. Outcomes are not hardcoded: under-policy commands
submit real devnet transactions, while over-limit or non-allowlisted commands
are rejected by the on-chain program.

## Real Telegram bot

The app exposes a Telegram webhook at:

```text
/api/webhooks/telegram
```

Add these values once to the deployed app environment:

```env
TELEGRAM_BOT_TOKEN=<bot-token-from-BotFather>
TELEGRAM_WEBHOOK_SECRET=<random-secret>
```

Register the production webhook after Vercel deploys:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<your-vercel-domain>/api/webhooks/telegram",
    "secret_token": "'"$TELEGRAM_WEBHOOK_SECRET"'"
  }'
```

For a local demo, expose the app with a tunnel and use the tunnel URL instead:

```bash
ngrok http 3000
```

In the dashboard, click **Link** on a hosted agent and send the shown code to
the bot:

```text
/link ABC123
```

Then message the bot:

```text
send 1 token to <recipient-wallet>
```

The Telegram bot uses the same parser and backend executor as AI Agent Chat.
The backend signs as the linked provisioned agent wallet, and the AgentWallet
program approves or rejects the transfer on-chain.

## Devnet faucet API

```bash
curl -X POST http://localhost:3000/api/devnet/faucet \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "<wallet-public-key>",
    "tokenMint": "6XigBN521xmNyFV4DDgLpfGVsXTP3JstsaSTkbpNRXgk",
    "amount": 25,
    "decimals": 6
  }'
```

This route requires `AGENTSPEND_DEVNET_FAUCET_SECRET_KEY`. It is intentionally
devnet-only demo infrastructure.

## Verify

```bash
npm test -w @agentspend/shared
npm test -w @agentspend/web
npm run typecheck
npm run build
```

## Anchor toolchain note

The local Windows/WSL environment is ARM64. The Solana Foundation Anchor Docker
image works, but it runs as `linux/amd64` under emulation on this machine. The
program scaffold is present in `programs/agent_spend`, but a cold `anchor build`
did not finish within the available timeout under emulation.

Use this command when continuing on a machine with enough Docker build time:

```powershell
docker run --rm --platform linux/amd64 `
  -v agentspend-cargo:/root/.cargo `
  -v agentspend-target:/workspace/target `
  -v "C:\Users\kim16\Documents\New project 2:/workspace" `
  -w /workspace `
  solanafoundation/anchor:v0.31.1 anchor build
```
