use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::errors::BridgeError;
use crate::state::BridgeConfig;

const SUPPORTED_CHAINS: [u64; 3] = [56, 42161, 1];

#[derive(Accounts)]
pub struct BridgeOut<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        mut,
        seeds = [BridgeConfig::SEED],
        bump,
    )]
    pub bridge_config: Account<'info, BridgeConfig>,

    #[account(
        mut,
        address = bridge_config.wforgai_mint,
    )]
    pub wforgai_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = wforgai_mint,
        token::authority = sender,
    )]
    pub sender_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<BridgeOut>,
    amount: u64,
    target_chain_id: u64,
    recipient_bytes32: [u8; 32],
) -> Result<()> {
    let config = &mut ctx.accounts.bridge_config;

    require!(!config.paused, BridgeError::BridgePaused);
    require!(amount > 0, BridgeError::InvalidAmount);
    require!(
        SUPPORTED_CHAINS.contains(&target_chain_id),
        BridgeError::InvalidTargetChain
    );
    require!(
        ctx.accounts.sender_ata.amount >= amount,
        BridgeError::InsufficientBalance
    );

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.wforgai_mint.to_account_info(),
                from: ctx.accounts.sender_ata.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
            },
        ),
        amount,
    )?;

    let transfer_id = compute_transfer_id(
        &ctx.accounts.sender.key(),
        &ctx.accounts.wforgai_mint.key(),
        amount,
        target_chain_id,
        &recipient_bytes32,
        config.nonce,
    );

    config.nonce = config.nonce.checked_add(1).unwrap();

    msg!(
        "BridgeOut: transfer_id={}, amount={}, target_chain={}, recipient={}, nonce={}",
        hex::encode(transfer_id),
        amount,
        target_chain_id,
        hex::encode(recipient_bytes32),
        config.nonce - 1
    );

    Ok(())
}

fn compute_transfer_id(
    sender: &Pubkey,
    wforgai_mint: &Pubkey,
    amount: u64,
    target_chain_id: u64,
    recipient_bytes32: &[u8; 32],
    nonce: u64,
) -> [u8; 32] {
    let mut data = Vec::with_capacity(120);
    data.extend_from_slice(sender.as_ref());
    data.extend_from_slice(wforgai_mint.as_ref());
    data.extend_from_slice(&amount.to_le_bytes());
    data.extend_from_slice(&target_chain_id.to_le_bytes());
    data.extend_from_slice(recipient_bytes32);
    data.extend_from_slice(&nonce.to_le_bytes());
    solana_program::keccak::hash(&data).0
}
