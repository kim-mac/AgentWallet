use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TokenAccount, TokenInterface, TransferChecked};

declare_id!("C47kWvinbJVvPyZoSvLBjRjWXaoDGjsSadp2S1VgiLQN");

#[program]
pub mod agent_spend {
    use super::*;

    pub fn initialize_policy(
        ctx: Context<InitializePolicy>,
        args: InitializePolicyArgs,
    ) -> Result<()> {
        require!(
            args.max_per_payment > 0,
            AgentSpendError::InvalidPolicyLimit
        );
        require!(args.daily_budget > 0, AgentSpendError::InvalidPolicyLimit);
        require!(
            args.allowed_recipients.len() <= Policy::MAX_RECIPIENTS,
            AgentSpendError::TooManyRecipients
        );
        require!(
            !args.allowed_token_mints.is_empty(),
            AgentSpendError::NoAllowedTokenMints
        );
        require!(
            args.allowed_token_mints.len() <= Policy::MAX_TOKEN_MINTS,
            AgentSpendError::TooManyTokenMints
        );

        let policy = &mut ctx.accounts.policy;
        policy.owner = ctx.accounts.owner.key();
        policy.agent = args.agent;
        policy.token_mint = args.token_mint;
        policy.max_per_payment = args.max_per_payment;
        policy.daily_budget = args.daily_budget;
        policy.approval_threshold = args.approval_threshold;
        policy.spent_in_period = 0;
        policy.period_started_at = Clock::get()?.unix_timestamp;
        policy.period_seconds = args.period_seconds.max(1);
        policy.allowed_recipients = args.allowed_recipients;
        policy.allowed_token_mints = args.allowed_token_mints;
        policy.paused = false;
        policy.bump = ctx.bumps.policy;

        emit!(PolicyUpdated {
            policy: policy.key(),
            owner: policy.owner,
            agent: policy.agent
        });

        Ok(())
    }

    pub fn update_policy(ctx: Context<UpdatePolicy>, args: UpdatePolicyArgs) -> Result<()> {
        require!(
            args.max_per_payment > 0,
            AgentSpendError::InvalidPolicyLimit
        );
        require!(args.daily_budget > 0, AgentSpendError::InvalidPolicyLimit);
        require!(
            args.allowed_recipients.len() <= Policy::MAX_RECIPIENTS,
            AgentSpendError::TooManyRecipients
        );
        require!(
            !args.allowed_token_mints.is_empty(),
            AgentSpendError::NoAllowedTokenMints
        );
        require!(
            args.allowed_token_mints.len() <= Policy::MAX_TOKEN_MINTS,
            AgentSpendError::TooManyTokenMints
        );

        let policy = &mut ctx.accounts.policy;
        policy.token_mint = args.allowed_token_mints[0];
        policy.max_per_payment = args.max_per_payment;
        policy.daily_budget = args.daily_budget;
        policy.approval_threshold = args.approval_threshold;
        policy.period_seconds = args.period_seconds.max(1);
        policy.allowed_recipients = args.allowed_recipients;
        policy.allowed_token_mints = args.allowed_token_mints;

        emit!(PolicyUpdated {
            policy: policy.key(),
            owner: policy.owner,
            agent: policy.agent
        });

        Ok(())
    }

    pub fn pause_policy(ctx: Context<OwnerPolicyAction>) -> Result<()> {
        ctx.accounts.policy.paused = true;
        Ok(())
    }

    pub fn resume_policy(ctx: Context<OwnerPolicyAction>) -> Result<()> {
        ctx.accounts.policy.paused = false;
        Ok(())
    }

    pub fn approve_payment_intent(
        ctx: Context<ApprovePaymentIntent>,
        amount: u64,
        expires_at: i64,
    ) -> Result<()> {
        require!(amount > 0, AgentSpendError::InvalidAmount);

        let intent = &mut ctx.accounts.payment_intent;
        intent.policy = ctx.accounts.policy.key();
        intent.recipient = ctx.accounts.recipient.key();
        intent.amount = amount;
        intent.expires_at = expires_at;
        intent.used = false;
        intent.bump = ctx.bumps.payment_intent;

        Ok(())
    }

    pub fn execute_payment(ctx: Context<ExecutePayment>, amount: u64, decimals: u8) -> Result<()> {
        require!(amount > 0, AgentSpendError::InvalidAmount);

        let policy = &mut ctx.accounts.policy;
        require!(!policy.paused, AgentSpendError::PolicyPaused);
        require!(
            policy.allows_recipient(&ctx.accounts.recipient.key()),
            AgentSpendError::RecipientNotAllowed
        );
        require!(
            policy.allows_token_mint(&ctx.accounts.mint.key()),
            AgentSpendError::TokenMintNotAllowed
        );
        require!(
            amount <= policy.max_per_payment,
            AgentSpendError::PerPaymentCapExceeded
        );

        policy.refresh_period(Clock::get()?.unix_timestamp);
        require!(
            policy.spent_in_period.saturating_add(amount) <= policy.daily_budget,
            AgentSpendError::DailyBudgetExceeded
        );

        if amount > policy.approval_threshold {
            let intent = ctx
                .accounts
                .payment_intent
                .as_mut()
                .ok_or(AgentSpendError::ApprovalRequired)?;
            require!(!intent.used, AgentSpendError::PaymentIntentAlreadyUsed);
            require!(
                intent.policy == policy.key(),
                AgentSpendError::InvalidPaymentIntent
            );
            require!(
                intent.recipient == ctx.accounts.recipient.key(),
                AgentSpendError::InvalidPaymentIntent
            );
            require!(intent.amount == amount, AgentSpendError::InvalidPaymentIntent);
            require!(
                intent.expires_at >= Clock::get()?.unix_timestamp,
                AgentSpendError::PaymentIntentExpired
            );
            intent.used = true;
        }

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.agent_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.agent.to_account_info(),
        };

        token_interface::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            amount,
            decimals,
        )?;

        policy.spent_in_period = policy.spent_in_period.saturating_add(amount);

        emit!(PaymentExecuted {
            policy: policy.key(),
            agent: policy.agent,
            recipient: ctx.accounts.recipient.key(),
            amount
        });

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializePolicyArgs {
    pub agent: Pubkey,
    pub token_mint: Pubkey,
    pub max_per_payment: u64,
    pub daily_budget: u64,
    pub approval_threshold: u64,
    pub period_seconds: i64,
    pub allowed_recipients: Vec<Pubkey>,
    pub allowed_token_mints: Vec<Pubkey>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdatePolicyArgs {
    pub max_per_payment: u64,
    pub daily_budget: u64,
    pub approval_threshold: u64,
    pub period_seconds: i64,
    pub allowed_recipients: Vec<Pubkey>,
    pub allowed_token_mints: Vec<Pubkey>,
}

#[derive(Accounts)]
#[instruction(args: InitializePolicyArgs)]
pub struct InitializePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = Policy::SPACE,
        seeds = [b"policy_v2", owner.key().as_ref(), args.agent.as_ref()],
        bump
    )]
    pub policy: Account<'info, Policy>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ AgentSpendError::InvalidOwner)]
    pub policy: Account<'info, Policy>,
}

#[derive(Accounts)]
pub struct OwnerPolicyAction<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ AgentSpendError::InvalidOwner)]
    pub policy: Account<'info, Policy>,
}

#[derive(Accounts)]
#[instruction(amount: u64, expires_at: i64)]
pub struct ApprovePaymentIntent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(has_one = owner @ AgentSpendError::InvalidOwner)]
    pub policy: Account<'info, Policy>,
    /// CHECK: Used only as the recipient identity recorded in the approved intent.
    pub recipient: UncheckedAccount<'info>,
    #[account(
        init,
        payer = owner,
        space = PaymentIntent::SPACE,
        seeds = [
            b"payment_intent",
            policy.key().as_ref(),
            recipient.key().as_ref(),
            &amount.to_le_bytes(),
            &expires_at.to_le_bytes()
        ],
        bump
    )]
    pub payment_intent: Account<'info, PaymentIntent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecutePayment<'info> {
    pub agent: Signer<'info>,
    #[account(mut, has_one = agent @ AgentSpendError::InvalidAgent)]
    pub policy: Account<'info, Policy>,
    /// CHECK: Recipient identity must be present in policy.allowed_recipients.
    pub recipient: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = agent,
        token::token_program = token_program
    )]
    pub agent_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = recipient,
        token::token_program = token_program
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, anchor_spl::token_interface::Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    #[account(mut)]
    pub payment_intent: Option<Account<'info, PaymentIntent>>,
}

#[account]
#[derive(InitSpace)]
pub struct Policy {
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub token_mint: Pubkey,
    pub max_per_payment: u64,
    pub daily_budget: u64,
    pub approval_threshold: u64,
    pub spent_in_period: u64,
    pub period_started_at: i64,
    pub period_seconds: i64,
    #[max_len(12)]
    pub allowed_recipients: Vec<Pubkey>,
    #[max_len(12)]
    pub allowed_token_mints: Vec<Pubkey>,
    pub paused: bool,
    pub bump: u8,
}

impl Policy {
    pub const MAX_RECIPIENTS: usize = 12;
    pub const MAX_TOKEN_MINTS: usize = 12;
    pub const SPACE: usize = 8 + Self::INIT_SPACE;

    pub fn allows_recipient(&self, recipient: &Pubkey) -> bool {
        self.allowed_recipients.iter().any(|allowed| allowed == recipient)
    }

    pub fn allows_token_mint(&self, mint: &Pubkey) -> bool {
        self.allowed_token_mints.iter().any(|allowed| allowed == mint)
    }

    pub fn refresh_period(&mut self, now: i64) {
        if now.saturating_sub(self.period_started_at) >= self.period_seconds {
            self.spent_in_period = 0;
            self.period_started_at = now;
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct PaymentIntent {
    pub policy: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub expires_at: i64,
    pub used: bool,
    pub bump: u8,
}

impl PaymentIntent {
    pub const SPACE: usize = 8 + Self::INIT_SPACE;
}

#[event]
pub struct PolicyUpdated {
    pub policy: Pubkey,
    pub owner: Pubkey,
    pub agent: Pubkey,
}

#[event]
pub struct PaymentExecuted {
    pub policy: Pubkey,
    pub agent: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum AgentSpendError {
    #[msg("Policy limits must be greater than zero.")]
    InvalidPolicyLimit,
    #[msg("Too many allowed recipients.")]
    TooManyRecipients,
    #[msg("Only the policy owner can perform this action.")]
    InvalidOwner,
    #[msg("Only the configured agent can execute payments.")]
    InvalidAgent,
    #[msg("Payment amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Policy is paused.")]
    PolicyPaused,
    #[msg("Recipient is not allowlisted.")]
    RecipientNotAllowed,
    #[msg("Amount exceeds per-payment cap.")]
    PerPaymentCapExceeded,
    #[msg("Daily budget would be exceeded.")]
    DailyBudgetExceeded,
    #[msg("Owner approval is required for this payment.")]
    ApprovalRequired,
    #[msg("Payment intent is invalid.")]
    InvalidPaymentIntent,
    #[msg("Payment intent is expired.")]
    PaymentIntentExpired,
    #[msg("Payment intent was already used.")]
    PaymentIntentAlreadyUsed,
    #[msg("At least one token mint must be allowlisted.")]
    NoAllowedTokenMints,
    #[msg("Too many allowed token mints.")]
    TooManyTokenMints,
    #[msg("Token mint is not allowlisted.")]
    TokenMintNotAllowed,
}
