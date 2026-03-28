use anchor_lang::prelude::*;

pub mod state;
pub mod errors;
pub mod instructions;

use instructions::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod wforgai_bridge {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        validator_eth_address: [u8; 20],
    ) -> Result<()> {
        instructions::initialize::handler(ctx, validator_eth_address)
    }

    pub fn complete_transfer(
        ctx: Context<CompleteTransfer>,
        transfer_id: [u8; 32],
        amount: u64,
        recipient: Pubkey,
        signature: [u8; 64],
        recovery_id: u8,
    ) -> Result<()> {
        instructions::complete_transfer::handler(
            ctx,
            transfer_id,
            amount,
            recipient,
            signature,
            recovery_id,
        )
    }

    pub fn bridge_out(
        ctx: Context<BridgeOut>,
        amount: u64,
        target_chain_id: u64,
        recipient_bytes32: [u8; 32],
    ) -> Result<()> {
        instructions::bridge_out::handler(ctx, amount, target_chain_id, recipient_bytes32)
    }

    pub fn pause(ctx: Context<AdminOnly>) -> Result<()> {
        instructions::admin::pause_handler(ctx)
    }

    pub fn unpause(ctx: Context<AdminOnly>) -> Result<()> {
        instructions::admin::unpause_handler(ctx)
    }

    pub fn update_validator(
        ctx: Context<AdminOnly>,
        new_eth_address: [u8; 20],
    ) -> Result<()> {
        instructions::admin::update_validator_handler(ctx, new_eth_address)
    }
}
