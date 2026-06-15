# AgentWallet Sui Module

This package is the first Sui-native AgentWallet core for the Sui Overflow
Agentic Web track.

The goal is not to bolt Sui payments onto the existing Solana product. The Sui
module uses shared Move objects as the agent wallet control layer:

- `AgentPolicy` defines the owner, agent, budget, allowed DeepBook pools,
  expiry, revocation flag, and action count.
- `AgentVault<T>` holds strategy funds. The agent does not hold those coins
  directly.
- `take_budgeted_coin<T>` releases funds only when the caller is the configured
  agent and the policy is active, unexpired, in budget, and scoped to an allowed
  pool.
- Events provide the on-chain activity log.
- `revoke` lets the owner immediately stop future agent actions.

## Intended DeepBook PTB Shape

The Sui Overflow requirement asks for real DeepBook orders. The intended
programmable transaction block is:

1. Call `agent_wallet::policy::take_budgeted_coin<T>` with the policy object,
   vault object, amount, and DeepBook pool ID.
2. Pass the returned `Coin<T>` into the DeepBook order/swap call.
3. Return any unused coin to `agent_wallet::policy::return_coin<T>`.

That keeps the agent autonomous while preventing it from bypassing budget,
expiry, pool scope, or revocation checks.

## Local CLI

On Windows ARM64, `suiup` can install itself but current Sui testnet releases do
not publish a native Windows ARM64 `sui.exe`. The repo-local working setup uses
the official Windows x86_64 testnet CLI under Windows ARM emulation:

```powershell
.\.tools\sui-testnet-v1.73.0-windows-x86_64\sui.exe --version
```

`.tools/` is intentionally gitignored because it contains large downloaded
binaries.

## Build

Run:

```bash
sui move build --path sui/agent_wallet
sui move test --path sui/agent_wallet
```

Or with the repo-local CLI:

```powershell
.\.tools\sui-testnet-v1.73.0-windows-x86_64\sui.exe move build --path sui/agent_wallet
.\.tools\sui-testnet-v1.73.0-windows-x86_64\sui.exe move test --path sui/agent_wallet
```

The package currently builds and passes Move unit tests on Sui CLI `1.73.0`.

Current tests cover:

- agent-only spending
- DeepBook pool allowlist enforcement
- remaining budget ceiling
- expiry enforcement
- owner revocation enforcement
- budget/action accounting after an approved spend

## TypeScript PTB Plan Helpers

The `@agentwallet/sdk` package now exposes dependency-free Sui plan helpers:

- `buildSuiCreatePolicyPlan`
- `buildSuiCreateVaultPlan`
- `buildSuiDeepBookActionPlan`
- `buildSuiDeepBookLimitOrderPlan`
- `buildSuiRevokePolicyPlan`
- `toSuiTransaction`
- `createSuiTransaction`
- `submitSuiPlan`
- `submitSuiTransaction`

The plan helpers return plain command plans for tests, docs, and agent-readable
introspection. `toSuiTransaction(tx, plan)` applies those commands to a
Sui-compatible transaction builder by:

- converting object IDs into `tx.object(...)`
- converting budgets and amounts into `tx.pure.u64(...)`
- converting action labels into `vector<u8>` via `tx.pure.vector("u8", ...)`
- resolving `$agentwalletCoin` into the result of the earlier budgeted coin
  release call

The SDK test suite includes a smoke test against the official
`@mysten/sui/transactions` `Transaction` class. `createSuiTransaction(plan)`
returns a real Sui `Transaction` object directly, and `submitSuiPlan(...)`
creates that transaction, signs it with a provided signer, submits it through a
provided Sui client, and returns a normalized execution result.

`submitSuiTransaction` wraps `client.signAndExecuteTransaction(...)`, optionally
waits for confirmation through `client.waitForTransaction(...)`, and returns a
normalized success/failure result with a digest and explorer URL. This keeps
agent runtimes from needing to parse raw Sui execution effects for common policy
approval/rejection flows.

The key agent action plan is:

1. Call `agent_wallet::policy::take_budgeted_coin<T>`.
2. Use the returned `$agentwalletCoin` as the input coin to the DeepBook order.
3. Return any `$deepbookReturnedCoin` to `agent_wallet::policy::return_coin<T>`.

That keeps DeepBook execution behind the same policy object that enforces
agent identity, budget ceiling, expiry, pool scope, and owner revocation.

`buildSuiDeepBookLimitOrderPlan` is the first concrete DeepBook plan helper. It
creates a three-command PTB plan:

1. release a capped coin from the policy vault,
2. place a DeepBook limit order against the configured pool and balance manager,
3. return leftover coin to the vault.

The helper still expects live testnet object IDs from a published package,
DeepBook pool, and balance manager. The next phase wires those IDs into an
actual testnet execution script or dashboard flow.

## Sui DeepBook Demo Runner

The SDK package includes owner bootstrap and agent execution entrypoints.

### Owner Bootstrap Commands

All owner commands require:

```bash
SUI_OWNER_PRIVATE_KEY=sui-private-key-text
SUI_PACKAGE_ID=0x...
SUI_NETWORK=testnet
```

Create the policy object:

```bash
SUI_AGENT_ADDRESS=0x...
SUI_MAX_BUDGET=500000000
SUI_ALLOWED_POOL_ID=0x...
SUI_EXPIRES_AT_MS=1770000000000
npm run sui:owner -w @agentwallet/sdk -- create-policy
```

After the transaction lands, copy the created `AgentPolicy` object ID from the
transaction object changes or `PolicyCreated` event. Use that value as
`SUI_POLICY_ID`.

The SDK also includes `summarizeSuiAgentWalletActivity(...)`, which extracts
created policy/vault object IDs and normalizes AgentWallet Move events from raw
Sui transaction output.

Create the vault object:

```bash
SUI_POLICY_ID=0x...
SUI_COIN_TYPE=0x2::sui::SUI
SUI_TOKEN_TYPE_LABEL=SUI
npm run sui:owner -w @agentwallet/sdk -- create-vault
```

After the transaction lands, copy the created `AgentVault<T>` object ID from the
transaction object changes or `AgentVaultCreated` event. Use that value as
`SUI_VAULT_ID`.

Revoke the policy:

```bash
SUI_POLICY_ID=0x...
npm run sui:owner -w @agentwallet/sdk -- revoke-policy
```

Revocation is the judge-facing proof that the owner can stop future autonomous
agent actions.

### Agent DeepBook Command

The agent-side DeepBook runner is:

```powershell
npm run sui:deepbook-demo -w @agentwallet/sdk
```

It reads configuration from environment variables, builds a real Sui
`Transaction`, signs it with an ED25519 Sui private key, submits it to the
configured network, and prints the digest plus Explorer URL.

Required env:

```bash
SUI_AGENT_PRIVATE_KEY=sui-private-key-text
SUI_PACKAGE_ID=0x...
SUI_POLICY_ID=0x...
SUI_VAULT_ID=0x...
SUI_COIN_TYPE=0x2::sui::SUI
SUI_ORDER_AMOUNT=1000000
SUI_DEEPBOOK_PACKAGE_ID=0x...
SUI_DEEPBOOK_POOL_ID=0x...
SUI_BALANCE_MANAGER_ID=0x...
SUI_ORDER_PRICE=1200000000
SUI_ORDER_QUANTITY=1000000
SUI_CLOCK_ID=0x6
SUI_NETWORK=testnet
```

Optional env:

```bash
SUI_ORDER_TYPE=bid
```

The private key must be a Sui-formatted ED25519 private key string accepted by
`decodeSuiPrivateKey` from `@mysten/sui/cryptography`.

This runner is intentionally narrow: it executes the agent-side DeepBook order
after package, policy, vault, pool, and balance manager objects already exist.
The next implementation step is a fuller bootstrap flow that publishes the
package, creates the policy/vault objects, and prints the IDs needed by this
runner.

## Activity Log Helpers

The SDK normalizes the Sui on-chain activity log emitted by this Move module:

- `PolicyCreated` -> `policy_created`
- `AgentVaultCreated` -> `vault_created`
- `AgentBudgetUsed` -> `budget_used`
- `AgentVaultFunded` -> `vault_funded`
- `AgentVaultReturned` -> `vault_returned`
- `PolicyRevoked` -> `policy_revoked`

Use:

```ts
import {
  extractSuiAgentWalletObjectIds,
  parseSuiAgentWalletEvents,
  summarizeSuiAgentWalletActivity
} from "@agentwallet/sdk/sui-events";
```

These helpers let the dashboard or CLI display an AgentWallet-specific ledger
instead of raw Sui event JSON.

## Next Milestone

The next milestone is a real Sui testnet demo that publishes the package,
creates an owner policy object and vault object, then routes an actual DeepBook
order through `take_budgeted_coin<T>`.
