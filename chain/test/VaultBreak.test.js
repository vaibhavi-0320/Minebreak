const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { makeSalt, makeCommitment } = require("../shared/commitment");

describe("VaultBreak Duel System", function () {
  let vaultBreak;
  let infiltrator, defender, outsider;
  let contractAddress;
  let chainId;

  const MOVE = { NONE: 0, ATTACK: 1, SHIELD: 2, SCAN: 3 };
  const PHASE = { WAITING: 0, COMMIT: 1, REVEAL: 2, FINISHED: 3 };

  function getCommitment(gameId, round, player, move, salt) {
    return makeCommitment({
      contract: contractAddress,
      chainId,
      gameId,
      round,
      player: typeof player === "string" ? player : player.address,
      move,
      salt,
    });
  }

  beforeEach(async function () {
    [infiltrator, defender, outsider] = await ethers.getSigners();
    const VaultBreakFactory = await ethers.getContractFactory("VaultBreak");
    vaultBreak = await VaultBreakFactory.deploy();
    await vaultBreak.waitForDeployment();
    contractAddress = await vaultBreak.getAddress();

    const network = await ethers.provider.getNetwork();
    chainId = network.chainId;
  });

  describe("Shared Hash Helper Parity", function () {
    it("should produce identical hash to contract computeCommitment", async function () {
      const salt = makeSalt();
      const localHash = getCommitment(0, 1, infiltrator.address, MOVE.ATTACK, salt);
      const onchainHash = await vaultBreak.computeCommitment(
        0,
        1,
        infiltrator.address,
        MOVE.ATTACK,
        salt
      );
      expect(localHash).to.equal(onchainHash);
    });
  });

  describe("Game Creation & Cancellation", function () {
    it("should create free game with zero stake", async function () {
      const tx = await vaultBreak.connect(infiltrator).createGame();
      await expect(tx).to.emit(vaultBreak, "GameCreated").withArgs(0, infiltrator.address, 0);

      const game = await vaultBreak.getGame(0);
      expect(game.infiltrator).to.equal(infiltrator.address);
      expect(game.phase).to.equal(PHASE.WAITING);
      expect(await vaultBreak.stakeOf(0)).to.equal(0);
    });

    it("should create staked game with value", async function () {
      const stake = ethers.parseEther("0.05");
      const tx = await vaultBreak.connect(infiltrator).createGame({ value: stake });
      await expect(tx).to.emit(vaultBreak, "GameCreated").withArgs(0, infiltrator.address, stake);
      expect(await vaultBreak.stakeOf(0)).to.equal(stake);
    });

    it("should allow creator to cancel game and refund stake", async function () {
      const stake = ethers.parseEther("0.05");
      await vaultBreak.connect(infiltrator).createGame({ value: stake });

      const tx = await vaultBreak.connect(infiltrator).cancelGame(0);
      await expect(tx).to.emit(vaultBreak, "GameCancelled").withArgs(0, infiltrator.address, stake);

      expect(await vaultBreak.pendingWithdrawals(infiltrator.address)).to.equal(stake);
      const game = await vaultBreak.getGame(0);
      expect(game.phase).to.equal(PHASE.FINISHED);
    });

    it("should reject cancel by non-creator", async function () {
      await vaultBreak.connect(infiltrator).createGame();
      await expect(vaultBreak.connect(defender).cancelGame(0)).to.be.revertedWith(
        "Only creator can cancel"
      );
    });
  });

  describe("Joining Games", function () {
    it("should allow defender to join with matching stake", async function () {
      const stake = ethers.parseEther("0.01");
      await vaultBreak.connect(infiltrator).createGame({ value: stake });

      const tx = await vaultBreak.connect(defender).joinGame(0, { value: stake });
      await expect(tx).to.emit(vaultBreak, "GameJoined").withArgs(0, defender.address);

      const game = await vaultBreak.getGame(0);
      expect(game.defender).to.equal(defender.address);
      expect(game.phase).to.equal(PHASE.COMMIT);
    });

    it("should reject joining own game", async function () {
      await vaultBreak.connect(infiltrator).createGame();
      await expect(vaultBreak.connect(infiltrator).joinGame(0)).to.be.revertedWith(
        "Cannot play against yourself"
      );
    });

    it("should reject joining with incorrect stake", async function () {
      const stake = ethers.parseEther("0.05");
      await vaultBreak.connect(infiltrator).createGame({ value: stake });
      await expect(
        vaultBreak.connect(defender).joinGame(0, { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Incorrect stake amount");
    });

    it("should reject joining full or cancelled game", async function () {
      await vaultBreak.connect(infiltrator).createGame();
      await vaultBreak.connect(defender).joinGame(0);
      await expect(vaultBreak.connect(outsider).joinGame(0)).to.be.revertedWith(
        "Game not open"
      );
    });
  });

  describe("Commit & Reveal Phase Rules", function () {
    let gameId = 0;

    beforeEach(async function () {
      await vaultBreak.connect(infiltrator).createGame();
      await vaultBreak.connect(defender).joinGame(gameId);
    });

    it("full round: both commit, both reveal, correct winner and score", async function () {
      const infSalt = makeSalt();
      const defSalt = makeSalt();

      // ATTACK (1) vs SCAN (3) => Infiltrator wins (+1 pt)
      const infHash = getCommitment(gameId, 1, infiltrator.address, MOVE.ATTACK, infSalt);
      const defHash = getCommitment(gameId, 1, defender.address, MOVE.SCAN, defSalt);

      await vaultBreak.connect(infiltrator).commitMove(gameId, infHash);
      await vaultBreak.connect(defender).commitMove(gameId, defHash);

      const gameAfterCommits = await vaultBreak.getGame(gameId);
      expect(gameAfterCommits.phase).to.equal(PHASE.REVEAL);

      await vaultBreak.connect(infiltrator).revealMove(gameId, MOVE.ATTACK, infSalt);
      const revealTx = await vaultBreak.connect(defender).revealMove(gameId, MOVE.SCAN, defSalt);

      await expect(revealTx)
        .to.emit(vaultBreak, "RoundResolved")
        .withArgs(gameId, 1, MOVE.ATTACK, MOVE.SCAN, 1, 1, 0);

      const gameAfterRound = await vaultBreak.getGame(gameId);
      expect(gameAfterRound.infiltratorScore).to.equal(1);
      expect(gameAfterRound.defenderScore).to.equal(0);
      expect(gameAfterRound.round).to.equal(2);
      expect(gameAfterRound.phase).to.equal(PHASE.COMMIT);
    });

    it("draw gives no points and increments round", async function () {
      const infSalt = makeSalt();
      const defSalt = makeSalt();

      const infHash = getCommitment(gameId, 1, infiltrator.address, MOVE.SHIELD, infSalt);
      const defHash = getCommitment(gameId, 1, defender.address, MOVE.SHIELD, defSalt);

      await vaultBreak.connect(infiltrator).commitMove(gameId, infHash);
      await vaultBreak.connect(defender).commitMove(gameId, defHash);
      await vaultBreak.connect(infiltrator).revealMove(gameId, MOVE.SHIELD, infSalt);
      const revealTx = await vaultBreak.connect(defender).revealMove(gameId, MOVE.SHIELD, defSalt);

      await expect(revealTx)
        .to.emit(vaultBreak, "RoundResolved")
        .withArgs(gameId, 1, MOVE.SHIELD, MOVE.SHIELD, 3, 0, 0);

      const game = await vaultBreak.getGame(gameId);
      expect(game.infiltratorScore).to.equal(0);
      expect(game.defenderScore).to.equal(0);
      expect(game.round).to.equal(2);
    });

    it("wrong salt reverts", async function () {
      const infSalt = makeSalt();
      const wrongSalt = makeSalt();
      const infHash = getCommitment(gameId, 1, infiltrator.address, MOVE.ATTACK, infSalt);
      const defHash = getCommitment(gameId, 1, defender.address, MOVE.SHIELD, makeSalt());

      await vaultBreak.connect(infiltrator).commitMove(gameId, infHash);
      await vaultBreak.connect(defender).commitMove(gameId, defHash);

      await expect(
        vaultBreak.connect(infiltrator).revealMove(gameId, MOVE.ATTACK, wrongSalt)
      ).to.be.revertedWith("Hash mismatch");
    });

    it("wrong move reverts", async function () {
      const infSalt = makeSalt();
      const infHash = getCommitment(gameId, 1, infiltrator.address, MOVE.ATTACK, infSalt);
      const defHash = getCommitment(gameId, 1, defender.address, MOVE.SHIELD, makeSalt());

      await vaultBreak.connect(infiltrator).commitMove(gameId, infHash);
      await vaultBreak.connect(defender).commitMove(gameId, defHash);

      await expect(
        vaultBreak.connect(infiltrator).revealMove(gameId, MOVE.SCAN, infSalt)
      ).to.be.revertedWith("Hash mismatch");
    });

    it("move 0 reverts", async function () {
      const infHash = getCommitment(gameId, 1, infiltrator.address, MOVE.NONE, makeSalt());
      const defHash = getCommitment(gameId, 1, defender.address, MOVE.SHIELD, makeSalt());
      await vaultBreak.connect(infiltrator).commitMove(gameId, infHash);
      await vaultBreak.connect(defender).commitMove(gameId, defHash);

      await expect(
        vaultBreak.connect(infiltrator).revealMove(gameId, MOVE.NONE, makeSalt())
      ).to.be.revertedWith("Invalid move");
    });

    it("duplicate commit reverts", async function () {
      const infHash = getCommitment(gameId, 1, infiltrator.address, MOVE.ATTACK, makeSalt());
      await vaultBreak.connect(infiltrator).commitMove(gameId, infHash);
      await expect(
        vaultBreak.connect(infiltrator).commitMove(gameId, infHash)
      ).to.be.revertedWith("Already committed");
    });

    it("duplicate reveal reverts", async function () {
      const infSalt = makeSalt();
      const defSalt = makeSalt();
      const infHash = getCommitment(gameId, 1, infiltrator.address, MOVE.ATTACK, infSalt);
      const defHash = getCommitment(gameId, 1, defender.address, MOVE.SHIELD, defSalt);

      await vaultBreak.connect(infiltrator).commitMove(gameId, infHash);
      await vaultBreak.connect(defender).commitMove(gameId, defHash);
      await vaultBreak.connect(infiltrator).revealMove(gameId, MOVE.ATTACK, infSalt);

      await expect(
        vaultBreak.connect(infiltrator).revealMove(gameId, MOVE.ATTACK, infSalt)
      ).to.be.revertedWith("Already revealed");
    });

    it("reveal before both committed reverts", async function () {
      const infSalt = makeSalt();
      const infHash = getCommitment(gameId, 1, infiltrator.address, MOVE.ATTACK, infSalt);
      await vaultBreak.connect(infiltrator).commitMove(gameId, infHash);

      await expect(
        vaultBreak.connect(infiltrator).revealMove(gameId, MOVE.ATTACK, infSalt)
      ).to.be.revertedWith("Not in reveal phase");
    });

    it("commit after reveal phase reverts", async function () {
      const infHash = getCommitment(gameId, 1, infiltrator.address, MOVE.ATTACK, makeSalt());
      const defHash = getCommitment(gameId, 1, defender.address, MOVE.SHIELD, makeSalt());
      await vaultBreak.connect(infiltrator).commitMove(gameId, infHash);
      await vaultBreak.connect(defender).commitMove(gameId, defHash);

      await expect(
        vaultBreak.connect(infiltrator).commitMove(gameId, infHash)
      ).to.be.revertedWith("Not in commit phase");
    });

    it("outsider cannot commit, reveal or claim", async function () {
      const hash = getCommitment(gameId, 1, outsider.address, MOVE.ATTACK, makeSalt());
      await expect(
        vaultBreak.connect(outsider).commitMove(gameId, hash)
      ).to.be.revertedWith("Not a player in this game");

      await expect(
        vaultBreak.connect(outsider).revealMove(gameId, MOVE.ATTACK, makeSalt())
      ).to.be.revertedWith("Not a player in this game");

      await expect(
        vaultBreak.connect(outsider).claimTimeout(gameId)
      ).to.be.revertedWith("Not a player in this game");
    });

    it("commitment from another game, round or player does not validate", async function () {
      const infSalt = makeSalt();
      // Hash created with gameId = 999
      const wrongGameHash = getCommitment(999, 1, infiltrator.address, MOVE.ATTACK, infSalt);
      const defHash = getCommitment(gameId, 1, defender.address, MOVE.SHIELD, makeSalt());

      await vaultBreak.connect(infiltrator).commitMove(gameId, wrongGameHash);
      await vaultBreak.connect(defender).commitMove(gameId, defHash);

      await expect(
        vaultBreak.connect(infiltrator).revealMove(gameId, MOVE.ATTACK, infSalt)
      ).to.be.revertedWith("Hash mismatch");
    });
  });

  describe("All 9 Move Combinations", function () {
    const testCases = [
      { m1: MOVE.ATTACK, m2: MOVE.ATTACK, expRes: 3, infDelta: 0, defDelta: 0 },
      { m1: MOVE.ATTACK, m2: MOVE.SHIELD, expRes: 2, infDelta: 0, defDelta: 1 },
      { m1: MOVE.ATTACK, m2: MOVE.SCAN,   expRes: 1, infDelta: 1, defDelta: 0 },
      { m1: MOVE.SHIELD, m2: MOVE.ATTACK, expRes: 1, infDelta: 1, defDelta: 0 },
      { m1: MOVE.SHIELD, m2: MOVE.SHIELD, expRes: 3, infDelta: 0, defDelta: 0 },
      { m1: MOVE.SHIELD, m2: MOVE.SCAN,   expRes: 2, infDelta: 0, defDelta: 1 },
      { m1: MOVE.SCAN,   m2: MOVE.ATTACK, expRes: 2, infDelta: 0, defDelta: 1 },
      { m1: MOVE.SCAN,   m2: MOVE.SHIELD, expRes: 1, infDelta: 1, defDelta: 0 },
      { m1: MOVE.SCAN,   m2: MOVE.SCAN,   expRes: 3, infDelta: 0, defDelta: 0 },
    ];

    testCases.forEach(({ m1, m2, expRes, infDelta, defDelta }, idx) => {
      it(`combo ${idx + 1}: Move ${m1} vs ${m2} => result ${expRes}`, async function () {
        await vaultBreak.connect(infiltrator).createGame();
        const gId = 0;
        await vaultBreak.connect(defender).joinGame(gId);

        const s1 = makeSalt();
        const s2 = makeSalt();
        const h1 = getCommitment(gId, 1, infiltrator.address, m1, s1);
        const h2 = getCommitment(gId, 1, defender.address, m2, s2);

        await vaultBreak.connect(infiltrator).commitMove(gId, h1);
        await vaultBreak.connect(defender).commitMove(gId, h2);
        await vaultBreak.connect(infiltrator).revealMove(gId, m1, s1);
        const tx = await vaultBreak.connect(defender).revealMove(gId, m2, s2);

        await expect(tx)
          .to.emit(vaultBreak, "RoundResolved")
          .withArgs(gId, 1, m1, m2, expRes, infDelta, defDelta);
      });
    });
  });

  describe("Match Conclusion & Payouts (First to 3 Points)", function () {
    it("match ends at 3 points, credits winner pot, and records stats", async function () {
      const stake = ethers.parseEther("0.1");
      await vaultBreak.connect(infiltrator).createGame({ value: stake });
      await vaultBreak.connect(defender).joinGame(0, { value: stake });

      // Infiltrator wins 3 consecutive rounds: ATTACK vs SCAN
      for (let r = 1; r <= 3; r++) {
        const s1 = makeSalt();
        const s2 = makeSalt();
        const h1 = getCommitment(0, r, infiltrator.address, MOVE.ATTACK, s1);
        const h2 = getCommitment(0, r, defender.address, MOVE.SCAN, s2);

        await vaultBreak.connect(infiltrator).commitMove(0, h1);
        await vaultBreak.connect(defender).commitMove(0, h2);
        await vaultBreak.connect(infiltrator).revealMove(0, MOVE.ATTACK, s1);
        const tx = await vaultBreak.connect(defender).revealMove(0, MOVE.SCAN, s2);

        if (r === 3) {
          await expect(tx)
            .to.emit(vaultBreak, "GameEnded")
            .withArgs(0, infiltrator.address, 3, 0);
        }
      }

      const game = await vaultBreak.getGame(0);
      expect(game.phase).to.equal(PHASE.FINISHED);
      expect(game.winner).to.equal(infiltrator.address);
      expect(await vaultBreak.wins(infiltrator.address)).to.equal(1);
      expect(await vaultBreak.played(infiltrator.address)).to.equal(1);
      expect(await vaultBreak.played(defender.address)).to.equal(1);

      // Winner pot: 0.1 * 2 = 0.2 ETH
      const expectedPot = ethers.parseEther("0.2");
      expect(await vaultBreak.pendingWithdrawals(infiltrator.address)).to.equal(expectedPot);

      // Winner withdraws
      const balBefore = await ethers.provider.getBalance(infiltrator.address);
      const wTx = await vaultBreak.connect(infiltrator).withdraw();
      const receipt = await wTx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(infiltrator.address);

      expect(balAfter).to.equal(balBefore + expectedPot - gasCost);
      expect(await vaultBreak.pendingWithdrawals(infiltrator.address)).to.equal(0);
    });
  });

  describe("Timeout Handling with Network Time Travel", function () {
    let gameId = 0;
    const stake = ethers.parseEther("0.05");

    beforeEach(async function () {
      await vaultBreak.connect(infiltrator).createGame({ value: stake });
      await vaultBreak.connect(defender).joinGame(gameId, { value: stake });
    });

    it("claim before deadline reverts", async function () {
      await expect(vaultBreak.connect(infiltrator).claimTimeout(gameId)).to.be.revertedWith(
        "Deadline not passed"
      );
    });

    it("commit timeout: defender stalls, infiltrator claims and wins pot", async function () {
      const s1 = makeSalt();
      const h1 = getCommitment(gameId, 1, infiltrator.address, MOVE.ATTACK, s1);
      await vaultBreak.connect(infiltrator).commitMove(gameId, h1);

      // Advance time past COMMIT_TIMEOUT (120s)
      await time.increase(125);

      // Staller cannot claim
      await expect(vaultBreak.connect(defender).claimTimeout(gameId)).to.be.revertedWith(
        "Only the waiting player can claim"
      );

      // Waiting player claims
      const tx = await vaultBreak.connect(infiltrator).claimTimeout(gameId);
      await expect(tx).to.emit(vaultBreak, "TimeoutClaimed").withArgs(gameId, infiltrator.address, infiltrator.address);

      const game = await vaultBreak.getGame(gameId);
      expect(game.phase).to.equal(PHASE.FINISHED);
      expect(game.winner).to.equal(infiltrator.address);
      expect(await vaultBreak.pendingWithdrawals(infiltrator.address)).to.equal(ethers.parseEther("0.1"));
    });

    it("commit timeout: both stall, both refunded without winner", async function () {
      await time.increase(125);

      const tx = await vaultBreak.connect(infiltrator).claimTimeout(gameId);
      await expect(tx).to.emit(vaultBreak, "TimeoutClaimed").withArgs(gameId, infiltrator.address, ethers.ZeroAddress);

      expect(await vaultBreak.pendingWithdrawals(infiltrator.address)).to.equal(stake);
      expect(await vaultBreak.pendingWithdrawals(defender.address)).to.equal(stake);
    });

    it("reveal timeout: defender stalls, infiltrator claims and wins pot", async function () {
      const s1 = makeSalt();
      const s2 = makeSalt();
      const h1 = getCommitment(gameId, 1, infiltrator.address, MOVE.ATTACK, s1);
      const h2 = getCommitment(gameId, 1, defender.address, MOVE.SHIELD, s2);

      await vaultBreak.connect(infiltrator).commitMove(gameId, h1);
      await vaultBreak.connect(defender).commitMove(gameId, h2);

      // Only infiltrator reveals
      await vaultBreak.connect(infiltrator).revealMove(gameId, MOVE.ATTACK, s1);

      // Advance time past REVEAL_TIMEOUT (120s)
      await time.increase(125);

      // Staller cannot claim
      await expect(vaultBreak.connect(defender).claimTimeout(gameId)).to.be.revertedWith(
        "Only the waiting player can claim"
      );

      const tx = await vaultBreak.connect(infiltrator).claimTimeout(gameId);
      await expect(tx).to.emit(vaultBreak, "TimeoutClaimed").withArgs(gameId, infiltrator.address, infiltrator.address);
      expect(await vaultBreak.pendingWithdrawals(infiltrator.address)).to.equal(ethers.parseEther("0.1"));
    });
  });
});
