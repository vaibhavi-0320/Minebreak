const hre = require("hardhat");
const { makeSalt, makeCommitment } = require("../shared/commitment");

const MOVE = { ATTACK: 1, SHIELD: 2, SCAN: 3 };
const MOVE_NAMES = { 1: "ATTACK", 2: "SHIELD", 3: "SCAN" };

async function main() {
  console.log("==================================================");
  console.log("STAGE 4: Full Staked Round with Two Player Signers");
  console.log("==================================================");

  const [player1, player2] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log(`Network: Chain ID ${chainId}`);
  console.log(`Player 1 (Infiltrator): ${player1.address}`);
  console.log(`Player 2 (Defender):    ${player2.address}`);

  // Deploy fresh VaultBreak instance
  const VaultBreak = await hre.ethers.getContractFactory("VaultBreak");
  const contract = await VaultBreak.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`VaultBreak deployed at: ${contractAddress}`);

  // STAKE: 0.001 ETH
  const stake = hre.ethers.parseEther("0.001");
  console.log(`\n--- STEP 1: Player 1 creates staked duel (${hre.ethers.formatEther(stake)} ETH) ---`);
  const createTx = await contract.connect(player1).createGame({ value: stake });
  const createReceipt = await createTx.wait();
  let gameId = 0n;
  for (const log of createReceipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "GameCreated") {
        gameId = parsed.args[0];
        break;
      }
    } catch (_) {}
  }
  console.log(`[OK] GameCreated: Game ID #${gameId}, tx=${createReceipt.hash}`);

  // Inspect WAITING state
  let g = await contract.getGame(gameId);
  console.log(`[STATE] Infiltrator: ${g.infiltrator}, Defender: ${g.defender}, Phase: ${g.phase} (WAITING), Stake: ${hre.ethers.formatEther(stake)} ETH`);

  // STEP 2: Player 2 joins game with matching stake
  console.log(`\n--- STEP 2: Player 2 joins duel matching stake ---`);
  const joinTx = await contract.connect(player2).joinGame(gameId, { value: stake });
  const joinReceipt = await joinTx.wait();
  console.log(`[OK] GameJoined: tx=${joinReceipt.hash}`);

  g = await contract.getGame(gameId);
  console.log(`[STATE] Phase: ${g.phase} (COMMIT), Round: ${g.round}, Deadline: ${new Date(Number(g.deadline) * 1000).toISOString()}`);

  // STEP 3: Secret Commit Phase
  console.log(`\n--- STEP 3: Secret Commitments ---`);
  const salt1 = makeSalt();
  const move1 = MOVE.ATTACK;
  const commit1 = makeCommitment({
    contract: contractAddress,
    chainId,
    gameId,
    round: g.round,
    player: player1.address,
    move: move1,
    salt: salt1,
  });

  const salt2 = makeSalt();
  const move2 = MOVE.SCAN;
  const commit2 = makeCommitment({
    contract: contractAddress,
    chainId,
    gameId,
    round: g.round,
    player: player2.address,
    move: move2,
    salt: salt2,
  });

  console.log(`Player 1 commits ATTACK -> commitment: ${commit1}`);
  const commitTx1 = await contract.connect(player1).commitMove(gameId, commit1);
  await commitTx1.wait();
  console.log(`[OK] Player 1 MoveCommitted: tx=${commitTx1.hash}`);

  let roundState = await contract.getRoundState(gameId);
  console.log(`[ROUND STATE] Infiltrator committed: ${roundState.infiltratorCommitted}, Defender committed: ${roundState.defenderCommitted}`);

  console.log(`Player 2 commits SCAN -> commitment: ${commit2}`);
  const commitTx2 = await contract.connect(player2).commitMove(gameId, commit2);
  await commitTx2.wait();
  console.log(`[OK] Player 2 MoveCommitted: tx=${commitTx2.hash}`);

  g = await contract.getGame(gameId);
  console.log(`[STATE] Both committed! Phase advanced to: ${g.phase} (REVEAL)`);

  // STEP 4: Reveal Phase
  console.log(`\n--- STEP 4: Reveal Phase ---`);
  console.log(`Player 1 reveals ${MOVE_NAMES[move1]} with secret salt...`);
  const revealTx1 = await contract.connect(player1).revealMove(gameId, move1, salt1);
  await revealTx1.wait();
  console.log(`[OK] Player 1 MoveRevealed: tx=${revealTx1.hash}`);

  roundState = await contract.getRoundState(gameId);
  console.log(`[ROUND STATE] Infiltrator revealed: ${roundState.infiltratorRevealed}, Defender revealed: ${roundState.defenderRevealed}`);

  console.log(`Player 2 reveals ${MOVE_NAMES[move2]} with secret salt...`);
  const revealTx2 = await contract.connect(player2).revealMove(gameId, move2, salt2);
  const revealReceipt2 = await revealTx2.wait();
  console.log(`[OK] Player 2 MoveRevealed: tx=${revealReceipt2.hash}`);

  // STEP 5: Round Resolution Check
  console.log(`\n--- STEP 5: Round Resolution Verification ---`);
  g = await contract.getGame(gameId);
  roundState = await contract.getRoundState(gameId);

  console.log(`[RESULT] Infiltrator Score: ${g.infiltratorScore}`);
  console.log(`[RESULT] Defender Score:    ${g.defenderScore}`);
  console.log(`[RESULT] Next Round:        ${g.round}`);
  console.log(`[RESULT] Last Inf Move:     ${MOVE_NAMES[roundState.lastInfiltratorMove]}`);
  const lastRes = Number(roundState.lastResult);
  console.log(`[RESULT] Last Round Winner: ${lastRes === 1 ? "Infiltrator won round!" : lastRes === 2 ? "Defender won round!" : "Draw"}`);

  // Assertions
  if (Number(g.infiltratorScore) !== 1) {
    throw new Error(`Expected Infiltrator score 1, got ${g.infiltratorScore}`);
  }
  if (Number(g.defenderScore) !== 0) {
    throw new Error(`Expected Defender score 0, got ${g.defenderScore}`);
  }
  if (lastRes !== 1) {
    throw new Error(`Expected round result 1 (Infiltrator won), got ${lastRes}`);
  }

  console.log("\n==================================================");
  console.log("✅ STAGE 4 COMPLETE: Staked Round Successfully Verified!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Stage 4 test failed:", err);
  process.exit(1);
});
