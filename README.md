# SolArena

> A decentralized, gas-free contest platform built on Solana

[![Anchor Version](https://img.shields.io/badge/Anchor-0.32.1-blue)](https://www.anchor-lang.com/)
[![Solana](https://img.shields.io/badge/Solana-Program-green)](https://solana.com/)
[![Deployed](https://img.shields.io/badge/Deployed-Devnet-orange)](https://explorer.solana.com/address/9VcxDiDi8kbP6UnaVocXDcSPDwoJiDMxmECdqyALGuA4?cluster=devnet)

## 🚀 Live Deployment

**Network:** Solana Devnet
**Program ID:** `9VcxDiDi8kbP6UnaVocXDcSPDwoJiDMxmECdqyALGuA4`
**Explorer:** [View on Solana Explorer](https://explorer.solana.com/address/9VcxDiDi8kbP6UnaVocXDcSPDwoJiDMxmECdqyALGuA4?cluster=devnet)
**Frontend:** Next.js 16 with App Router (Neobrutalist Design)

### Quick Access
- **RPC Endpoint:** `https://api.devnet.solana.com`
- **Program IDL:** Available in `target/idl/solarena.json`
- **Frontend App:** Located in `/app` directory

## Overview

SolArena is a decentralized contest and bounty platform that enables organizations to launch competitions with built-in escrow, multisig judging, and optional transaction fee sponsorship. Participants can submit entries without needing SOL for gas fees, removing barriers to entry.

## Quick Start

```bash
# Install dependencies
yarn install

# Build the program
anchor build

# Run tests
anchor test

# Deploy to localnet
anchor deploy

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

## Core Features

### 🏆 SOL-Based Prizes
- Direct SOL prize amounts (no price oracles needed)
- Transparent prize pools held in escrow
- Prizes locked until winner consensus is reached

### 🔒 Built-in Escrow System
- Automatic fund locking using PDAs
- Trustless prize distribution
- Time-locked fund recovery (30 days after deadline)

### ⚖️ Multisig Judging
- Configurable judge panel (up to 5 judges)
- Customizable approval threshold (e.g., 2-of-3, 3-of-5)
- Independent voting with on-chain transparency
- Automatic prize distribution when consensus is reached

### ⛽ Gas Sponsorship (Optional)
- Contest creators can sponsor transaction fees
- Enables barrier-free participation (users don't need SOL)
- Separate gas pool per contest

### 📝 Submission Management
- URL-based submissions (GitHub repos, demos, portfolios, etc.)
- One submission per participant per contest
- Update capability before deadline
- Timestamp tracking for all submissions

## Contest Lifecycle

```
┌─────────────┐
│   Setup     │  Creator calls create_contest()
└──────┬──────┘
       │
       │ fund_contest()
       ▼
┌─────────────┐
│   Active    │  Accepting submissions
└──────┬──────┘
       │
       │ Deadline passes
       ▼
┌─────────────┐
│  Judging    │  Judges vote on winner
└──────┬──────┘
       │
       │ Consensus reached
       ▼
┌─────────────┐
│ Completed   │  Prize distributed
└─────────────┘
```

### Phase 1: Contest Creation
```javascript
await program.methods
  .createContest(
    contestId,
    "My Hackathon",
    "Build the best DeFi app",
    new BN(1_000_000_000), // 1 SOL prize
    deadline,
    [judge1, judge2, judge3],
    2 // 2-of-3 approval
  )
  .accounts({ /* ... */ })
  .rpc();
```

### Phase 2: Funding
```javascript
await program.methods
  .fundContest()
  .accounts({ /* ... */ })
  .rpc();

// Optional: Enable gas sponsorship
await program.methods
  .enableGasSponsorship(new BN(100_000_000)) // 0.1 SOL for gas
  .accounts({ /* ... */ })
  .rpc();
```

### Phase 3: Submissions
```javascript
await program.methods
  .submitEntry("https://github.com/user/project")
  .accounts({ /* ... */ })
  .rpc();

// Update before deadline
await program.methods
  .updateSubmission("https://github.com/user/updated-project")
  .accounts({ /* ... */ })
  .rpc();
```

### Phase 4: Judging
```javascript
// Each judge votes independently
await program.methods
  .judgeVote(winnerPublicKey)
  .accounts({ /* ... */ })
  .rpc();
```

### Phase 5: Prize Distribution
```javascript
await program.methods
  .distributePrizes()
  .accounts({ /* ... */ })
  .remainingAccounts([
    { pubkey: vote1, isSigner: false, isWritable: false },
    { pubkey: vote2, isSigner: false, isWritable: false },
    // ... all judge vote PDAs
  ])
  .rpc();
```

## Technical Architecture

### Account Structure

SolArena uses 5 types of Program Derived Addresses (PDAs):

```
Contest PDA
├── Seeds: ["contest", creator, contest_id]
├── Stores: metadata, prize amount, judges, status
│
├─── Escrow PDA
│    ├── Seeds: ["escrow", creator, contest_id]
│    └── Holds: Prize SOL (locked until distribution)
│
├─── Gas Pool PDA (optional)
│    ├── Seeds: ["gas_pool", contest]
│    └── Holds: SOL for sponsored transactions
│
├─── Submission PDAs (one per participant)
│    ├── Seeds: ["submission", contest, participant]
│    └── Stores: submission URL, timestamps
│
└─── Vote PDAs (one per judge)
     ├── Seeds: ["vote", contest, judge]
     └── Stores: winner selection, vote timestamp
```

### State Machine

```
Setup ──fund_contest()──> Active ──distribute_prizes()──> Completed
  │
  └──reclaim_funds()──> Cancelled
     (after 30 days)
```

## Program Instructions

| Instruction | Description | Signer |
|------------|-------------|--------|
| `create_contest` | Initialize new contest with metadata | Creator |
| `fund_contest` | Transfer SOL to escrow, activate contest | Creator |
| `enable_gas_sponsorship` | Fund gas pool for free participation | Creator |
| `submit_entry` | Participant submits entry URL | Participant |
| `update_submission` | Update entry before deadline | Participant |
| `judge_vote` | Judge votes for winner | Judge |
| `distribute_prizes` | Distribute funds when consensus reached | Anyone |
| `reclaim_funds` | Recover funds if contest expires | Creator |

## Key Anchor Concepts Demonstrated

### 1. PDAs (Program Derived Addresses)
- 5 different PDA types with various seed patterns
- Deterministic account addressing
- PDA signing for escrow transfers

### 2. Account Constraints
- `init` - Account initialization
- `has_one` - Relationship validation
- `seeds` + `bump` - PDA verification
- `mut` - Mutable accounts

### 3. Cross-Program Invocations (CPIs)
- CPI to System Program for SOL transfers
- Using CpiContext for structured CPIs

### 4. Space Calculation
- Using `InitSpace` macro for automatic sizing
- Proper sizing for String and Vec fields

### 5. Multisig Pattern
- Independent judge voting via PDAs
- Vote aggregation using `remaining_accounts`
- Consensus validation

### 6. State Management
- Enum-based contest lifecycle
- State transition validation
- Time-based access control

## Security Features

- ✅ **Authorization**: `has_one` constraints + runtime checks
- ✅ **PDA Security**: Only program can sign with PDAs
- ✅ **Time Locks**: Deadline enforcement, 30-day reclaim period
- ✅ **Integer Safety**: Saturating arithmetic for counters
- ✅ **Input Validation**: String length, URL format, parameter ranges
- ✅ **State Validation**: Proper state transition checks

## Use Cases

| Use Case | Description |
|----------|-------------|
| 🏗️ **Hackathons** | Organize coding competitions with prizes |
| 💰 **Bounty Programs** | Reward specific development work |
| 🎨 **Design Contests** | Logo, artwork, content creation |
| 🎮 **Community Challenges** | Engage community with rewards |
| 🐛 **Bug Bounties** | Incentivize security research |

## Project Structure

```
solana-contest-platform/
├── programs/
│   └── solana-contest-platform/
│       ├── src/
│       │   ├── lib.rs                          # Program entry point
│       │   ├── errors.rs                       # Error codes
│       │   ├── state/                          # Account structures
│       │   │   ├── mod.rs
│       │   │   ├── contest.rs                  # Contest account + status enum
│       │   │   ├── submission.rs               # Submission account
│       │   │   └── vote.rs                     # Judge vote account
│       │   └── instructions/                   # Instruction handlers
│       │       ├── mod.rs
│       │       ├── create_contest.rs           # Create new contest
│       │       ├── fund_contest.rs             # Fund escrow
│       │       ├── enable_gas_sponsorship.rs   # Enable gas subsidy
│       │       ├── submit_entry.rs             # Submit entry
│       │       ├── update_submission.rs        # Update entry
│       │       ├── judge_vote.rs               # Judge votes
│       │       ├── distribute_prizes.rs        # Distribute winnings
│       │       └── reclaim_funds.rs            # Reclaim expired funds
│       └── Cargo.toml
├── tests/
│   └── solana-contest-platform.ts              # Integration tests
├── migrations/
│   └── deploy.ts                                # Deployment script
├── target/
│   └── deploy/
│       ├── solarena.so                          # Compiled program
│       └── solarena-keypair.json                # Program keypair
├── Anchor.toml                                  # Anchor configuration
├── Cargo.toml                                   # Workspace configuration
├── package.json                                 # Node dependencies
└── README.md                                    # This file
```

### Modular Architecture Benefits

- **Clean Separation**: State, instructions, and errors are in separate modules
- **Easy Navigation**: Find any functionality quickly
- **Maintainable**: Change one instruction without affecting others
- **Testable**: Each module can be tested independently
- **Scalable**: Add new instructions or accounts easily

## Development

### Prerequisites

- Rust 1.70+
- Solana CLI 1.18+
- Anchor 0.32.1+
- Node.js 16+
- Yarn

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/meowyx/solana-contest-platform
cd solana-contest-platform
```

2. **Install dependencies**
```bash
yarn install
```

3. **Build the program**
```bash
anchor build
```

4. **Run tests**
```bash
anchor test
```

### Deploying

**Localnet:**
```bash
# Start local validator
solana-test-validator

# Deploy
anchor deploy
```

**Devnet:**
```bash
# Update Anchor.toml cluster to devnet
anchor deploy --provider.cluster devnet
```

**Mainnet:**
```bash
# Update Anchor.toml cluster to mainnet
anchor deploy --provider.cluster mainnet
```

## Configuration

Key parameters in the program:

- **Max Judges**: 5
- **Max Title Length**: 100 characters
- **Max Description**: 500 characters
- **Max Submission URL**: 200 characters
- **Minimum Prize**: 0.01 SOL (10,000,000 lamports)
- **Reclaim Period**: 30 days after deadline

## Testing

Run the test suite:

```bash
# Run all tests
anchor test

# Run specific test file
anchor test --skip-local-validator
```

## Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 6000 | `TitleTooLong` | Title exceeds 100 characters |
| 6001 | `DescriptionTooLong` | Description exceeds 500 characters |
| 6002 | `TooManyJudges` | More than 5 judges specified |
| 6003 | `NoJudges` | No judges specified |
| 6004 | `InvalidThreshold` | Approval threshold exceeds judge count |
| 6005 | `PrizeTooLow` | Prize below minimum (0.01 SOL) |
| 6006 | `InvalidDeadline` | Deadline is not in the future |
| 6007 | `InvalidContestState` | Operation not allowed in current state |
| 6008 | `AlreadyFunded` | Contest already funded |
| 6009 | `UrlTooLong` | URL exceeds 200 characters |
| 6010 | `InvalidUrl` | URL must start with https:// |
| 6011 | `SubmissionDeadlinePassed` | Cannot submit after deadline |
| 6012 | `UnauthorizedParticipant` | Not the original submitter |
| 6013 | `UnauthorizedCreator` | Not the contest creator |
| 6014 | `UnauthorizedJudge` | Not an authorized judge |
| 6015 | `SubmissionPeriodNotEnded` | Cannot judge before deadline |
| 6016 | `ContestNotFunded` | Contest not funded |
| 6017 | `ConsensusNotReached` | Insufficient votes for winner |
| 6018 | `ContestAlreadyCompleted` | Contest already completed |
| 6019 | `ReclaimPeriodNotReached` | Must wait 30 days after deadline |

## Technical Stack

- **Framework**: Anchor 0.32.1
- **Language**: Rust
- **Platform**: Solana
- **Dependencies**:
  - anchor-lang 0.32.1
  - anchor-spl 0.32.1
  - solana-program 2.3.0

## Project Statistics

- **Instructions**: 8
- **Account Types**: 3 (Contest, Submission, JudgeVoteAccount)
- **PDA Types**: 5
- **Lines of Code**: ~870
- **Compiled Size**: ~367 KB

## Roadmap

- [ ] SPL Token support for prizes
- [ ] Multiple prize tiers (1st, 2nd, 3rd place)
- [ ] NFT prizes
- [ ] Submission metadata (images, descriptions)
- [ ] On-chain reputation system for judges
- [ ] Contest templates
- [ ] Frontend application

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request






