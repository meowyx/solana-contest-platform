use anchor_lang::prelude::*;

declare_id!("2isGcQpMNxWSea8p1hTjLjn5RWEnD41T6BjL33JW3wK4");

#[program]
pub mod solana_contest_platform {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
