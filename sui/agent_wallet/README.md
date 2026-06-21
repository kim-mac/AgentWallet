# AgentWallet Move package

This directory contains the Sui Move enforcement layer for AgentWallet. For the
complete product architecture, guided dashboard flow, deployed IDs, DeepBook
markets, and judge demo, read the root [Sui guide](../../SUI_README.md).

## Published package

| Item | Value |
| --- | --- |
| Network | Sui testnet |
| Package ID | `0x768743700b22d533d228719672e17009a48a4dac473ae7f1d1d2733f6c1defa9` |
| Module | `policy` |
| Version | `1` |
| Toolchain | Sui CLI `1.73.0` |

Publication metadata is stored in [`Published.toml`](Published.toml).

## Objects

### `AgentPolicy`

Shared policy state controlled by the owner:

- owner and authorized agent addresses
- maximum and remaining budget
- allowed DeepBook pool IDs
- expiry timestamp
- revocation flag
- successful action count

### `AgentVault<T>`

Shared typed strategy vault bound to one policy object. Funds can leave only
through `take_budgeted_coin<T>` after policy checks pass.

## Public functions

| Function | Authority | Purpose |
| --- | --- | --- |
| `create_policy` | Owner | Creates and shares a policy for one agent |
| `create_vault<T>` | Owner | Creates a typed vault bound to the policy |
| `deposit<T>` | Any funder | Deposits a coin into the vault |
| `revoke` | Owner | Permanently blocks future agent spends |
| `add_allowed_pool` | Owner | Adds a DeepBook pool to the allowlist |
| `remove_allowed_pool` | Owner | Removes a DeepBook pool from the allowlist |
| `take_budgeted_coin<T>` | Agent | Releases an approved amount for a scoped PTB |
| `return_coin<T>` | PTB caller | Returns unused strategy funds to the vault |

Read-only accessors expose owner, agent, maximum budget, remaining budget,
revocation state, expiry, action count, and vault balance.

## Enforcement order

`take_budgeted_coin<T>` verifies:

1. vault-policy association
2. configured agent signer
3. policy not revoked
4. policy not expired according to the Sui Clock
5. positive amount
6. amount within remaining budget
7. allowlisted DeepBook pool

Only then does it decrement `remaining_budget`, increment `action_count`, emit
`AgentBudgetUsed`, and split a `Coin<T>` from the vault.

## Events

- `PolicyCreated`
- `AgentVaultCreated`
- `AgentVaultFunded`
- `AgentBudgetUsed`
- `AgentVaultReturned`
- `PolicyRevoked`

## Abort codes

| Code | Constant | Meaning |
| --- | --- | --- |
| `0` | `E_NOT_OWNER` | Sender is not the owner |
| `1` | `E_NOT_AGENT` | Sender is not the configured agent |
| `2` | `E_REVOKED` | Policy was revoked |
| `3` | `E_EXPIRED` | Policy expired |
| `4` | `E_POOL_NOT_ALLOWED` | Pool is outside policy scope |
| `5` | `E_INVALID_BUDGET` | Budget or amount is invalid |
| `6` | `E_OVER_BUDGET` | Amount exceeds remaining budget |
| `7` | `E_VAULT_POLICY_MISMATCH` | Vault belongs to another policy |

## DeepBook PTB shape

The policy module does not wrap or simulate DeepBook. The SDK builds one PTB
that composes AgentWallet with the real DeepBook V3 package:

1. `policy::take_budgeted_coin<T>`
2. DeepBook market swap or balance-manager deposit plus limit order
3. settle DeepBook output, with `policy::return_coin<T>` available to composed
   PTBs that return unused funds to the vault

The current dashboard market path transfers output and any input refund to the
agent wallet. The current limit path deposits the released coin into the
agent-owned DeepBook balance manager.

DeepBook package and pool IDs are documented in the root
[`SUI_README.md`](../../SUI_README.md).

## Build and test

With a Sui CLI on `PATH`:

```bash
sui move build --path sui/agent_wallet
sui move test --path sui/agent_wallet
```

The repository-local Windows command is:

```powershell
.\.tools\sui-testnet-v1.73.0-windows-x86_64\sui.exe move build --path sui/agent_wallet
.\.tools\sui-testnet-v1.73.0-windows-x86_64\sui.exe move test --path sui/agent_wallet
```

The six Move tests cover:

- successful agent spend and budget accounting
- unauthorized agent rejection
- unapproved pool rejection
- over-budget rejection
- expiry rejection
- revocation rejection

## CLI integration

The recommended judge experience is the dashboard. For direct CLI use, the SDK
provides:

```bash
npm run sui:owner -w @agentwallet/sdk -- create-policy
npm run sui:owner -w @agentwallet/sdk -- create-vault
npm run sui:owner -w @agentwallet/sdk -- fund-vault
npm run sui:deepbook -w @agentwallet/sdk -- create-balance-manager
npm run sui:deepbook-demo -w @agentwallet/sdk
npm run sui:owner -w @agentwallet/sdk -- revoke-policy
```

### Owner environment

```text
SUI_OWNER_PRIVATE_KEY
SUI_PACKAGE_ID
SUI_AGENT_ADDRESS
SUI_MAX_BUDGET
SUI_ALLOWED_POOL_ID
SUI_EXPIRES_AT_MS
SUI_POLICY_ID
SUI_VAULT_ID
SUI_COIN_TYPE
SUI_TOKEN_TYPE_LABEL
SUI_DEPOSIT_AMOUNT
SUI_NETWORK=testnet
```

Only variables required by the selected command need to be set.

### Agent DeepBook environment

```text
SUI_AGENT_PRIVATE_KEY
SUI_PACKAGE_ID
SUI_POLICY_ID
SUI_VAULT_ID
SUI_COIN_TYPE
SUI_ORDER_AMOUNT
SUI_DEEPBOOK_PACKAGE_ID
SUI_DEEPBOOK_POOL_ID
SUI_DEEPBOOK_BASE_TYPE
SUI_DEEPBOOK_QUOTE_TYPE
SUI_BALANCE_MANAGER_ID
SUI_ORDER_TYPE
SUI_ORDER_PRICE
SUI_ORDER_QUANTITY
SUI_ORDER_EXPIRE_TIMESTAMP
SUI_CLOCK_ID=0x6
SUI_NETWORK=testnet
```

The dashboard generates copyable command snippets from its saved object IDs.
Private keys are not required in environment variables when using the browser
dashboard flow.
