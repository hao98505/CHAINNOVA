use anchor_lang::prelude::*;

use crate::errors::BridgeError;
use crate::state::BridgeConfig;

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [BridgeConfig::SEED],
        bump,
        has_one = admin @ BridgeError::Unauthorized,
    )]
    pub bridge_config: Account<'info, BridgeConfig>,
}

pub fn pause_handler(ctx: Context<AdminOnly>) -> Result<()> {
    ctx.accounts.bridge_config.paused = true;
    msg!("Bridge paused");
    Ok(())
}

pub fn unpause_handler(ctx: Context<AdminOnly>) -> Result<()> {
    ctx.accounts.bridge_config.paused = false;
    msg!("Bridge unpaused");
    Ok(())
}

pub fn update_validator_handler(
    ctx: Context<AdminOnly>,
    new_eth_address: [u8; 20],
) -> Result<()> {
    ctx.accounts.bridge_config.validator_eth_address = new_eth_address;
    msg!("Validator updated to 0x{}", hex::encode(new_eth_address));
    Ok(())
}
