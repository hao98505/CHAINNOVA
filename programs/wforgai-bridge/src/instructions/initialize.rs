use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

use crate::errors::BridgeError;
use crate::state::{BridgeConfig, MINT_AUTHORITY_SEED};

const WFORGAI_DECIMALS: u8 = 9;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + BridgeConfig::INIT_SPACE,
        seeds = [BridgeConfig::SEED],
        bump,
    )]
    pub bridge_config: Account<'info, BridgeConfig>,

    #[account(
        constraint = wforgai_mint.decimals == WFORGAI_DECIMALS @ BridgeError::InvalidMintDecimals,
        constraint = wforgai_mint.mint_authority.contains(&mint_authority.key()) @ BridgeError::InvalidMintAuthority,
    )]
    pub wforgai_mint: Account<'info, Mint>,

    /// CHECK: PDA used as mint authority, no data
    #[account(
        seeds = [MINT_AUTHORITY_SEED],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<Initialize>,
    validator_eth_address: [u8; 20],
) -> Result<()> {
    let config = &mut ctx.accounts.bridge_config;
    config.admin = ctx.accounts.admin.key();
    config.validator_eth_address = validator_eth_address;
    config.wforgai_mint = ctx.accounts.wforgai_mint.key();
    config.paused = false;
    config.nonce = 0;

    msg!("Bridge initialized. Validator: 0x{}", hex::encode(validator_eth_address));
    Ok(())
}
