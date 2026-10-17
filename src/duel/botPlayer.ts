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

    // Pick random move between ATTACK (1), SHIELD (2), and SCAN (3)
    const moves = [Move.ATTACK, Move.SHIELD, Move.SCAN]
    const chosenMove = moves[Math.floor(Math.random() * moves.length)]
    const salt = makeSalt()

    // Store bot's salt and move for later reveal
    const storageKey = `${BOT_SALT_PREFIX}${chainId}_${gameId}_${round}`
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify({ move: chosenMove, salt }))
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

    const txHash = await contractClient.commitMove(chainId, signer, gameId, commitment)
    return { move: chosenMove, txHash }
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
    const signer = this.getSigner(chainId)
    const storageKey = `${BOT_SALT_PREFIX}${chainId}_${gameId}_${round}`

    let move = Move.ATTACK
    let salt = '0x' + '00'.repeat(32)

    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          move = parsed.move
          salt = parsed.salt
        } catch (_) {}
      }
    }

    const txHash = await contractClient.revealMove(chainId, signer, gameId, move, salt)
    return txHash
  }
}

export const botPlayer = new BotPlayer()
