# Sui Owner Fund Recovery Design

## Goal

Allow the owner of an AgentWallet Sui policy to recover some or all assets held
in its policy-bound vault at any time. Recovery must remain owner-only, work for
active, expired, and revoked policies, and leave an on-chain audit event.

## On-chain interface

The Move policy module will expose two generic public functions:

- `withdraw<T>(policy, vault, amount, ctx)` withdraws an exact positive amount.
- `withdraw_all<T>(policy, vault, ctx)` withdraws the complete non-zero balance.

Both functions will:

1. Require the transaction sender to equal `policy.owner`.
2. Require the vault's `policy_id` to match the supplied policy object.
3. Reject zero-value withdrawals and amounts above the vault balance.
4. Create a `Coin<T>` from the vault balance and transfer it to the owner.
5. Emit `OwnerVaultWithdrawal` with the policy ID, vault ID, owner, withdrawn
   amount, and remaining vault balance.

Withdrawals do not mutate `remaining_budget`. The policy budget is the maximum
agent authorization; vault balance is the liquidity currently available to
exercise that authorization. An owner may therefore underfund an active policy,
and the UI must display the resulting vault balance clearly.

## SDK and dashboard

The SDK will add transaction plans and submit helpers for partial and full owner
withdrawal. Dashboard action routing will sign these transactions with the
owner wallet only.

The Sui dashboard will add a compact fund-recovery section showing:

- Current vault balance when known.
- A positive amount input in the vault token's smallest unit or existing display
  convention.
- `Withdraw amount` and `Withdraw all` actions.
- Confirmation or human-readable rejection text.

Successful recovery will refresh balances, Sui activity, and budget/vault proof
state. The activity log will render the withdrawal event with an Explorer link.

## Error handling

The contract will use explicit abort codes for invalid withdrawal amount and
insufficient vault balance. Existing codes cover wrong owner and policy/vault
mismatch. Web and SDK error mappings will translate these into actionable owner
messages.

## Testing

Move tests will prove:

- The owner can partially withdraw from an active policy vault.
- The owner can withdraw the complete remainder.
- A non-owner cannot withdraw.
- Zero and over-balance withdrawals fail.
- A vault from another policy cannot be used.

TypeScript tests will cover transaction-plan construction, dashboard action
routing, result/config merging, and event parsing. Final verification will run
the Move test suite, SDK tests, web tests, typecheck, and production build.

## Non-goals

- Closing policy or vault objects.
- Restoring consumed policy budget.
- Automatically revoking after withdrawal.
- Redesigning DeepBook execution or wallet custody.
