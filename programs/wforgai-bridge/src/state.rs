use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct BridgeConfig {
    pub admin: Pubkey,
    pub validator_eth_address: [u8; 20],
    pub wforgai_mint: Pubkey,
    pub paused: bool,
    pub nonce: u64,
}

#[account]
#[derive(InitSpace)]
pub struct TransferRecord {
    pub completed: bool,
}

impl BridgeConfig {
    pub const SEED: &'static [u8] = b"bridge-config";
}

impl TransferRecord {
    pub const SEED: &'static [u8] = b"transfer";
}

pub const MINT_AUTHORITY_SEED: &[u8] = b"mint-authority";
