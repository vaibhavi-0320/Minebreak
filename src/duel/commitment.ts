import { ethers } from 'ethers'
import type { StoredSalt } from './types'

/**
 * Generate a cryptographically secure 32-byte hex salt (0x prefixed).
 */
export function makeSalt(): string {
  const bytes = new Uint8Array(32)
  window.crypto.getRandomValues(bytes)
  let hex = '0x'
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Compute commitment hash matching contract's _hash:
 * keccak256(abi.encode(contractAddress, chainId, gameId, round, player, uint8(move), bytes32(salt)))
 */
export function makeCommitment(params: {
  contract: string
  chainId: number | bigint
  gameId: number | bigint
  round: number | bigint
  player: string
  move: number
  salt: string
}): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder()
  const encoded = abiCoder.encode(
    ['address', 'uint256', 'uint256', 'uint256', 'address', 'uint8', 'bytes32'],
    [
      params.contract,
      BigInt(params.chainId),
      BigInt(params.gameId),
      BigInt(params.round),
      params.player,
      Number(params.move),
      params.salt,
    ]
  )
  return ethers.keccak256(encoded)
}

function getSaltKey(gameId: string | number | bigint, round: string | number | bigint, player: string): string {
  return `minebreak_duel_salt_${gameId.toString()}_${round.toString()}_${player.toLowerCase()}`
}

export function saveCommitmentSalt(stored: StoredSalt): void {
  try {
    const key = getSaltKey(stored.gameId, stored.round, stored.player)
    localStorage.setItem(key, JSON.stringify(stored))
  } catch (err) {
    console.warn('Failed to save commitment salt to localStorage:', err)
  }
}

export function getCommitmentSalt(
  gameId: string | number | bigint,
  round: string | number | bigint,
  player: string
): StoredSalt | null {
  try {
    const key = getSaltKey(gameId, round, player)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as StoredSalt
  } catch (err) {
    console.warn('Failed to read commitment salt from localStorage:', err)
    return null
  }
}

export function clearCommitmentSalt(
  gameId: string | number | bigint,
  round: string | number | bigint,
  player: string
): void {
  try {
    const key = getSaltKey(gameId, round, player)
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
