module agent_wallet::policy;

use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, ID, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};
use std::vector;

const E_NOT_OWNER: u64 = 0;
const E_NOT_AGENT: u64 = 1;
const E_REVOKED: u64 = 2;
const E_EXPIRED: u64 = 3;
const E_POOL_NOT_ALLOWED: u64 = 4;
const E_INVALID_BUDGET: u64 = 5;
const E_OVER_BUDGET: u64 = 6;
const E_VAULT_POLICY_MISMATCH: u64 = 7;

/// Shared owner policy for an autonomous agent.
///
/// The agent can act without owner signatures, but only while this object says:
/// active, unexpired, in budget, and within the approved DeepBook pool scope.
public struct AgentPolicy has key {
    id: UID,
    owner: address,
    agent: address,
    max_budget: u64,
    remaining_budget: u64,
    allowed_pools: vector<ID>,
    expires_at_ms: u64,
    revoked: bool,
    action_count: u64,
}

/// Shared custody object for coins controlled by an AgentPolicy.
///
/// The agent should not hold strategy funds directly. PTBs take coins from this
/// vault only through `take_budgeted_coin`, then pass those coins into DeepBook.
public struct AgentVault<phantom T> has key {
    id: UID,
    policy_id: ID,
    balance: Balance<T>,
}

public struct PolicyCreated has copy, drop {
    policy_id: ID,
    owner: address,
    agent: address,
    max_budget: u64,
    expires_at_ms: u64,
}

public struct AgentVaultCreated has copy, drop {
    policy_id: ID,
    vault_id: ID,
    token_type: vector<u8>,
}

public struct AgentBudgetUsed has copy, drop {
    policy_id: ID,
    vault_id: ID,
    owner: address,
    agent: address,
    pool_id: ID,
    amount: u64,
    remaining_budget: u64,
    action: vector<u8>,
    action_count: u64,
    timestamp_ms: u64,
}

public struct AgentVaultFunded has copy, drop {
    policy_id: ID,
    vault_id: ID,
    amount: u64,
}

public struct AgentVaultReturned has copy, drop {
    policy_id: ID,
    vault_id: ID,
    amount: u64,
}

public struct PolicyRevoked has copy, drop {
    policy_id: ID,
    owner: address,
}

public fun create_policy(
    agent: address,
    max_budget: u64,
    allowed_pool: ID,
    expires_at_ms: u64,
    ctx: &mut TxContext,
) {
    assert!(max_budget > 0, E_INVALID_BUDGET);

    let owner = tx_context::sender(ctx);
    let policy = AgentPolicy {
        id: object::new(ctx),
        owner,
        agent,
        max_budget,
        remaining_budget: max_budget,
        allowed_pools: vector[allowed_pool],
        expires_at_ms,
        revoked: false,
        action_count: 0,
    };
    let policy_id = object::id(&policy);

    event::emit(PolicyCreated {
        policy_id,
        owner,
        agent,
        max_budget,
        expires_at_ms,
    });
    transfer::share_object(policy);
}

public fun create_vault<T>(
    policy: &AgentPolicy,
    token_type: vector<u8>,
    ctx: &mut TxContext,
) {
    assert_owner(policy, ctx);

    let policy_id = object::id(policy);
    let vault = AgentVault<T> {
        id: object::new(ctx),
        policy_id,
        balance: balance::zero<T>(),
    };
    let vault_id = object::id(&vault);

    event::emit(AgentVaultCreated {
        policy_id,
        vault_id,
        token_type,
    });
    transfer::share_object(vault);
}

public fun deposit<T>(vault: &mut AgentVault<T>, coin: Coin<T>) {
    let amount = coin::value(&coin);
    let coin_balance = coin::into_balance(coin);
    balance::join(&mut vault.balance, coin_balance);

    event::emit(AgentVaultFunded {
        policy_id: vault.policy_id,
        vault_id: object::id(vault),
        amount,
    });
}

public fun revoke(policy: &mut AgentPolicy, ctx: &mut TxContext) {
    assert_owner(policy, ctx);
    policy.revoked = true;

    event::emit(PolicyRevoked {
        policy_id: object::id(policy),
        owner: policy.owner,
    });
}

public fun add_allowed_pool(
    policy: &mut AgentPolicy,
    pool_id: ID,
    ctx: &mut TxContext,
) {
    assert_owner(policy, ctx);
    let (exists, _) = find_pool(&policy.allowed_pools, pool_id);
    if (!exists) {
        vector::push_back(&mut policy.allowed_pools, pool_id);
    };
}

public fun remove_allowed_pool(
    policy: &mut AgentPolicy,
    pool_id: ID,
    ctx: &mut TxContext,
) {
    assert_owner(policy, ctx);
    let (exists, index) = find_pool(&policy.allowed_pools, pool_id);
    if (exists) {
        vector::remove(&mut policy.allowed_pools, index);
    };
}

/// Releases a coin for a DeepBook PTB only if the agent is still inside policy.
///
/// The intended PTB shape is:
/// 1. `take_budgeted_coin<T>(...)`
/// 2. call DeepBook with the returned Coin<T>
/// 3. return unused Coin<T> through `return_coin<T>(...)`
public fun take_budgeted_coin<T>(
    policy: &mut AgentPolicy,
    vault: &mut AgentVault<T>,
    amount: u64,
    pool_id: ID,
    action: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<T> {
    assert!(vault.policy_id == object::id(policy), E_VAULT_POLICY_MISMATCH);
    record_budget_use(
        policy,
        object::id(vault),
        amount,
        pool_id,
        action,
        clock::timestamp_ms(clock),
        tx_context::sender(ctx),
    );

    coin::from_balance(balance::split(&mut vault.balance, amount), ctx)
}

public fun return_coin<T>(vault: &mut AgentVault<T>, coin: Coin<T>) {
    let amount = coin::value(&coin);
    let coin_balance = coin::into_balance(coin);
    balance::join(&mut vault.balance, coin_balance);

    event::emit(AgentVaultReturned {
        policy_id: vault.policy_id,
        vault_id: object::id(vault),
        amount,
    });
}

public fun owner(policy: &AgentPolicy): address {
    policy.owner
}

public fun agent(policy: &AgentPolicy): address {
    policy.agent
}

public fun max_budget(policy: &AgentPolicy): u64 {
    policy.max_budget
}

public fun remaining_budget(policy: &AgentPolicy): u64 {
    policy.remaining_budget
}

public fun is_revoked(policy: &AgentPolicy): bool {
    policy.revoked
}

public fun expires_at_ms(policy: &AgentPolicy): u64 {
    policy.expires_at_ms
}

public fun action_count(policy: &AgentPolicy): u64 {
    policy.action_count
}

public fun vault_balance<T>(vault: &AgentVault<T>): u64 {
    balance::value(&vault.balance)
}

fun assert_owner(policy: &AgentPolicy, ctx: &TxContext) {
    assert!(tx_context::sender(ctx) == policy.owner, E_NOT_OWNER);
}

fun record_budget_use(
    policy: &mut AgentPolicy,
    vault_id: ID,
    amount: u64,
    pool_id: ID,
    action: vector<u8>,
    timestamp_ms: u64,
    sender: address,
) {
    assert!(sender == policy.agent, E_NOT_AGENT);
    assert!(!policy.revoked, E_REVOKED);
    assert!(timestamp_ms <= policy.expires_at_ms, E_EXPIRED);
    assert!(amount > 0, E_INVALID_BUDGET);
    assert!(amount <= policy.remaining_budget, E_OVER_BUDGET);
    assert!(contains_pool(&policy.allowed_pools, pool_id), E_POOL_NOT_ALLOWED);

    policy.remaining_budget = policy.remaining_budget - amount;
    policy.action_count = policy.action_count + 1;

    event::emit(AgentBudgetUsed {
        policy_id: object::id(policy),
        vault_id,
        owner: policy.owner,
        agent: policy.agent,
        pool_id,
        amount,
        remaining_budget: policy.remaining_budget,
        action,
        action_count: policy.action_count,
        timestamp_ms,
    });
}

fun contains_pool(pools: &vector<ID>, pool_id: ID): bool {
    let (exists, _) = find_pool(pools, pool_id);
    exists
}

fun find_pool(pools: &vector<ID>, pool_id: ID): (bool, u64) {
    let mut i = 0;
    let len = vector::length(pools);
    while (i < len) {
        if (*vector::borrow(pools, i) == pool_id) {
            return (true, i)
        };
        i = i + 1;
    };
    (false, 0)
}

#[test_only]
fun policy_for_testing(
    owner: address,
    agent: address,
    max_budget: u64,
    allowed_pool: ID,
    expires_at_ms: u64,
    ctx: &mut TxContext,
): AgentPolicy {
    AgentPolicy {
        id: object::new(ctx),
        owner,
        agent,
        max_budget,
        remaining_budget: max_budget,
        allowed_pools: vector[allowed_pool],
        expires_at_ms,
        revoked: false,
        action_count: 0,
    }
}

#[test_only]
fun destroy_policy_for_testing(policy: AgentPolicy) {
    let AgentPolicy {
        id,
        owner: _,
        agent: _,
        max_budget: _,
        remaining_budget: _,
        allowed_pools: _,
        expires_at_ms: _,
        revoked: _,
        action_count: _,
    } = policy;
    object::delete(id);
}

#[test_only]
fun pool_a(): ID {
    object::id_from_address(@0xa)
}

#[test_only]
fun pool_b(): ID {
    object::id_from_address(@0xb)
}

#[test_only]
fun vault_for_testing(): ID {
    object::id_from_address(@0xc)
}

#[test]
fun agent_spend_decrements_budget_and_logs_action() {
    let mut ctx = tx_context::dummy();
    let mut policy = policy_for_testing(@0x1, @0x2, 500, pool_a(), 10_000, &mut ctx);

    record_budget_use(&mut policy, vault_for_testing(), 125, pool_a(), b"deepbook_order", 1_000, @0x2);

    assert!(remaining_budget(&policy) == 375, 100);
    assert!(action_count(&policy) == 1, 101);

    destroy_policy_for_testing(policy);
}

#[test, expected_failure(abort_code = E_NOT_AGENT)]
fun non_agent_cannot_spend() {
    let mut ctx = tx_context::dummy();
    let mut policy = policy_for_testing(@0x1, @0x2, 500, pool_a(), 10_000, &mut ctx);
    record_budget_use(&mut policy, vault_for_testing(), 100, pool_a(), b"deepbook_order", 1_000, @0x3);
    destroy_policy_for_testing(policy);
}

#[test, expected_failure(abort_code = E_POOL_NOT_ALLOWED)]
fun unapproved_pool_cannot_spend() {
    let mut ctx = tx_context::dummy();
    let mut policy = policy_for_testing(@0x1, @0x2, 500, pool_a(), 10_000, &mut ctx);
    record_budget_use(&mut policy, vault_for_testing(), 100, pool_b(), b"deepbook_order", 1_000, @0x2);
    destroy_policy_for_testing(policy);
}

#[test, expected_failure(abort_code = E_OVER_BUDGET)]
fun spend_above_remaining_budget_fails() {
    let mut ctx = tx_context::dummy();
    let mut policy = policy_for_testing(@0x1, @0x2, 500, pool_a(), 10_000, &mut ctx);
    record_budget_use(&mut policy, vault_for_testing(), 501, pool_a(), b"deepbook_order", 1_000, @0x2);
    destroy_policy_for_testing(policy);
}

#[test, expected_failure(abort_code = E_EXPIRED)]
fun expired_policy_cannot_spend() {
    let mut ctx = tx_context::dummy();
    let mut policy = policy_for_testing(@0x1, @0x2, 500, pool_a(), 10_000, &mut ctx);
    record_budget_use(&mut policy, vault_for_testing(), 100, pool_a(), b"deepbook_order", 10_001, @0x2);
    destroy_policy_for_testing(policy);
}

#[test, expected_failure(abort_code = E_REVOKED)]
fun revoked_policy_cannot_spend() {
    let mut ctx = tx_context::dummy();
    let mut policy = policy_for_testing(@0x1, @0x2, 500, pool_a(), 10_000, &mut ctx);
    policy.revoked = true;
    record_budget_use(&mut policy, vault_for_testing(), 100, pool_a(), b"deepbook_order", 1_000, @0x2);
    destroy_policy_for_testing(policy);
}
