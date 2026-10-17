/**
 * Automated On-Chain Bot Player for Solo Presentations and Live Demonstrations.
 *
 * Uses an in-browser burner wallet (stored in localStorage) to play as Defender
 * in on-chain VaultBreak duels on Ethereum Sepolia (11155111) and Hardhat Local (31337).
 *
 * Every action (joinGame, commitMove, revealMove) is executed as a real on-chain transaction.
 */

import { ethers } from 'ethers'
import { NETWORKS } from './networks'
import { Move } from './types'
import { makeSalt, makeCommitment } from './commitment'
import { contractClient } from './contractClient'

const BOT_STORAGE_KEY = 'minebreak_bot_private_key'
const BOT_SALT_PREFIX = 'minebreak_bot_commit_'

export class BotPlayer {
  private wallet: ethers.Wallet | null = null

  /**
   * Get or initialize the persistent bot burner wallet.
   */
  getWallet(): ethers.Wallet {
    if (this.wallet) return this.wallet

    let key: string | null = null
    if (typeof localStorage !== 'undefined') {
      key = localStorage.getItem(BOT_STORAGE_KEY)
    }

    if (!key || !key.startsWith('0x') || key.length !== 66) {
      const randomWallet = ethers.Wallet.createRandom()
      key = randomWallet.privateKey
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(BOT_STORAGE_KEY, key)
      }
    }

    this.wallet = new ethers.Wallet(key)
    return this.wallet
  }

  getBotAddress(): string {
    return this.getWallet().address
  }

  getProvider(chainId: number): ethers.JsonRpcProvider {
    const net = NETWORKS[chainId]
    const rpcUrl = net?.rpcUrl ?? 'http://127.0.0.1:8545'
    return new ethers.JsonRpcProvider(rpcUrl)
  }

  getSigner(chainId: number): ethers.Wallet {
    const provider = this.getProvider(chainId)
    return this.getWallet().connect(provider)
  }

  async getBalance(chainId: number): Promise<string> {
    try {
      const provider = this.getProvider(chainId)
      const bal = await provider.getBalance(this.getBotAddress())
      return ethers.formatEther(bal)
    } catch {
      return '0.0'
    }
  }

  /**
   * On Hardhat Local (31337), auto-funds the bot burner wallet with 10 ETH via hardhat_setBalance.
   */
  async autoFundLocal(chainId: number): Promise<void> {
    if (chainId !== 31337) return
    try {
      const provider = this.getProvider(chainId)
      const botAddr = ethers.getAddress(this.getBotAddress())
      // 10 ETH = 0x8ac7230489e80000
      await provider.send('hardhat_setBalance', [botAddr, '0x8ac7230489e80000'])
    } catch (err) {
      console.warn('Bot local auto-fund warning:', err)
    }
  }

  /**
   * Reclaims all remaining bot ETH and sweeps it back to the presenter's wallet.
   */
  async sweepFunds(toAddress: string, chainId: number): Promise<string | null> {
    try {
      const signer = this.getSigner(chainId)
      const provider = this.getProvider(chainId)
      const balance = await provider.getBalance(signer.address)

      // Estimate gas fee
      const feeData = await provider.getFeeData()
      const gasPrice = feeData.gasPrice ?? ethers.parseUnits('10', 'gwei')
      const gasCost = gasPrice * 21000n

      if (balance <= gasCost) {
        throw new Error('Bot balance is too low to cover sweep gas fee')
      }

      const sendAmount = balance - gasCost
      const tx = await signer.sendTransaction({
        to: toAddress,
        value: sendAmount,
        gasLimit: 21000,
      })
      await tx.wait()
      return tx.hash
    } catch (err) {
      console.error('Bot sweep error:', err)
      throw err
    }
  }

  private inMemoryCommits = new Map<string, { move: Move; salt: string }>()

  getStoredCommitment(chainId: number, gameId: bigint, round: bigint): { move: Move; salt: string } | null {
    const key = `${BOT_SALT_PREFIX}${chainId}_${gameId}_${round}`
    if (this.inMemoryCommits.has(key)) {
      return this.inMemoryCommits.get(key)!
    }
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(key)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          this.inMemoryCommits.set(key, parsed)
          return parsed
        } catch (_) {}
      }
    }
    return null
  }

  saveCommitment(chainId: number, gameId: bigint, round: bigint, move: Move, salt: string): void {
    const key = `${BOT_SALT_PREFIX}${chainId}_${gameId}_${round}`
    this.inMemoryCommits.set(key, { move, salt })
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify({ move, salt }))
      } catch (_) {}
    }
  }

  /**
   * Bot automatically joins an open duel as Defender on-chain.
   */
  async autoJoin(chainId: number, gameId: bigint, stakeEth: string): Promise<string> {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && chainId === 31337) {
      throw new Error(
        'Browsers block local HTTP (http://127.0.0.1:8545) on HTTPS domains like Vercel. For Hardhat testing, open http://localhost:2035 in your browser. For Vercel, switch MetaMask to Ethereum Sepolia!'
      )
    }
    await this.autoFundLocal(chainId)
    const signer = this.getSigner(chainId)
    const txHash = await contractClient.joinGame(chainId, signer, gameId, stakeEth)
    return txHash
  }

  /**
   * Bot automatically commits a random move (ATTACK, SHIELD, SCAN) with a secret salt on-chain.
   */
  async autoCommit(chainId: number, gameId: bigint, round: bigint): Promise<{ move: Move; txHash: string }> {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && chainId === 31337) {
      throw new Error(
        'Browsers block local HTTP (http://127.0.0.1:8545) on HTTPS domains like Vercel. For Hardhat testing, open http://localhost:2035 in your browser. For Vercel, switch MetaMask to Ethereum Sepolia!'
      )
    }
    await this.autoFundLocal(chainId)
    const signer = this.getSigner(chainId)
    const contractAddr = contractClient.getContractAddress(chainId)
    if (!contractAddr) throw new Error('Contract address not found')

    let chosenMove: Move
    let salt: string

    // Check if a salt was already generated for this exact game and round to prevent overwriting
    const existing = this.getStoredCommitment(chainId, gameId, round)
    if (existing) {
      chosenMove = existing.move
      salt = existing.salt
    } else {
      const moves = [Move.ATTACK, Move.SHIELD, Move.SCAN]
      chosenMove = moves[Math.floor(Math.random() * moves.length)]
      salt = makeSalt()
      this.saveCommitment(chainId, gameId, round, chosenMove, salt)
    }

    const commitment = makeCommitment({
      contract: contractAddr,
      chainId,
      gameId,
      round,
      player: signer.address,
      move: chosenMove,
      salt,
    })

    try {
      const txHash = await contractClient.commitMove(chainId, signer, gameId, commitment)
      return { move: chosenMove, txHash }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Already committed')) {
        return { move: chosenMove, txHash: '' }
      }
      throw err
    }
  }

  /**
   * Bot automatically reveals its move on-chain using the stored salt.
   */
  async autoReveal(chainId: number, gameId: bigint, round: bigint): Promise<string> {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && chainId === 31337) {
      throw new Error(
        'Browsers block local HTTP (http://127.0.0.1:8545) on HTTPS domains like Vercel. For Hardhat testing, open http://localhost:2035 in your browser. For Vercel, switch MetaMask to Ethereum Sepolia!'
      )
    }
    await this.autoFundLocal(chainId)
    const signer = this.getSigner(chainId)

    const stored = this.getStoredCommitment(chainId, gameId, round)
    if (!stored) {
      throw new Error(`Bot commitment salt not found for game ${gameId} round ${round}`)
    }

    try {
      const txHash = await contractClient.revealMove(chainId, signer, gameId, stored.move, stored.salt)
      return txHash
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Already revealed')) {
        return ''
      }
      throw err
    }
  }
}

export const botPlayer = new BotPlayer()
