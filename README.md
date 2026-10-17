# MINEBREAK

<p align="center">
  <strong> A tactical duel. A game where the outcome can be independently verified.</strong>
</p>

<p align="center">
  <a href="https://minebreak.vercel.app">Live Demo</a> ·
  <a href="https://github.com/vaibhavi-0320/Minebreak">Repository</a> ·
  <a href="#smart-contract-and-deployment">Contract Details</a> ·
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-Frontend-646CFF?style=flat-square&logo=vite&logoColor=white">
  <img alt="Solidity" src="https://img.shields.io/badge/Solidity-0.8.24-363636?style=flat-square&logo=solidity">
  <img alt="Ethereum Sepolia" src="https://img.shields.io/badge/Network-Sepolia-6F5BA7?style=flat-square&logo=ethereum&logoColor=white">
  <img alt="Status" src="https://img.shields.io/badge/Status-Work%20in%20Progress-orange?style=flat-square">
</p>

---

## Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [The Idea](#the-idea)
- [Vision and Potential](#vision-and-potential)
- [Game Modes](#game-modes)
- [How the On-Chain Duel Is Designed to Work](#how-the-on-chain-duel-is-designed-to-work)
- [Commit-Reveal: Why It Matters](#commit-reveal-why-it-matters)
- [Smart Contract and Deployment](#smart-contract-and-deployment)
- [Contract Address](#contract-address)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the Smart Contract Tooling](#running-the-smart-contract-tooling)
- [Deploying to Sepolia](#deploying-to-sepolia)
- [Deploying the Frontend](#deploying-the-frontend)
- [Current Status and Limitations](#current-status-and-limitations)
- [Security Considerations](#security-considerations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**MINEBREAK** is a browser-based voxel game concept combining atmospheric PvE exploration with a competitive, two-player PvP mode called **Vault Duels**.

The project explores how blockchain infrastructure can support competitive gameplay where the rules, match progression, and prize settlement can be checked against a smart contract instead of relying entirely on a central game server. The game uses a Solidity contract called `VaultBreak` to model a tactical duel built around three moves: **ATTACK**, **SHIELD**, and **SCAN**.

The browser experience is built with React, TypeScript, Three.js through React Three Fiber, and a lightweight state store. The blockchain tooling uses Solidity, Hardhat, and ethers.js.

> **Development status:** This repository is a work in progress. The game interface and smart-contract design are present, but end-to-end on-chain match transactions are not yet reliably completing in the current build. Treat live PvP, testnet settlement, and wallet-to-contract flows as experimental until they have been verified end to end.

## The Problem

Many multiplayer games rely on a private backend to decide match state, winners, scores, and rewards. This can work well, but players generally have limited independent visibility into the logic that determines competitive outcomes.

Potential issues include:

- **Opaque outcomes:** players may have to trust a server's account of how a match was resolved.
- **Move timing and information leaks:** if a game reveals one player's choice before the other player has committed, the second player may gain an unfair advantage.
- **Unclear prize settlement:** players need a verifiable explanation of how a match prize is calculated and paid.
- **Centralized records:** match history and leaderboard claims can be difficult for players to independently audit.
- **Disconnects and stalled matches:** games need explicit rules for what happens when a player stops responding.

Blockchain does not automatically solve every fairness problem. It does, however, provide a shared execution environment where selected rules and state transitions can be inspected, and where events can form an auditable history.

## The Idea

MINEBREAK investigates a hybrid model:

- The **game client** provides the visual world, interaction, animation, and player experience.
- The **smart contract** is intended to govern important PvP actions such as creating and joining a duel, committing hidden moves, revealing those moves, resolving rounds, handling timeouts, and accounting for withdrawals.
- The **wallet** allows a player to authorize blockchain transactions.
- **On-chain events and match state** can provide evidence for a match receipt and history view.

The goal is not to put every frame of a 3D game on-chain. Real-time movement, rendering, collision, audio, and ordinary PvE behaviour belong in the client. Blockchain is reserved for specific competitive actions where transparent rules and settlement are useful.

## Vision and Potential

MINEBREAK is a prototype for exploring more transparent competitive games. If the transaction flow and security model are completed and tested, the design could be extended in several directions:

### Verifiable competitive matches

Players could inspect contract state and emitted events to confirm how a duel progressed, which moves were revealed, and which player was recorded as the winner.

### Hidden simultaneous choices

A commit-reveal system can reduce the risk of one player simply waiting to see the opponent's move before choosing their own. Each player first submits a hash commitment, then reveals the move and salt that reproduce it.

### Player-controlled stakes

The contract supports an optional stake model in which players join at a matching amount. The intended design credits the winner with a claimable balance rather than sending funds through an arbitrary external call during round resolution.

### Auditable match receipts

A match receipt page can gather the game identifier, player addresses, round outcomes, final score, transaction references, and winner. The receipt should be populated from verified chain data rather than generated only from local browser state.

### Extensible game systems

The same principles may be useful for tournaments, on-chain leaderboards, skill challenges, player-hosted matches, community events, and digital rewards. Any extension would need its own economic and security review before real-value use.

These are **potential directions**, not claims that every feature is currently production-ready.

## Game Modes

### PvE: Exploration

The project includes a browser-native voxel environment intended for solo exploration and action-oriented gameplay. Three-dimensional visuals, the environment, player controls, and game feedback are client-side.

The PvE experience is separate from the duel contract. Ordinary exploration does not need a blockchain transaction for every movement or interaction.

### Mine//BREAK: Vault Duels

Vault Duels is the competitive mode designed around the `VaultBreak.sol` smart contract.

The core tactical loop uses three choices:

| Move | Intended interaction |
|---|---|
| **ATTACK** | Beats SCAN |
| **SHIELD** | Beats ATTACK |
| **SCAN** | Beats SHIELD |

When both players choose the same move, the round is a draw. A non-draw round awards one point to the winning player. The intended match target is **three round points**.

The contract design includes free matches and optional ETH stakes. The UI may offer stake presets such as 0, 0.0005 ETH, and 0.001 ETH, but stake-based matches should only be used on a test network after the deployment and settlement flow has been verified. Testnet ETH has no intended real-world value, but transactions are still irreversible on their network.

## How the On-Chain Duel Is Designed to Work

The intended lifecycle is:

1. **Connect a wallet.** A player connects a compatible EVM wallet and switches to the selected development network.
2. **Create a duel.** The creator calls `createGame()`, optionally sending the chosen stake.
3. **Join the duel.** A second, distinct wallet calls `joinGame(gameId)` with the exact matching stake.
4. **Commit a move.** Each player chooses a move and a fresh random salt. The client calculates the commitment for that game, round, player, and network context. Only the commitment hash is submitted.
5. **Wait for both commitments.** The contract moves to the reveal phase once both players have committed.
6. **Reveal the move.** Each player submits their chosen move and salt using `revealMove()`. The contract recomputes the commitment and checks that it matches.
7. **Resolve the round.** Once both reveals are accepted, the contract evaluates the move relationship and updates the score.
8. **Continue or finish.** If neither player reaches three points, the next round begins. Otherwise the game is marked finished and the winner is recorded.
9. **Claim pending funds.** For a staked match, winnings are credited to the winner's pending balance. The winner calls `withdraw()` to claim it.
10. **Inspect match history.** Contract state and emitted events can be used to build a match receipt.

This is the **designed contract flow**. The current application does not yet reliably complete all of these steps through real wallet transactions, so do not assume an on-screen action means an on-chain transaction succeeded. Always check the wallet prompt, transaction receipt, network, contract address, and explorer state.

## Commit-Reveal: Why It Matters

If moves were submitted as plain public values, another player could potentially wait for the first player's transaction to become visible and then respond strategically. Commit-reveal separates choosing a move from disclosing it.

### Commit phase

The client chooses a move and generates a secret salt. It hashes the match context and secret choice into a commitment:

```text
commitment = keccak256(
  abi.encode(
    contractAddress,
    chainId,
    gameId,
    round,
    playerAddress,
    move,
    salt
  )
)
```

The commitment is submitted first. It should not reveal the actual move.

### Reveal phase

Once both commitments exist, each player reveals their move and salt. The contract rebuilds the hash and checks it against the stored commitment. A reveal fails if the values do not match.

### Security properties and caveats

- A player cannot change a committed move without producing a different hash.
- Including the contract address, chain ID, game ID, round, player address, move, and salt binds the commitment to its context.
- The salt should be generated with a cryptographically secure random source and stored reliably until the reveal transaction succeeds.
- Commit-reveal does not eliminate all possible exploits. Timeout handling, reveal availability, transaction censorship, front-running, economic griefing, and client-side secret loss still need careful treatment and testing.
- A commitment is only as reliable as the implementation used to produce and verify it. Frontend and Solidity hashing must match exactly.

## Smart Contract and Deployment

The primary contract is `chain/contracts/VaultBreak.sol`.

It models:

| Contract component | Purpose |
|---|---|
| `createGame()` | Creates a waiting duel and records an optional stake |
| `joinGame(gameId)` | Allows a second wallet to join with a matching stake |
| `commitMove(gameId, commitment)` | Stores a player's commitment for the current round |
| `revealMove(gameId, move, salt)` | Checks the reveal and resolves a round when both players reveal |
| `claimTimeout(gameId)` | Handles configured commit/reveal timeout outcomes |
| `cancelGame(gameId)` | Lets the creator cancel a duel while it is still waiting |
| `withdraw()` | Withdraws funds from a player's pending balance |
| `getGame(gameId)` | Reads public game summary state |
| `getRoundState(gameId)` | Reads commitment/reveal status and the most recent round result |
| `computeCommitment(...)` | Computes the expected commitment for a given context |
| `wins(address)` / `played(address)` | Tracks match outcomes per address |

The contract also emits events for game creation, joining, commitments, reveals, round resolution, completion, timeout claims, cancellation, and withdrawals. These events can support indexing and a match history interface.

**Important:** a source file existing in a repository is not evidence that its contract is deployed. Similarly, an ABI file can contain a local development deployment and does not prove that an address exists on Sepolia.

## Contract Address

Update this section when a successful deployment has been confirmed on the intended network. Do not copy the local Hardhat address into the Sepolia field.

| Property | Value |
|---|---|
| Contract name | `VaultBreak` |
| Source | [`chain/contracts/VaultBreak.sol`](chain/contracts/VaultBreak.sol) |
| Target network | Ethereum Sepolia |
| Chain ID | `11155111` |
| **Sepolia contract address** | **`NOT DEPLOYED / NOT VERIFIED`** |
| Deployment transaction | `ADD_DEPLOYMENT_TRANSACTION_HASH` |
| Deployment block | `ADD_DEPLOYMENT_BLOCK_NUMBER` |
| Sepolia explorer | [Search contract on Etherscan](https://sepolia.etherscan.io/) |

### Local Hardhat address

The checked-in deployment metadata currently records a local Hardhat address for chain ID `31337`:

```text
0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690
```

This address is local-development metadata only. It is not the Sepolia contract address and is not usable on Sepolia.

After deploying to Sepolia, verify the contract address and transaction hash using the deployment output and a Sepolia explorer. The deployment script is designed to write the address and deployment block to `src/duel/contract/VaultBreak.json`. Review the resulting changes before committing them.

## Technology Stack

### Frontend and 3D rendering

- **React 19** for the UI and component system.
- **TypeScript** for typed application logic.
- **Vite** for development and production builds.
- **Three.js** and **React Three Fiber** for browser-native 3D rendering.
- **Drei** for reusable helpers for React Three Fiber.
- **Rapier** for physics integration.
- **Zustand** for lightweight client state.
- **ethers.js v6** for EVM wallet and contract interaction.

### Smart contracts

- **Solidity `^0.8.24`** for the duel rules and accounting.
- **Hardhat 2** for local EVM development, compilation, tests, and deployment scripts.
- **Chai and Hardhat matchers** for contract assertions.
- **Ethereum Sepolia** for public testnet deployment.
- **Hardhat Network** for local development on chain ID `31337`.

## Architecture

```text
┌──────────────────────────────────────────────┐
│                 Browser Client               │
│ React · TypeScript · Vite                    │
│ 3D world · UI · animations · player controls │
└──────────────────────┬───────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
┌──────────────────────┐   ┌─────────────────────┐
│ Client Game State    │   │ EVM Wallet          │
│ PvE / visual state   │   │ Connect / sign      │
│ Duel presentation    │   │ Approve transactions│
└──────────────────────┘   └──────────┬──────────┘
                                      │ ethers.js
                                      ▼
                           ┌─────────────────────┐
                           │ VaultBreak Contract │
                           │ Solidity            │
                           │ Game phases         │
                           │ Commit / reveal     │
                           │ Score / timeouts    │
                           │ Pending withdrawals │
                           └──────────┬──────────┘
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │ Hardhat Local or    │
                           │ Ethereum Sepolia    │
                           │ Transactions/events │
                           └─────────────────────┘
```

The frontend is responsible for the experience and transaction requests. The contract is intended to be authoritative for the state of a blockchain-based duel. A production-quality integration must reconcile pending browser state with confirmed contract reads and transaction receipts, rather than optimistically treating a click as a successful match action.

## Repository Structure

```text
Minebreak/
├── chain/
│   ├── contracts/
│   │   └── VaultBreak.sol          # Solidity commit-reveal duel contract
│   ├── scripts/
│   │   ├── deploy.js               # Local and Sepolia deployment
│   │   ├── demo.js                 # Local match demonstration
│   │   └── testStage4.js           # Additional duel verification script
│   ├── shared/
│   │   └── commitment.js           # Shared commitment helpers
│   ├── test/
│   │   └── VaultBreak.test.js      # Contract tests
│   ├── hardhat.config.js           # Hardhat network/compiler configuration
│   ├── .env.example                # Chain deployment environment template
│   └── package.json                # Smart-contract scripts and dependencies
├── src/
│   ├── animation/                  # Character animation and movement
│   ├── components/                 # World, terrain, lighting, and player
│   ├── duel/
│   │   ├── components/             # Duel lobby, arena, wallet and receipt UI
│   │   ├── contract/
│   │   │   └── VaultBreak.json     # ABI and deployment metadata
│   │   ├── commitment.ts           # Client-side commitment and salt helpers
│   │   ├── contractClient.ts       # ethers contract interaction layer
│   │   ├── duelStore.ts             # Duel state management
│   │   ├── networks.ts              # Supported network configuration
│   │   ├── types.ts                 # Move, phase, and game types
│   │   └── wallet.ts                # EVM wallet integration
│   ├── meshes/                     # Procedural voxel models and props
│   ├── ui/                         # HUD and gameplay UI
│   ├── App.tsx                     # App root and routes
│   └── main.tsx                    # React entry point
├── public/                         # Static public assets
├── tools/                          # Asset and audio generation utilities
├── .env.example                    # Frontend environment template
├── vercel.json                     # Vercel SPA routing
├── package.json                    # Frontend and workspace scripts
└── README.md
```

Some paths may evolve during development. Consult the repository tree if a local file differs from this overview.

## Getting Started

### Prerequisites

Install the following before starting:

- **Node.js**: a version compatible with the Vite version and dependencies in this repository.
- **npm**: included with Node.js.
- **Git**: to clone the repository.
- **MetaMask or another injected EVM wallet**: needed for browser wallet interactions.
- **Sepolia test ETH**: only needed for public testnet transactions.
- **Hardhat local node**: recommended for contract development without spending testnet funds.

Check your installed versions:

```bash
node --version
npm --version
git --version
```

### 1. Clone the repository

```bash
git clone https://github.com/vaibhavi-0320/Minebreak.git
cd Minebreak
```

### 2. Install dependencies

Install the frontend dependencies from the project root and the contract dependencies in the `chain` directory:

```bash
npm install
npm --prefix chain install
```

### 3. Start the frontend

```bash
npm run dev
```

Open [http://localhost:2035](http://localhost:2035).

The frontend can be explored independently of a successful contract deployment, but on-chain duel actions may not work until the wallet, network, ABI, address, and contract calls have all been configured and tested.

## Environment Variables

### Frontend: root `.env`

Start from the included template:

```bash
cp .env.example .env
```

The checked-in example contains:

```dotenv
VITE_DEFAULT_CHAIN_ID=11155111
VITE_SEPOLIA_RPC_URL=https://rpc.sepolia.org
```

- `VITE_DEFAULT_CHAIN_ID`: the EVM chain ID the app should prefer. Use `11155111` for Sepolia or `31337` for a local Hardhat chain.
- `VITE_SEPOLIA_RPC_URL`: a public read-only RPC endpoint for Sepolia reads. Public RPC endpoints may have rate limits or availability issues.

Vite exposes variables prefixed with `VITE_` to browser code. **Never put a private key, seed phrase, or other secret in the frontend environment file.**

### Smart contract: `chain/.env`

Copy the chain template:

```bash
cp chain/.env.example chain/.env
```

Set the deployment values locally:

```dotenv
SEPOLIA_RPC_URL=YOUR_SEPOLIA_RPC_URL
DEPLOYER_PRIVATE_KEY=0xYOUR_TEST_WALLET_PRIVATE_KEY
```

Use a dedicated test wallet with no valuable assets. Do not commit `chain/.env`, private keys, seed phrases, wallet exports, or funded account credentials.

## Running the Smart Contract Tooling

Run these commands from the repository root.

### Compile

```bash
npm run chain:compile
```

### Run contract tests

```bash
npm run chain:test
```

Tests are important evidence about contract behaviour, but passing local tests does not establish that the browser integration, Sepolia deployment, or wallet transactions work end to end.

### Start a local Hardhat node

Open a terminal and run:

```bash
npm run chain:node
```

Leave this process running. In another terminal, deploy to the local node:

```bash
npm run chain:deploy:local
```

The deployment script writes the local contract address and deployment block into `src/duel/contract/VaultBreak.json`. Since a local node may reset when restarted, its deployment address should not be treated as persistent.

### Run the local demonstration

```bash
npm run chain:demo
```

The demo script is intended for local contract flow demonstration. Inspect its output and transaction receipts to confirm which stages it completes.

## Deploying to Sepolia

**Only proceed after local compilation and tests have been run.** Use a dedicated testnet wallet.

1. Create `chain/.env` using the template shown above.
2. Ensure the RPC endpoint points to Ethereum Sepolia.
3. Confirm that the wallet's private key is for a disposable test wallet.
4. Obtain Sepolia test ETH from a reputable faucet.
5. Run:

```bash
npm run chain:deploy:sepolia
```

6. Record the output contract address, deployment transaction hash, and deployment block.
7. Open the deployment transaction in [Sepolia Etherscan](https://sepolia.etherscan.io/) and confirm it succeeded.
8. Verify that the address shown in this README, the frontend deployment metadata, and the wallet's selected network all refer to the same deployment.
9. Test the full flow with two separate test wallets: create, join, commit, reveal, resolve, timeout where appropriate, and withdraw.
10. Update the [Contract Address](#contract-address) table only after the deployment has been verified.

Never publish the private key or commit your `.env` file. Do not make a testnet address look like a mainnet deployment.

## Deploying the Frontend

The repository includes a Vercel configuration for a Vite single-page application.

1. Push the project to GitHub.
2. Import the repository in Vercel.
3. Confirm the build command is `npm run build`.
4. Confirm the output directory is `dist`.
5. Add only the necessary public frontend environment variables in Vercel project settings.
6. Deploy the site and open its live URL.
7. Verify client-side routing, wallet connection, network switching, and every on-chain action against the deployed contract.

The current public URL listed for the project is [minebreak.vercel.app](https://minebreak.vercel.app). Availability of a live page does not guarantee that its on-chain transaction flow is complete.

## Current Status and Limitations

This project is actively being developed. The repository includes a game UI, Solidity contract source, Hardhat tooling, and a frontend contract integration layer. **Real contract transactions are currently not reliably completing end to end.**

| Area | Current status |
|---|---|
| Browser-based voxel game and UI | Present in the codebase; continue to test across browsers and devices |
| Solidity duel rules | Implemented in source; requires ongoing review and tests |
| Local Hardhat setup | Tooling and scripts are included |
| Sepolia deployment | No verified Sepolia address is currently recorded in this README |
| Wallet-to-contract transaction flow | In progress; not reliably completing end to end |
| Commit and reveal lifecycle through the browser | Requires complete end-to-end verification |
| Prize withdrawal using a public testnet deployment | Do not treat as verified until tested with receipts |
| Public production readiness | Not production-ready |

This status section is deliberately explicit. Do not represent an intended feature as complete merely because the interface or contract function exists.

## Security Considerations

MINEBREAK is a prototype and has not been represented as independently audited. Do not use it to hold valuable assets or real-money stakes.

Before considering any production deployment, review and test at least the following:

- **Contract audit:** inspect access control, phase transitions, scoring, cancellation, stake accounting, timeout cases, and withdrawal logic.
- **Commitment consistency:** prove that frontend and contract hashing use the same field order, ABI encoding, enum values, chain ID, contract address, and salt.
- **Salt persistence:** make sure a player can recover the exact move and salt needed to reveal after a page refresh or browser crash, without exposing them to the opponent.
- **Transaction state:** distinguish wallet rejection, pending transactions, reverted transactions, confirmed transactions, and indexer lag.
- **Timeout incentives:** assess griefing and edge cases when players stall or when both players miss a deadline.
- **Funds accounting:** test refunds, tied or stalled matches, winner payouts, repeated withdrawals, and failed external transfers.
- **Network correctness:** prevent a local ABI/address pairing from being used against Sepolia or another unsupported network.
- **RPC reliability:** handle rate limits, provider failures, and stale reads.
- **Frontend trust boundaries:** do not rely on client-side score, winner, or transaction status as authoritative.
- **Testing:** cover normal paths, invalid inputs, duplicate calls, every phase transition, and adversarial sequences with automated tests.

Use test networks and disposable wallets while this work is ongoing. A smart contract deployment is generally immutable unless upgrade mechanisms were designed into it, so deployment should follow thorough testing.

## Roadmap

The following is a development plan rather than a claim that the listed work is already complete.

- [x] Build the initial browser game structure and voxel-oriented visual experience.
- [x] Add a Solidity contract model for two-player commit-reveal duels.
- [x] Add Hardhat compile, deployment, and test tooling.
- [x] Add frontend contract client and wallet integration scaffolding.
- [ ] Diagnose and fix the end-to-end transaction execution path.
- [ ] Confirm wallet connection and network switching on the supported browser/wallet combinations.
- [ ] Complete and verify a full two-player local match using separate signers.
- [ ] Verify the commit/reveal hash parity between client and contract.
- [ ] Deploy to Sepolia and publish the verified contract address and transaction.
- [ ] Confirm public testnet game creation, joining, round resolution, timeout handling, and withdrawals.
- [ ] Ensure match history and receipts are backed by confirmed on-chain data.
- [ ] Add integration tests for frontend-to-contract behaviour.
- [ ] Perform a focused security review before considering real-value assets.

## Contributing

Contributions, bug reports, and suggestions are welcome.

When reporting a transaction issue, include the development environment, selected chain ID, browser and wallet, contract address (never the private key), failing action, and sanitized error message. If available, include the transaction hash and relevant console logs.

For changes to contract logic, include tests for successful execution and the expected revert cases. Avoid including private keys, seed phrases, wallet backup data, or secrets in issues and pull requests.

## License

A license file was not verified during preparation of this README. Add a suitable `LICENSE` file and update this section before treating the repository as officially licensed for reuse.

---

<p align="center">
  <strong>MINEBREAK</strong><br>
  <em>Explore the world. Outsmart your opponent. Verify the result.</em>
</p>
