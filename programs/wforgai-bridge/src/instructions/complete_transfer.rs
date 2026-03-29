use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::errors::BridgeError;
use crate::state::{BridgeConfig, TransferRecord, MINT_AUTHORITY_SEED};

#[derive(Accounts)]
#[instruction(transfer_id: [u8; 32])]
pub struct CompleteTransfer<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [BridgeConfig::SEED],
        bump,
    )]
    pub bridge_config: Account<'info, BridgeConfig>,

    #[account(
        init,
        payer = payer,
        space = 8 + TransferRecord::INIT_SPACE,
        seeds = [TransferRecord::SEED, &transfer_id],
        bump,
    )]
    pub transfer_record: Account<'info, TransferRecord>,

    #[account(
        mut,
        address = bridge_config.wforgai_mint,
    )]
    pub wforgai_mint: Account<'info, Mint>,

    /// CHECK: PDA mint authority
    #[account(
        seeds = [MINT_AUTHORITY_SEED],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        token::mint = wforgai_mint,
    )]
    pub recipient_ata: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<CompleteTransfer>,
    transfer_id: [u8; 32],
    amount: u64,
    recipient: Pubkey,
    signature: [u8; 64],
    recovery_id: u8,
) -> Result<()> {
    let config = &ctx.accounts.bridge_config;

    require!(!config.paused, BridgeError::BridgePaused);
    require!(amount > 0, BridgeError::InvalidAmount);

    require!(
        ctx.accounts.recipient_ata.owner == recipient,
        BridgeError::InvalidSignature
    );

    let message = build_complete_transfer_message(
        &transfer_id,
        amount,
        &recipient,
        &config.wforgai_mint,
    );
    verify_secp256k1_signature(
        &message,
        &signature,
        recovery_id,
        &config.validator_eth_address,
    )?;

    let transfer_record = &mut ctx.accounts.transfer_record;
    transfer_record.completed = true;

    let mint_authority_bump = ctx.bumps.mint_authority;
    let signer_seeds: &[&[&[u8]]] = &[&[MINT_AUTHORITY_SEED, &[mint_authority_bump]]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.wforgai_mint.to_account_info(),
                to: ctx.accounts.recipient_ata.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    msg!(
        "Transfer completed: id={}, amount={}, recipient={}",
        hex::encode(transfer_id),
        amount,
        recipient
    );
    Ok(())
}

fn build_complete_transfer_message(
    transfer_id: &[u8; 32],
    amount: u64,
    recipient: &Pubkey,
    mint: &Pubkey,
) -> Vec<u8> {
    let mut msg = Vec::with_capacity(104);
    msg.extend_from_slice(transfer_id);
    msg.extend_from_slice(&amount.to_le_bytes());
    msg.extend_from_slice(recipient.as_ref());
    msg.extend_from_slice(mint.as_ref());
    msg
}

fn verify_secp256k1_signature(
    message: &[u8],
    signature: &[u8; 64],
    recovery_id: u8,
    expected_eth_address: &[u8; 20],
) -> Result<()> {
    let msg_hash = solana_program::keccak::hash(message);

    let recovered_pubkey = solana_program::secp256k1_recover::secp256k1_recover(
        &msg_hash.0,
        recovery_id,
        signature,
    )
    .map_err(|_| error!(BridgeError::InvalidSignature))?;

    let pubkey_hash = solana_program::keccak::hash(&recovered_pubkey.0);
    let recovered_eth_address = &pubkey_hash.0[12..32];

    require!(
        recovered_eth_address == expected_eth_address,
        BridgeError::InvalidSignature
    );

    Ok(())
}
