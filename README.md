# MINEBREAK (Embervale + Vault Duel)

A browser-native voxel game featuring both cozy PvE exploration and real-time on-chain PvP **Vault Duels** backed by an Ethereum Solidity commit-reveal smart contract.

---

## Game Modes

### 1. Embervale (PvE Campaign)
- Cozy angled top-down voxel meadow with trees, cottage, shrines, and lanterns.
- Two-handed greatsword combat with openers and 4-hit combo routes.
- Wave survival against Moss Slimes, Caplings, Ember Imps, and the Grove Tyrant.

### 2. VAULT // BREAK (PvP Commit-Reveal Duels)
- Two-player tactical vault duels backed by the `VaultBreak.sol` smart contract on **Ethereum Sepolia** (and local dev on Hardhat).
- Optional testnet stakes: **Free**, **0.0005 ETH**, or **0.001 ETH**.
- Cryptographic commit-reveal scheme:
  - **Move 1: ATTACK** (Breaches Scan)
  - **Move 2: SHIELD** (Absorbs Attack)
  - **Move 3: SCAN** (Bypasses Shield)
- First player to **3 points** wins the match and claims the prize pot.
- Anti-stall timeout protection and pull-payment withdrawal security.
- Interactive 3D duel arena with rigged voxel characters reacting to round outcomes.
- Full cryptographic Match Receipt audit trail at `/match/:gameId`.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite 8, React Three Fiber (R3F), Drei, Rapier 3D physics, Zustand, ethers.js v6.
- **Smart Contracts**: Solidity ^0.8.24 (`viaIR: true`), Hardhat 2, Chai matchers.
- **Target Networks**: Ethereum Sepolia (`chainId: 11155111`) and Hardhat Local (`chainId: 31337`).

---

## Project Structure

```text
embervale/
├── chain/                       # Smart contracts and tooling
│   ├── contracts/
│   │   └── VaultBreak.sol       # Commit-reveal duel contract
│   ├── scripts/
│   │   ├── deploy.js            # Multi-chain deployment script
│   │   ├── demo.js              # Full match demo & withdrawal script
│   │   └── testStage4.js        # Stage 4 duel verification script
│   ├── shared/
│   │   └── commitment.js        # Parity cryptographic commitment helpers
│   ├── test/
│   │   └── VaultBreak.test.js   # 34 comprehensive unit tests
│   ├── hardhat.config.js        # Hardhat config with Sepolia guards
│   ├── .env.example             # Private key & RPC example
│   └── package.json             # Chain scripts
├── src/
│   ├── animation/               # Locomotion & combat rigs
│   ├── components/              # 3D canvas, lighting, terrain, player
│   ├── duel/                    # MINEBREAK PvP Duel Mode
│   │   ├── components/
│   │   │   ├── DuelArena3D.tsx  # 3D duel arena with voxel characters
│   │   │   ├── DuelLobby.tsx    # Duel lobby, match creator & scoreboard
│   │   │   ├── HowItWorksModal.tsx # Cryptography & rules guide
│   │   │   ├── LeaderboardAndHistory.tsx # Open duels & top winners
│   │   │   ├── MatchReceiptPage.tsx # On-chain audit trail (/match/:gameId)
│   │   │   ├── NetworkChip.tsx  # Chain status & switcher
│   │   │   ├── WalletButton.tsx # Connect & claim payout button
│   │   │   └── WrongNetworkBanner.tsx # Unsupported network alert
│   │   ├── contract/
│   │   │   └── VaultBreak.json  # ABI and deployed addresses
│   │   ├── commitment.ts        # Client-side keccak256 & salt generator
│   │   ├── contractClient.ts    # Ethers v6 contract interaction client
│   │   ├── duelStore.ts         # Zustand duel state management
│   │   ├── networks.ts          # Sepolia & Local network configs
│   │   ├── types.ts             # Move, Phase, and Game types
│   │   └── wallet.ts            # EIP-1193 wallet manager
│   ├── meshes/                  # Procedural voxel models & props
│   ├── ui/                      # HUD unit frames, damage text, title screen
│   ├── App.tsx                  # Root app & /match/:gameId routing
│   └── main.tsx                 # App mount
├── vercel.json                  # Vercel SPA routing configuration
├── .env.example                 # Frontend env vars example
└── package.json                 # Unified workspace scripts
```

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
npm --prefix chain install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:2035](http://localhost:2035) in your browser.

### 3. Local Chain & Contract Commands
```bash
# Start local Hardhat node
npm run chain:node

# In another terminal: Deploy VaultBreak to localhost
npm run chain:deploy:local

# Run contract test suite (34 tests)
npm run chain:test

# Run full match demo
npm run chain:demo
```

### 4. Deploy to Ethereum Sepolia Testnet
1. Copy `chain/.env.example` to `chain/.env`:
   ```bash
   SEPOLIA_RPC_URL=https://rpc.sepolia.org
   DEPLOYER_PRIVATE_KEY=0x_YOUR_PRIVATE_KEY_HERE
   ```
2. Run deployment:
   ```bash
   npm run chain:deploy:sepolia
   ```
   The deployment script automatically records the deployed contract address and `deployBlock` into `src/duel/contract/VaultBreak.json`.

---

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, click **Add New Project** and select this repository.
3. The included `vercel.json` will automatically configure:
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Rewrites**: All routes redirect to `/index.html` for client-side SPA routing (`/match/:gameId`).
4. (Optional) In Vercel Project Settings → Environment Variables, add:
   - `VITE_DEFAULT_CHAIN_ID=11155111`
   - `VITE_SEPOLIA_RPC_URL=https://rpc.sepolia.org`
5. Click **Deploy**.

---

## Quality Gate

Run the complete quality gate before submitting changes:
```bash
npm run gate
```
Verifies TypeScript strict typechecking, Oxlint rules, and Vite production bundle compilation.
