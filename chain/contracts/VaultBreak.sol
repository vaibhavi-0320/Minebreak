// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VaultBreak
 * @notice MINEBREAK Two-Player Vault Duel Commit-Reveal Smart Contract.
 *
 * Rules:
 *   Moves: 1 = ATTACK, 2 = SHIELD, 3 = SCAN
 *   ATTACK beats SCAN, SCAN beats SHIELD, SHIELD beats ATTACK
 *   Win = +1 point, draw = 0 points. First to WIN_SCORE (3) wins match.
 *   Commitment = keccak256(abi.encode(contractAddress, chainId, gameId, round, player, uint8(move), bytes32 salt))
 */
contract VaultBreak {
    enum Move { NONE, ATTACK, SHIELD, SCAN }
    enum Phase { WAITING, COMMIT, REVEAL, FINISHED }

    uint8 public constant WIN_SCORE = 3;
    uint256 public constant COMMIT_TIMEOUT = 120;
    uint256 public constant REVEAL_TIMEOUT = 120;

    struct Game {
        address infiltrator;
        address defender;
        uint8 infiltratorScore;
        uint8 defenderScore;
        uint256 round;
        Phase phase;
        address winner;
        uint256 deadline;
        bytes32 infiltratorCommit;
        bytes32 defenderCommit;
        Move infiltratorMove;
        Move defenderMove;
        bool infiltratorRevealed;
        bool defenderRevealed;
        Move lastInfiltratorMove;
        Move lastDefenderMove;
        uint8 lastResult; // 0 none, 1 infiltrator won, 2 defender won, 3 draw
    }

    uint256 public nextGameId;
    mapping(uint256 => Game) internal games;

    mapping(uint256 => uint256) public stakeOf;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(address => uint256) public wins;
    mapping(address => uint256) public played;

    // --- Events ---
    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 stake);
    event GameJoined(uint256 indexed gameId, address indexed defender);
    event GameCancelled(uint256 indexed gameId, address indexed creator, uint256 refundAmount);
    event MoveCommitted(uint256 indexed gameId, address indexed player, uint256 round);
    event MoveRevealed(uint256 indexed gameId, address indexed player, uint256 round, Move move);
    event RoundResolved(
        uint256 indexed gameId,
        uint256 round,
        Move infiltratorMove,
        Move defenderMove,
        uint8 result,
        uint8 infiltratorScore,
        uint8 defenderScore
    );
    event GameEnded(uint256 indexed gameId, address indexed winner, uint8 infiltratorScore, uint8 defenderScore);
    event TimeoutClaimed(uint256 indexed gameId, address indexed claimer, address winner);
    event Withdrawn(address indexed player, uint256 amount);

    modifier onlyPlayer(uint256 gameId) {
        Game storage g = games[gameId];
        require(msg.sender == g.infiltrator || msg.sender == g.defender, "Not a player in this game");
        _;
    }

    /**
     * @notice Create a new vault duel with optional stake.
     */
    function createGame() external payable returns (uint256 gameId) {
        gameId = nextGameId++;
        Game storage g = games[gameId];
        g.infiltrator = msg.sender;
        g.round = 1;
        g.phase = Phase.WAITING;

        if (msg.value > 0) {
            stakeOf[gameId] = msg.value;
        }

        emit GameCreated(gameId, msg.sender, msg.value);
    }

    /**
     * @notice Join an existing waiting duel, matching the creator's stake.
     */
    function joinGame(uint256 gameId) external payable {
        Game storage g = games[gameId];
        require(g.infiltrator != address(0), "Game does not exist");
        require(g.phase == Phase.WAITING, "Game not open");
        require(msg.sender != g.infiltrator, "Cannot play against yourself");
        require(msg.value == stakeOf[gameId], "Incorrect stake amount");

        g.defender = msg.sender;
        g.phase = Phase.COMMIT;
        g.deadline = block.timestamp + COMMIT_TIMEOUT;

        emit GameJoined(gameId, msg.sender);
    }

    /**
     * @notice Cancel game while in WAITING phase and reclaim stake.
     */
    function cancelGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.phase == Phase.WAITING, "Cannot cancel once started");
        require(msg.sender == g.infiltrator, "Only creator can cancel");

        g.phase = Phase.FINISHED;
        uint256 refund = stakeOf[gameId];
        stakeOf[gameId] = 0;

        if (refund > 0) {
            pendingWithdrawals[msg.sender] += refund;
        }

        emit GameCancelled(gameId, msg.sender, refund);
    }

    /**
     * @notice Commit a hashed move for the current round.
     */
    function commitMove(uint256 gameId, bytes32 commitment) external onlyPlayer(gameId) {
        Game storage g = games[gameId];
        require(g.phase == Phase.COMMIT, "Not in commit phase");
        require(block.timestamp <= g.deadline, "Commit deadline passed");
        require(commitment != bytes32(0), "Empty commitment");

        if (msg.sender == g.infiltrator) {
            require(g.infiltratorCommit == bytes32(0), "Already committed");
            g.infiltratorCommit = commitment;
        } else {
            require(g.defenderCommit == bytes32(0), "Already committed");
            g.defenderCommit = commitment;
        }

        emit MoveCommitted(gameId, msg.sender, g.round);

        if (g.infiltratorCommit != bytes32(0) && g.defenderCommit != bytes32(0)) {
            g.phase = Phase.REVEAL;
            g.deadline = block.timestamp + REVEAL_TIMEOUT;
        }
    }

    /**
     * @notice Reveal move with secret salt.
     */
    function revealMove(uint256 gameId, Move move, bytes32 salt) external onlyPlayer(gameId) {
        Game storage g = games[gameId];
        require(g.phase == Phase.REVEAL, "Not in reveal phase");
        require(block.timestamp <= g.deadline, "Reveal deadline passed");
        require(move != Move.NONE, "Invalid move");

        bytes32 expected = _hash(gameId, g.round, msg.sender, move, salt);

        if (msg.sender == g.infiltrator) {
            require(!g.infiltratorRevealed, "Already revealed");
            require(expected == g.infiltratorCommit, "Hash mismatch");
            g.infiltratorMove = move;
            g.infiltratorRevealed = true;
        } else {
            require(!g.defenderRevealed, "Already revealed");
            require(expected == g.defenderCommit, "Hash mismatch");
            g.defenderMove = move;
            g.defenderRevealed = true;
        }

        emit MoveRevealed(gameId, msg.sender, g.round, move);

        if (g.infiltratorRevealed && g.defenderRevealed) {
            _resolveRound(gameId);
        }
    }

    /**
     * @notice Claim a timeout if opponent failed to commit or reveal.
     */
    function claimTimeout(uint256 gameId) external onlyPlayer(gameId) {
        Game storage g = games[gameId];
        require(g.phase == Phase.COMMIT || g.phase == Phase.REVEAL, "Nothing to time out");
        require(block.timestamp > g.deadline, "Deadline not passed");

        bool infDone;
        bool defDone;
        if (g.phase == Phase.COMMIT) {
            infDone = g.infiltratorCommit != bytes32(0);
            defDone = g.defenderCommit != bytes32(0);
        } else {
            infDone = g.infiltratorRevealed;
            defDone = g.defenderRevealed;
        }

        address w;
        if (infDone && !defDone) {
            w = g.infiltrator;
        } else if (defDone && !infDone) {
            w = g.defender;
        }

        if (w != address(0)) {
            require(msg.sender == w, "Only the waiting player can claim");
            g.winner = w;
            wins[w]++;
            played[g.infiltrator]++;
            played[g.defender]++;

            uint256 pot = stakeOf[gameId] * 2;
            stakeOf[gameId] = 0;
            if (pot > 0) {
                pendingWithdrawals[w] += pot;
            }
        } else {
            // Both stalled - refund each player's stake
            uint256 refund = stakeOf[gameId];
            stakeOf[gameId] = 0;
            if (refund > 0) {
                pendingWithdrawals[g.infiltrator] += refund;
                pendingWithdrawals[g.defender] += refund;
            }
        }

        g.phase = Phase.FINISHED;
        emit TimeoutClaimed(gameId, msg.sender, w);
        emit GameEnded(gameId, w, g.infiltratorScore, g.defenderScore);
    }

    /**
     * @notice Pull payment pattern to withdraw pending balances.
     */
    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No funds to withdraw");

        pendingWithdrawals[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    // --- Internal Helpers ---

    function _resolveRound(uint256 gameId) internal {
        Game storage g = games[gameId];
        Move a = g.infiltratorMove;
        Move b = g.defenderMove;

        uint8 result;
        if (a == b) {
            result = 3; // draw
        } else if (_beats(a, b)) {
            result = 1; // infiltrator won round
            g.infiltratorScore++;
        } else {
            result = 2; // defender won round
            g.defenderScore++;
        }

        g.lastInfiltratorMove = a;
        g.lastDefenderMove = b;
        g.lastResult = result;

        emit RoundResolved(gameId, g.round, a, b, result, g.infiltratorScore, g.defenderScore);

        if (g.infiltratorScore >= WIN_SCORE || g.defenderScore >= WIN_SCORE) {
            g.phase = Phase.FINISHED;
            g.winner = g.infiltratorScore >= WIN_SCORE ? g.infiltrator : g.defender;
            wins[g.winner]++;
            played[g.infiltrator]++;
            played[g.defender]++;

            uint256 pot = stakeOf[gameId] * 2;
            stakeOf[gameId] = 0;
            if (pot > 0) {
                pendingWithdrawals[g.winner] += pot;
            }

            emit GameEnded(gameId, g.winner, g.infiltratorScore, g.defenderScore);
        } else {
            g.round++;
            g.phase = Phase.COMMIT;
            g.deadline = block.timestamp + COMMIT_TIMEOUT;
            g.infiltratorCommit = bytes32(0);
            g.defenderCommit = bytes32(0);
            g.infiltratorMove = Move.NONE;
            g.defenderMove = Move.NONE;
            g.infiltratorRevealed = false;
            g.defenderRevealed = false;
        }
    }

    function _beats(Move a, Move b) internal pure returns (bool) {
        return (a == Move.ATTACK && b == Move.SCAN)
            || (a == Move.SCAN && b == Move.SHIELD)
            || (a == Move.SHIELD && b == Move.ATTACK);
    }

    function _hash(uint256 gameId, uint256 round, address player, Move move, bytes32 salt)
        internal
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(address(this), block.chainid, gameId, round, player, uint8(move), salt));
    }

    // --- Views ---

    function getGame(uint256 gameId) external view returns (
        address infiltrator,
        address defender,
        uint8 infiltratorScore,
        uint8 defenderScore,
        uint256 round,
        Phase phase,
        address winner,
        uint256 deadline
    ) {
        Game storage g = games[gameId];
        return (
            g.infiltrator,
            g.defender,
            g.infiltratorScore,
            g.defenderScore,
            g.round,
            g.phase,
            g.winner,
            g.deadline
        );
    }

    function getRoundState(uint256 gameId) external view returns (
        bool infiltratorCommitted,
        bool defenderCommitted,
        bool infiltratorRevealed,
        bool defenderRevealed,
        Move lastInfiltratorMove,
        Move lastDefenderMove,
        uint8 lastResult
    ) {
        Game storage g = games[gameId];
        return (
            g.infiltratorCommit != bytes32(0),
            g.defenderCommit != bytes32(0),
            g.infiltratorRevealed,
            g.defenderRevealed,
            g.lastInfiltratorMove,
            g.lastDefenderMove,
            g.lastResult
        );
    }

    function computeCommitment(
        uint256 gameId,
        uint256 round,
        address player,
        Move move,
        bytes32 salt
    ) external view returns (bytes32) {
        return _hash(gameId, round, player, move, salt);
    }
}
