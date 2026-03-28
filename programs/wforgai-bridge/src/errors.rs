use anchor_lang::prelude::*;

#[error_code]
pub enum BridgeError {
    #[msg("Bridge is paused")]
    BridgePaused = 6000,

    #[msg("Invalid secp256k1 signature")]
    InvalidSignature = 6001,

    #[msg("Transfer already completed")]
    TransferAlreadyCompleted = 6002,

    #[msg("Invalid amount")]
    InvalidAmount = 6003,

    #[msg("Invalid target chain")]
    InvalidTargetChain = 6004,

    #[msg("Insufficient balance")]
    InsufficientBalance = 6005,

    #[msg("Unauthorized")]
    Unauthorized = 6006,

    #[msg("Mint decimals must be 9")]
    InvalidMintDecimals = 6007,

    #[msg("Mint authority must be the bridge PDA")]
    InvalidMintAuthority = 6008,
}
