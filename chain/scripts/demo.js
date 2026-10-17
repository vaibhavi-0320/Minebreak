const hre = require("hardhat");
const { makeSalt, makeCommitment } = require("../shared/commitment");

const MOVE = { ATTACK: 1, SHIELD: 2, SCAN: 3 };
const MOVE_NAME = { 1: "ATTACK", 2: "SHIELD", 3: "SCAN" };

async function main() {
  const signers = await hre.ethers.getSigners();
  const [player1, player2] = signers;
  console.log("Player 1 (infiltrator):", player1.address);
  console.log("Player 2 (defender):", player2.address);

  // Deploy
  const VaultBreak = await hre.ethers.getContractFactory("VaultBreak");
  const vb = await VaultBreak.deploy();
  await vb.waitForDeployment();
  const addr = await vb.getAddress();
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`\nContract deployed to ${addr} (chainId ${chainId})\n`);

  // === CREATE STAKED GAME ===
  const stake = hre.ethers.parseEther("0.05");
  const tx1 = await vb.connect(player1).createGame({ value: stake });
  const r1 = await tx1.wait();
  console.log(`[CREATE]  gameId=0  stake=0.05 ETH  tx=${r1.hash}`);

  // === JOIN ===
  const tx2 = await vb.connect(player2).joinGame(0, { value: stake });
  const r2 = await tx2.wait();
  console.log(`[JOIN]    gameId=0  tx=${r2.hash}`);

  // === ROUND 1: ATTACK vs SCAN => infiltrator wins ===
  console.log("\n--- Round 1: ATTACK vs SCAN ---");
  const salt1 = makeSalt();
  const salt2 = makeSalt();
  const commit1 = makeCommitment({
    contract: addr, chainId, gameId: 0, round: 1,
    player: player1.address, move: MOVE.ATTACK, salt: salt1,
  });
  const commit2 = makeCommitment({
    contract: addr, chainId, gameId: 0, round: 1,
    player: player2.address, move: MOVE.SCAN, salt: salt2,
  });

  let tx = await vb.connect(player1).commitMove(0, commit1);
  let r = await tx.wait();
  console.log(`[COMMIT]  P1=ATTACK  tx=${r.hash}`);

  tx = await vb.connect(player2).commitMove(0, commit2);
  r = await tx.wait();
  console.log(`[COMMIT]  P2=SCAN    tx=${r.hash}`);

  tx = await vb.connect(player1).revealMove(0, MOVE.ATTACK, salt1);
  r = await tx.wait();
  console.log(`[REVEAL]  P1=ATTACK  tx=${r.hash}`);

  tx = await vb.connect(player2).revealMove(0, MOVE.SCAN, salt2);
  r = await tx.wait();
  console.log(`[REVEAL]  P2=SCAN    tx=${r.hash}`);

  let game = await vb.getGame(0);
  console.log(`[RESULT]  Inf=${game.infiltratorScore}  Def=${game.defenderScore}  round=${game.round}  phase=${game.phase}`);

  // === BAD-SALT REVEAL (round 2) ===
  console.log("\n--- Round 2: Bad-salt reveal test ---");
  const salt3 = makeSalt();
  const salt4 = makeSalt();
  const badSalt = makeSalt();
  const commit3 = makeCommitment({
    contract: addr, chainId, gameId: 0, round: 2,
    player: player1.address, move: MOVE.SHIELD, salt: salt3,
  });
  const commit4 = makeCommitment({
    contract: addr, chainId, gameId: 0, round: 2,
    player: player2.address, move: MOVE.ATTACK, salt: salt4,
  });

  tx = await vb.connect(player1).commitMove(0, commit3);
  r = await tx.wait();
  console.log(`[COMMIT]  P1=SHIELD  tx=${r.hash}`);

  tx = await vb.connect(player2).commitMove(0, commit4);
  r = await tx.wait();
  console.log(`[COMMIT]  P2=ATTACK  tx=${r.hash}`);

  try {
    await vb.connect(player1).revealMove(0, MOVE.SHIELD, badSalt);
    console.log("[FAIL] Bad-salt reveal should have reverted!");
  } catch (err) {
    console.log(`[OK]      Bad-salt reveal reverted: "${err.reason || "Hash mismatch"}"`);
  }

  // Correct reveal to continue
  tx = await vb.connect(player1).revealMove(0, MOVE.SHIELD, salt3);
  r = await tx.wait();
  console.log(`[REVEAL]  P1=SHIELD  tx=${r.hash}`);

  tx = await vb.connect(player2).revealMove(0, MOVE.ATTACK, salt4);
  r = await tx.wait();
  console.log(`[REVEAL]  P2=ATTACK  tx=${r.hash}`);

  game = await vb.getGame(0);
  console.log(`[RESULT]  Inf=${game.infiltratorScore}  Def=${game.defenderScore}  round=${game.round}  phase=${game.phase}`);

  // === ROUND 3: Win the match ===
  console.log("\n--- Round 3: ATTACK vs SCAN => match ends ---");
  const salt5 = makeSalt();
  const salt6 = makeSalt();
  const commit5 = makeCommitment({
    contract: addr, chainId, gameId: 0, round: 3,
    player: player1.address, move: MOVE.ATTACK, salt: salt5,
  });
  const commit6 = makeCommitment({
    contract: addr, chainId, gameId: 0, round: 3,
    player: player2.address, move: MOVE.SCAN, salt: salt6,
  });

  tx = await vb.connect(player1).commitMove(0, commit5);
  r = await tx.wait();
  console.log(`[COMMIT]  P1=ATTACK  tx=${r.hash}`);

  tx = await vb.connect(player2).commitMove(0, commit6);
  r = await tx.wait();
  console.log(`[COMMIT]  P2=SCAN    tx=${r.hash}`);

  tx = await vb.connect(player1).revealMove(0, MOVE.ATTACK, salt5);
  r = await tx.wait();
  console.log(`[REVEAL]  P1=ATTACK  tx=${r.hash}`);

  tx = await vb.connect(player2).revealMove(0, MOVE.SCAN, salt6);
  r = await tx.wait();
  console.log(`[REVEAL]  P2=SCAN    tx=${r.hash}`);

  game = await vb.getGame(0);
  console.log(`[RESULT]  Inf=${game.infiltratorScore}  Def=${game.defenderScore}  phase=${game.phase}  winner=${game.winner}`);

  // === WITHDRAW ===
  console.log("\n--- Withdrawal ---");
  const pending = await vb.pendingWithdrawals(player1.address);
  console.log(`[PENDING] Player1: ${hre.ethers.formatEther(pending)} ETH`);

  const balBefore = await hre.ethers.provider.getBalance(player1.address);
  tx = await vb.connect(player1).withdraw();
  r = await tx.wait();
  const balAfter = await hre.ethers.provider.getBalance(player1.address);
  const gasCost = r.gasUsed * r.gasPrice;
  const received = balAfter - balBefore + gasCost;
  console.log(`[WITHDRAW] tx=${r.hash}`);
  console.log(`[WITHDRAW] Received: ${hre.ethers.formatEther(received)} ETH (gas: ${hre.ethers.formatEther(gasCost)})`);

  const afterPending = await vb.pendingWithdrawals(player1.address);
  console.log(`[PENDING] Player1 after: ${hre.ethers.formatEther(afterPending)} ETH`);

  // Stats
  console.log("\n--- Stats ---");
  console.log(`Player1 wins: ${await vb.wins(player1.address)}, played: ${await vb.played(player1.address)}`);
  console.log(`Player2 wins: ${await vb.wins(player2.address)}, played: ${await vb.played(player2.address)}`);

  console.log("\n✅ Demo complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
