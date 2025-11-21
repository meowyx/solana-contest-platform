# SolArena Architecture Diagrams (Updated)

These diagrams reflect the actual implementation of the SolArena contest platform.

---

## 1. Main Architecture

```mermaid
flowchart TB
    subgraph Users
        CC[Contest Creator]
        J[Judge]
        P[Participant]
    end

    subgraph "SolArena Program<br/>(Single Unified Program)"
        direction TB
        CM[Contest Module<br/>• create_contest<br/>• fund_contest<br/>• reclaim_funds]
        JM[Judging Module<br/>• judge_vote<br/>• distribute_prizes]
        SM[Submission Module<br/>• submit_entry<br/>• update_submission<br/>• enable_gas_sponsorship]
    end

    subgraph "On-Chain Accounts (PDAs)"
        CA[Contest PDA<br/>Prize, Judges, Deadline, Status]
        EA[Escrow PDA<br/>Locked SOL]
        SA[Submission PDA<br/>Entry URLs]
        VA[Vote PDA<br/>Judge Votes]
        GP[Gas Pool PDA<br/>Sponsored Fees]
    end

    CC -->|Create & Fund| CM
    J -->|Vote| JM
    P -->|Submit Entry| SM

    CM --> CA
    CM --> EA
    SM --> SA
    SM --> GP
    JM --> VA

    JM -->|Direct Lamport Transfer| P

    style CM fill:#87CEEB
    style JM fill:#87CEEB
    style SM fill:#87CEEB
```

---

## 2. System Interactions (No Oracle)

```mermaid
flowchart LR
    subgraph "SolArena Program"
        SA[SolArena]
    end

    subgraph "Solana Native"
        SP[System Program<br/>• Creates PDAs<br/>• Account allocation]
        CS[Clock Sysvar<br/>• Timestamps]
    end

    SA -->|init accounts| SP
    SA -->|get timestamp| CS

    style SA fill:#87CEEB
    style SP fill:#FFE4B5
    style CS fill:#FFE4B5
```

**Key Difference from Old Diagram:**
- **No Switchboard Oracle** - Prizes are stored in fixed SOL (lamports), not USD
- **Direct lamport transfers** - Prize distribution uses `try_borrow_mut_lamports()`, not System Program transfer CPI

---

## 3. Judging Flow

```mermaid
flowchart TD
    A[Contest Deadline Reached<br/>Submissions Closed] --> B[Judges Review Entries<br/>Off-Chain Evaluation]

    B --> C1[Judge 1 Votes On-Chain]
    B --> C2[Judge 2 Votes On-Chain]
    B --> C3[Judge 3 Votes On-Chain]

    C1 --> D[Count Votes<br/>Check for Consensus]
    C2 --> D
    C3 --> D

    D --> E{Enough Votes?<br/>e.g., 2 of 3}

    E -->|No| F[Wait for More Votes]
    E -->|Yes| G[Consensus Reached<br/>Winner Determined]

    G --> H[Transfer SOL from Escrow<br/>Direct Lamport Manipulation]

    H --> I[Contest Complete<br/>Status: Completed]

    style A fill:#FFF9C4
    style B fill:#87CEEB
    style D fill:#E1BEE7
    style G fill:#C8E6C9
    style H fill:#B2DFDB
    style I fill:#FFF9C4
```

**Key Differences from Old Diagram:**
- **No Switchboard price query** - Prize is fixed in lamports
- **No price calculation** - Prize distributed as stored
- Votes counted dynamically from `remaining_accounts`

---

## 4. PDA Relationships

```mermaid
flowchart TD
    subgraph Inputs
        CID[Contest ID<br/>u64]
        CW[Creator Wallet<br/>Pubkey]
        PW[Participant Wallet<br/>Pubkey]
        JW[Judge Wallet<br/>Pubkey]
    end

    subgraph "Why PDAs?"
        INFO[Deterministic: Same seeds = Same address<br/>Secure: No private keys to steal<br/>Unique: One submission per user per contest]
    end

    CID --> CPDA
    CW --> CPDA

    CPDA[Contest PDA<br/>Seeds: 'contest' + creator + contest_id<br/>Stores: Prize, Judges, Deadline, Status]

    CPDA --> EPDA[Escrow PDA<br/>Seeds: 'escrow' + creator + contest_id<br/>Holds: Prize SOL]

    PW --> SPDA
    CPDA --> SPDA[Submission PDA<br/>Seeds: 'submission' + contest + participant<br/>Stores: Entry URL]

    JW --> VPDA
    CPDA --> VPDA[Vote PDA<br/>Seeds: 'vote' + contest + judge<br/>Stores: Winner Choice]

    CPDA --> GPPDA[Gas Pool PDA<br/>Seeds: 'gas_pool' + contest<br/>Holds: Sponsored Fees]

    style CPDA fill:#87CEEB
    style EPDA fill:#98FB98
    style SPDA fill:#87CEEB
    style VPDA fill:#DDA0DD
    style GPPDA fill:#FFE4B5
```

**Key Difference from Old Diagram:**
- **No Consensus PDA** - Votes are counted dynamically from individual Vote PDAs
- Added **Gas Pool PDA**

---

## 5. Participant Submission Flow

```mermaid
flowchart TD
    A[Participant Browses Contests] --> B[Select Contest<br/>View Prize and Deadline]

    B --> C[Complete Work<br/>Code, Design, Content]

    C --> D[Upload to GitHub/IPFS<br/>Get HTTPS URL]

    D --> E{Has SOL for<br/>Gas Fee?}

    E -->|Yes| F[Participant Pays Fee<br/>~0.000005 SOL]
    E -->|No| G{Contest Has<br/>Gas Sponsorship?}

    G -->|Yes| H[Gas Pool Pays Fee<br/>FREE for Participant]
    G -->|No| I[Cannot Submit<br/>Need SOL]

    F --> J[Entry Recorded On-Chain<br/>Submission PDA Created]
    H --> J

    J --> K[Submission Complete<br/>Wait for Judging]

    J --> L{Need to Update?}
    L -->|Yes, Before Deadline| M[update_submission<br/>Modify URL]
    M --> K

    style A fill:#FFF9C4
    style B fill:#87CEEB
    style H fill:#C8E6C9
    style I fill:#FFCDD2
    style J fill:#B2DFDB
    style K fill:#FFF9C4
```

---

## 6. Contest Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Setup: create_contest()

    Setup --> Active: fund_contest()
    Setup --> Cancelled: reclaim_funds()<br/>(after 30 days)

    Active --> Active: submit_entry()<br/>judge_vote()
    Active --> Completed: distribute_prizes()<br/>(consensus reached)
    Active --> Cancelled: reclaim_funds()<br/>(after 30 days)

    Completed --> [*]
    Cancelled --> [*]
```

---

## 7. Account Data Structures

### Contest PDA
```
┌─────────────────────────────────┐
│ Contest Account (~853 bytes)    │
├─────────────────────────────────┤
│ creator: Pubkey (32)            │
│ contest_id: u64 (8)             │
│ title: String (max 100)         │
│ description: String (max 500)   │
│ prize_amount: u64 (8)           │
│ submission_deadline: i64 (8)    │
│ judges: Vec<Pubkey> (max 5)     │
│ approval_threshold: u8 (1)      │
│ status: ContestStatus (1)       │
│ submission_count: u32 (4)       │
│ created_at: i64 (8)             │
│ gas_sponsorship_enabled: bool   │
│ funded: bool (1)                │
│ bump: u8 (1)                    │
└─────────────────────────────────┘
```

### Submission PDA
```
┌─────────────────────────────────┐
│ Submission Account              │
├─────────────────────────────────┤
│ participant: Pubkey (32)        │
│ contest: Pubkey (32)            │
│ submission_url: String (max 200)│
│ submitted_at: i64 (8)           │
│ last_modified: i64 (8)          │
│ bump: u8 (1)                    │
└─────────────────────────────────┘
```

### Vote PDA
```
┌─────────────────────────────────┐
│ JudgeVoteAccount                │
├─────────────────────────────────┤
│ judge: Pubkey (32)              │
│ contest: Pubkey (32)            │
│ winner: Pubkey (32)             │
│ voted_at: i64 (8)               │
│ bump: u8 (1)                    │
└─────────────────────────────────┘
```

---

## Summary of Changes from Old Diagrams

| Old Diagram | What Changed |
|-------------|--------------|
| 3 Separate Programs | **1 Unified SolArena Program** |
| Switchboard Oracle for USD price | **No Oracle - Fixed SOL prizes** |
| System Program transfers | **Direct lamport manipulation** |
| Consensus PDA | **No Consensus PDA - Dynamic vote counting** |
| Implied gas sponsorship | **Explicit Gas Pool PDA** |

---

## How to Render These Diagrams

1. **Mermaid Live Editor**: https://mermaid.live
2. **VS Code**: Install "Mermaid Preview" extension
3. **GitHub**: Mermaid is natively supported in markdown
4. **Export to PNG/SVG**: Use Mermaid CLI or online tools
