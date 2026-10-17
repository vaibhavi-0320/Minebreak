const crypto = require("crypto");
const { ethers } = require("ethers");

/**
 * Generate a cryptographically secure 32-byte hex salt (0x prefixed).
 */
function makeSalt() {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

/**
 * Compute commitment hash matching contract's _hash:
 * keccak256(abi.encode(contractAddress, chainId, gameId, round, player, uint8(move), bytes32(salt)))
 */
function makeCommitment({ contract, chainId, gameId, round, player, move, salt }) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ["address", "uint256", "uint256", "uint256", "address", "uint8", "bytes32"],
    [
      contract,
      BigInt(chainId),
      BigInt(gameId),
      BigInt(round),
      player,
      Number(move),
      salt,
    ]
  );
  return ethers.keccak256(encoded);
}

module.exports = {
  makeSalt,
  makeCommitment,
};
