import { create } from 'zustand'
import { ethers } from 'ethers'
import { walletManager } from './wallet'
import { contractClient } from './contractClient'
import { botPlayer } from './botPlayer'
import { makeSalt, makeCommitment, saveCommitmentSalt, getCommitmentSalt } from './commitment'
import { STAKE_OPTIONS, getDefaultChainId, getNetwork } from './networks'
import { Move, Phase, type GameView, type RoundStateView } from './types'

export type PlayerRole = 'infiltrator' | 'defender' | 'spectator'

export interface PendingTxInfo {
  hash: string
  description: string
}

export function cleanErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error occurred'
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED') || msg.includes('4001')) {
    return 'Transaction rejected in wallet.'
  }
  if (msg.includes('insufficient funds')) {
    return 'Insufficient ETH balance for transaction + gas.'
  }
  if (msg.includes('Game does not exist')) {
    return 'Game does not exist on this network.'
  }
  if (msg.includes('Cannot play against yourself')) {
    return 'Cannot play against yourself. Please use a second account or Play vs Bot.'
  }
  if (msg.includes('Not in commit phase')) {
    return 'Round is not in commit phase.'
  }
  if (msg.includes('Not in reveal phase')) {
    return 'Round is not in reveal phase.'
  }
  if (msg.includes('VaultBreak contract not deployed')) {
    return msg
  }
  const match = msg.match(/reason="([^"]+)"/)
  if (match) return match[1]
  const revertMatch = msg.match(/execution reverted: "([^"]+)"/)
  if (revertMatch) return revertMatch[1]
  return msg.length > 140 ? msg.slice(0, 140) + '...' : msg
}

export interface DuelState {
  duelModeOpen: boolean
  isConnecting: boolean
  address: string | null
  chainId: number
  balance: string
  walletError: string | null

  selectedStakeIndex: number
  joinGameInput: string
  statusMessage: string | null
  isActing: boolean
  pendingTx: PendingTxInfo | null

  currentGame: GameView | null
  currentRoundState: RoundStateView | null
  myRole: PlayerRole | null
  selectedMove: Move

  matchReceiptGameId: bigint | null

  pendingWithdrawal: bigint
  playerStats: { wins: number; played: number }

  // Bot Demo Support
  isBotMatch: boolean
  botAddress: string
  botBalance: string
  botStatus: string | null

  openDuelMode: () => void
  closeDuelMode: () => void
  openMatchReceipt: (gameId: bigint | number) => void
  closeMatchReceipt: () => void
  connectWallet: () => Promise<void>
  switchNetwork: (targetChainId: number) => Promise<void>
  refreshWallet: () => Promise<void>
  refreshBotInfo: () => Promise<void>
  setSelectedStakeIndex: (idx: number) => void
  setJoinGameInput: (val: string) => void
  setSelectedMove: (m: Move) => void

  deployContract: () => Promise<void>
  requestLocalFaucet: () => Promise<void>
  startBotMatch: () => Promise<void>
  fundBot: (amountEth?: string) => Promise<void>
  sweepBotFunds: () => Promise<void>

  createGame: () => Promise<void>
  joinGame: (targetGameId?: bigint | string) => Promise<void>
  cancelGame: () => Promise<void>
  commitMove: (move: Move) => Promise<void>
  revealMove: () => Promise<void>
  claimTimeout: () => Promise<void>
  withdraw: () => Promise<void>
  loadGame: (gameId: bigint | number) => Promise<void>
  refreshCurrentGame: () => Promise<void>
  leaveCurrentGame: () => void
}

let pollTimer: number | null = null
let botActionInProgress = false

function determineRole(game: GameView, userAddress: string | null): PlayerRole {
  if (!userAddress) return 'spectator'
  const addr = userAddress.toLowerCase()
  if (game.infiltrator.toLowerCase() === addr) return 'infiltrator'
  if (game.defender.toLowerCase() === addr) return 'defender'
  return 'spectator'
}

export const useDuelStore = create<DuelState>((set, get) => ({
  duelModeOpen: false,
  isConnecting: false,
  address: null,
  chainId: getDefaultChainId(),
  balance: '0.0',
  walletError: null,

  selectedStakeIndex: 0,
  joinGameInput: '',
  statusMessage: null,
  isActing: false,
  pendingTx: null,

  currentGame: null,
  currentRoundState: null,
  myRole: null,
  selectedMove: Move.NONE,
  matchReceiptGameId: null,

  pendingWithdrawal: 0n,
  playerStats: { wins: 0, played: 0 },

  isBotMatch: false,
  botAddress: botPlayer.getBotAddress(),
  botBalance: '0.0',
  botStatus: null,

  openDuelMode: () => {
    set({ duelModeOpen: true })
    get().refreshBotInfo()
  },
  closeDuelMode: () => set({ duelModeOpen: false }),
  openMatchReceipt: (gameId: bigint | number) => set({ matchReceiptGameId: BigInt(gameId) }),
  closeMatchReceipt: () => set({ matchReceiptGameId: null }),

  refreshBotInfo: async () => {
    const { chainId } = get()
    try {
      const bal = await botPlayer.getBalance(chainId)
      set({ botAddress: botPlayer.getBotAddress(), botBalance: bal })
    } catch (_) {}
  },

  connectWallet: async () => {
    try {
      set({ isConnecting: true, walletError: null })
      const res = await walletManager.connect()
      let currentBal = res.balance

      // If connected to local Hardhat with low balance, auto-fund 10 ETH
      if (res.chainId === 31337 && parseFloat(res.balance) < 1.0) {
        try {
          currentBal = await contractClient.requestLocalFaucet(res.address)
        } catch (_) {}
      }

      set({
        address: res.address,
        chainId: res.chainId,
        balance: currentBal,
        isConnecting: false,
      })

      // Fetch pending withdrawal and stats
      const pw = await contractClient.getPendingWithdrawal(res.chainId, res.address)
      const st = await contractClient.getPlayerStats(res.chainId, res.address)
      set({ pendingWithdrawal: pw, playerStats: st })

      // Auto fund local bot if on localhost
      if (res.chainId === 31337) {
        await botPlayer.autoFundLocal(res.chainId)
      }
      await get().refreshBotInfo()

      // Listen for wallet changes
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts: unknown) => {
          const list = accounts as string[]
          if (!list || list.length === 0) {
            set({ address: null, balance: '0.0', currentGame: null })
          } else {
            set({ address: list[0] })
            get().refreshWallet()
          }
        })

        window.ethereum.on('chainChanged', (cId: unknown) => {
          const numChain = typeof cId === 'string' ? parseInt(cId, 16) : Number(cId)
          set({ chainId: numChain, currentGame: null })
          get().refreshWallet()
          get().refreshBotInfo()
        })
      }
    } catch (err: unknown) {
      const msg = cleanErrorMessage(err)
      set({ isConnecting: false, walletError: msg })
    }
  },

  switchNetwork: async (targetChainId: number) => {
    try {
      await walletManager.switchNetwork(targetChainId)
      set({ chainId: targetChainId, walletError: null, currentGame: null })
      await get().refreshWallet()
      await get().refreshBotInfo()
    } catch (err: unknown) {
      set({ walletError: cleanErrorMessage(err) })
    }
  },

  refreshWallet: async () => {
    const { address, chainId } = get()
    if (!address) return
    try {
      const bal = await walletManager.refreshBalance(address)
      const pw = await contractClient.getPendingWithdrawal(chainId, address)
      const st = await contractClient.getPlayerStats(chainId, address)
      set({ balance: bal, pendingWithdrawal: pw, playerStats: st })
    } catch (_) {}
  },

  setSelectedStakeIndex: (idx: number) => set({ selectedStakeIndex: idx }),
  setJoinGameInput: (val: string) => set({ joinGameInput: val }),
  setSelectedMove: (m: Move) => set({ selectedMove: m }),

  deployContract: async () => {
    if (get().isActing) return
    const signer = await walletManager.getSigner()
    if (!signer) {
      set({ statusMessage: 'Please connect your wallet first to deploy.' })
      return
    }

    const { chainId } = get()
    const netName = getNetwork(chainId)?.name ?? `Chain ${chainId}`
    set({ isActing: true, statusMessage: `Deploying VaultBreak contract to ${netName} via MetaMask...` })
    try {
      const res = await contractClient.deployContract(signer)
      set({
        statusMessage: `VaultBreak contract successfully deployed to: ${res.address} (block ${res.deployBlock})!`,
        pendingTx: { hash: res.txHash, description: `Deploy VaultBreak to ${netName}` },
      })
      await get().refreshWallet()
      await get().refreshBotInfo()
    } catch (err: unknown) {
      set({ statusMessage: `Deployment failed: ${cleanErrorMessage(err)}` })
    } finally {
      set({ isActing: false })
    }
  },

  requestLocalFaucet: async () => {
    const { address, chainId } = get()
    if (!address || chainId !== 31337) return
    set({ isActing: true, statusMessage: 'Requesting 10 Local ETH from hardhat faucet...' })
    try {
      const bal = await contractClient.requestLocalFaucet(address)
      await botPlayer.autoFundLocal(31337)
      set({ balance: bal, statusMessage: 'Received 10 Local Test ETH!' })
      await get().refreshBotInfo()
    } catch (err: unknown) {
      set({ statusMessage: `Faucet error: ${cleanErrorMessage(err)}` })
    } finally {
      set({ isActing: false })
    }
  },

  fundBot: async (amountEth = '0.003') => {
    if (get().isActing) return
    const signer = await walletManager.getSigner()
    if (!signer) return
    const botAddr = botPlayer.getBotAddress()
    const desc = `Fund Demo Bot (${amountEth} ETH)`
    set({ isActing: true, statusMessage: `Awaiting wallet signature to fund Bot with ${amountEth} ETH...` })
    try {
      const tx = await signer.sendTransaction({
        to: botAddr,
        value: ethers.parseEther(amountEth),
      })
      set({
        pendingTx: { hash: tx.hash, description: desc },
        statusMessage: 'Transaction sent, waiting for confirmation...',
      })
      await tx.wait()
      set({ statusMessage: `Demo Bot funded with ${amountEth} ETH!` })
      await get().refreshWallet()
      await get().refreshBotInfo()
    } catch (err: unknown) {
      set({ statusMessage: `Funding failed: ${cleanErrorMessage(err)}` })
    } finally {
      set({ isActing: false, pendingTx: null })
    }
  },

  sweepBotFunds: async () => {
    if (get().isActing) return
    const { address, chainId } = get()
    if (!address) return
    set({ isActing: true, statusMessage: 'Sweeping bot balance back to your wallet...' })
    try {
      const txHash = await botPlayer.sweepFunds(address, chainId)
      set({
        statusMessage: 'Bot funds returned to your wallet!',
        pendingTx: txHash ? { hash: txHash, description: 'Sweep Bot funds' } : null,
      })
      await get().refreshWallet()
      await get().refreshBotInfo()
    } catch (err: unknown) {
      set({ statusMessage: `Sweep error: ${cleanErrorMessage(err)}` })
    } finally {
      set({ isActing: false, pendingTx: null })
    }
  },

  startBotMatch: async () => {
    if (get().isActing) return
    const { chainId, address, selectedStakeIndex } = get()
    if (!address) {
      await get().connectWallet()
    }
    const signer = await walletManager.getSigner()
    if (!signer) throw new Error('No signer available')

    const contractAddr = contractClient.getContractAddress(chainId)
    if (!contractAddr) {
      set({ statusMessage: `VaultBreak contract is not deployed on this chain (${chainId}). Deploy it first!` })
      return
    }

    const stakeAmount = STAKE_OPTIONS[selectedStakeIndex] ?? 0
    const stakeEth = stakeAmount.toString()
    const net = getNetwork(chainId)

    // Ensure bot has gas
    if (chainId === 31337) {
      await botPlayer.autoFundLocal(chainId)
    } else {
      const botBal = parseFloat(await botPlayer.getBalance(chainId))
      const requiredBal = stakeAmount + 0.002
      if (botBal < requiredBal) {
        set({
          statusMessage: `Demo Bot needs gas (~0.003 Sepolia ETH) to play on-chain. Please click "Fund Bot" first!`,
        })
        return
      }
    }

    const desc = `Solo Demo Duel (Stake: ${stakeEth} ${net?.currencySymbol ?? 'ETH'})`
    set({
      isActing: true,
      isBotMatch: true,
      botStatus: 'Waiting for your wallet confirmation...',
      statusMessage: `Awaiting wallet signature for ${desc}...`,
    })

    try {
      // Step 1: User creates the game on-chain
      const res = await contractClient.createGame(chainId, signer, stakeEth)
      set({
        pendingTx: { hash: res.txHash, description: desc },
        statusMessage: `Game #${res.gameId} created! Bot joining on-chain...`,
        botStatus: 'Bot joining as Defender...',
      })

      // Step 2: Bot automatically joins on-chain
      await botPlayer.autoJoin(chainId, res.gameId, stakeEth)
      set({
        statusMessage: `Game #${res.gameId} live! You are Infiltrator. Choose your move!`,
        botStatus: 'Bot joined. Awaiting your secret move.',
      })

      await get().loadGame(res.gameId)
      await get().refreshWallet()
      await get().refreshBotInfo()
    } catch (err: unknown) {
      set({
        isBotMatch: false,
        statusMessage: `Failed to start Solo Demo: ${cleanErrorMessage(err)}`,
        botStatus: null,
      })
    } finally {
      set({ isActing: false, pendingTx: null })
    }
  },

  createGame: async () => {
    if (get().isActing) return
    const { chainId, selectedStakeIndex, address } = get()
    if (!address) {
      await get().connectWallet()
    }
    const signer = await walletManager.getSigner()
    if (!signer) throw new Error('No signer available')

    const contractAddr = contractClient.getContractAddress(chainId)
    if (!contractAddr) {
      set({ statusMessage: `VaultBreak contract is not deployed on this chain (${chainId}). Deploy it first!` })
      return
    }

    const stakeAmount = STAKE_OPTIONS[selectedStakeIndex] ?? 0
    const stakeEth = stakeAmount.toString()
    const desc = `Hosting duel with stake ${stakeEth} ${getNetwork(chainId)?.currencySymbol ?? 'ETH'}`

    set({ isActing: true, isBotMatch: false, statusMessage: `Awaiting wallet signature for: ${desc}...` })
    try {
      const res = await contractClient.createGame(chainId, signer, stakeEth)
      set({
        pendingTx: { hash: res.txHash, description: desc },
        statusMessage: `Game #${res.gameId} created! Waiting for Defender to join...`,
      })
      await get().loadGame(res.gameId)
      await get().refreshWallet()
    } catch (err: unknown) {
      set({ statusMessage: `Failed to create game: ${cleanErrorMessage(err)}` })
    } finally {
      set({ isActing: false, pendingTx: null })
    }
  },

  joinGame: async (targetGameId?: bigint | string) => {
    if (get().isActing) return
    const { chainId, joinGameInput, address } = get()
    const target = targetGameId ?? joinGameInput.trim()
    if (!target) {
      set({ statusMessage: 'Please enter a valid Game ID' })
      return
    }
    if (!address) {
      await get().connectWallet()
    }
    const signer = await walletManager.getSigner()
    if (!signer) throw new Error('No signer available')

    const gameId = BigInt(target)
    set({ isActing: true, statusMessage: `Inspecting Game #${gameId}...` })
    try {
      const game = await contractClient.getGameOrNull(chainId, gameId)
      if (!game) {
        set({
          statusMessage: `Game #${gameId} was not found on this network. Please verify the Game ID or host a new match.`,
        })
        return
      }
      if (game.phase !== Phase.WAITING) {
        set({
          statusMessage: `Game #${gameId} is not open for joining (currently ${game.phase === Phase.FINISHED ? 'Finished' : 'In Progress'}).`,
        })
        return
      }

      const stakeEth = ethers.formatEther(game.stake)
      const desc = `Joining Game #${gameId} with stake ${stakeEth} ${getNetwork(chainId)?.currencySymbol ?? 'ETH'}`
      set({ statusMessage: `Awaiting signature: ${desc}...` })

      const txHash = await contractClient.joinGame(chainId, signer, gameId, stakeEth)
      set({
        pendingTx: { hash: txHash, description: desc },
        statusMessage: `Joined Game #${gameId} successfully!`,
      })
      await get().loadGame(gameId)
      await get().refreshWallet()
    } catch (err: unknown) {
      set({ statusMessage: `Failed to join game: ${cleanErrorMessage(err)}` })
    } finally {
      set({ isActing: false, pendingTx: null })
    }
  },

  cancelGame: async () => {
    if (get().isActing) return
    const { chainId, currentGame } = get()
    if (!currentGame) return
    const signer = await walletManager.getSigner()
    if (!signer) return

    const desc = `Cancelling duel #${currentGame.gameId}`
    set({ isActing: true, statusMessage: `Awaiting signature: ${desc}...` })
    try {
      const txHash = await contractClient.cancelGame(chainId, signer, currentGame.gameId)
      set({
        pendingTx: { hash: txHash, description: desc },
        statusMessage: 'Duel cancelled. Stake refunded to pending balance.',
      })
      await get().loadGame(currentGame.gameId)
      await get().refreshWallet()
    } catch (err: unknown) {
      set({ statusMessage: `Failed to cancel: ${cleanErrorMessage(err)}` })
    } finally {
      set({ isActing: false, pendingTx: null })
    }
  },

  commitMove: async (move: Move) => {
    if (get().isActing) return
    const { chainId, currentGame, address, isBotMatch } = get()
    if (!currentGame || !address) return
    const signer = await walletManager.getSigner()
    if (!signer) return

    const contractAddr = contractClient.getContractAddress(chainId)
    if (!contractAddr) return

    const desc = `Committing secret move for round ${currentGame.round}`
    set({ isActing: true, statusMessage: `Generating cryptographic salt and committing move...` })
    try {
      const salt = makeSalt()
      const commitment = makeCommitment({
        contract: contractAddr,
        chainId,
        gameId: currentGame.gameId,
        round: currentGame.round,
        player: address,
        move,
        salt,
      })

      saveCommitmentSalt({
        gameId: currentGame.gameId.toString(),
        round: currentGame.round.toString(),
        player: address,
        move,
        salt,
        commitment,
      })

      const txHash = await contractClient.commitMove(chainId, signer, currentGame.gameId, commitment)
      set({
        pendingTx: { hash: txHash, description: desc },
        statusMessage: isBotMatch ? 'Move committed! Bot is choosing its move...' : 'Move committed! Waiting for opponent...',
      })

      await get().refreshCurrentGame()

      // If in Solo Demo Bot match, bot immediately commits its move
      if (isBotMatch) {
        set({ botStatus: 'Bot committing secret move on-chain...' })
        try {
          await botPlayer.autoCommit(chainId, currentGame.gameId, currentGame.round)
          set({ botStatus: 'Bot committed. Round is in REVEAL phase!' })
        } catch (botErr) {
          console.warn('Bot auto-commit error:', botErr)
        }
        await get().refreshCurrentGame()
      }
    } catch (err: unknown) {
      set({ statusMessage: `Commit error: ${cleanErrorMessage(err)}` })
    } finally {
      set({ isActing: false, pendingTx: null })
    }
  },

  revealMove: async () => {
    if (get().isActing) return
    const { chainId, currentGame, address, isBotMatch } = get()
    if (!currentGame || !address) return
    const signer = await walletManager.getSigner()
    if (!signer) return

    const desc = `Revealing secret move for round ${currentGame.round}`
    set({ isActing: true, statusMessage: 'Retrieving salt and revealing move on-chain...' })
    try {
      const stored = getCommitmentSalt(currentGame.gameId, currentGame.round, address)
      if (!stored) {
        throw new Error('Secret salt not found in local storage for this round.')
      }

      const txHash = await contractClient.revealMove(chainId, signer, currentGame.gameId, stored.move as Move, stored.salt)
      set({
        pendingTx: { hash: txHash, description: desc },
        statusMessage: isBotMatch ? 'Move revealed! Bot is revealing its move...' : 'Move revealed! Resolving round...',
      })

      await get().refreshCurrentGame()

      // If in Solo Demo Bot match, bot immediately reveals its move
      if (isBotMatch) {
        set({ botStatus: 'Bot revealing move on-chain...' })
        try {
          await botPlayer.autoReveal(chainId, currentGame.gameId, currentGame.round)
          set({ botStatus: 'Bot revealed! Round resolved.' })
        } catch (botErr) {
          console.warn('Bot auto-reveal error:', botErr)
        }
        await get().refreshCurrentGame()
      }
    } catch (err: unknown) {
      set({ statusMessage: `Reveal error: ${cleanErrorMessage(err)}` })
    } finally {
      set({ isActing: false, pendingTx: null })
    }
  },

  claimTimeout: async () => {
    if (get().isActing) return
    const { chainId, currentGame } = get()
    if (!currentGame) return
    const signer = await walletManager.getSigner()
    if (!signer) return

    const desc = `Claiming timeout for duel #${currentGame.gameId}`
    set({ isActing: true, statusMessage: 'Awaiting signature: claiming timeout...' })
    try {
      const txHash = await contractClient.claimTimeout(chainId, signer, currentGame.gameId)
      set({
        pendingTx: { hash: txHash, description: desc },
        statusMessage: 'Timeout claimed successfully.',
      })
      await get().refreshCurrentGame()
      await get().refreshWallet()
    } catch (err: unknown) {
      set({ statusMessage: `Timeout claim error: ${cleanErrorMessage(err)}` })
    } finally {
      set({ isActing: false, pendingTx: null })
    }
  },

  withdraw: async () => {
    if (get().isActing) return
    const { chainId, address } = get()
    if (!address) return
    const signer = await walletManager.getSigner()
    if (!signer) return

    const desc = 'Withdrawing pending winnings'
    set({ isActing: true, statusMessage: 'Awaiting signature: withdrawing winnings...' })
    try {
      const txHash = await contractClient.withdraw(chainId, signer)
      set({
        pendingTx: { hash: txHash, description: desc },
        statusMessage: 'Funds successfully withdrawn to your wallet!',
      })
      await get().refreshWallet()
    } catch (err: unknown) {
      set({ statusMessage: `Withdraw error: ${cleanErrorMessage(err)}` })
    } finally {
      set({ isActing: false, pendingTx: null })
    }
  },

  loadGame: async (gameId: bigint | number) => {
    const { chainId, address } = get()
    try {
      const game = await contractClient.getGame(chainId, gameId)
      const roundState = await contractClient.getRoundState(chainId, gameId)
      const myRole = determineRole(game, address)

      set({
        currentGame: game,
        currentRoundState: roundState,
        myRole,
        selectedMove: Move.NONE,
      })

      if (pollTimer) clearInterval(pollTimer)
      if (game.phase !== Phase.FINISHED) {
        pollTimer = window.setInterval(() => {
          get().refreshCurrentGame()
        }, 2500)
      }
    } catch (err: unknown) {
      set({ statusMessage: `Failed to load game: ${cleanErrorMessage(err)}` })
    }
  },

  refreshCurrentGame: async () => {
    const { chainId, currentGame, address, isBotMatch } = get()
    if (!currentGame) return
    try {
      const updated = await contractClient.getGame(chainId, currentGame.gameId)
      const roundState = await contractClient.getRoundState(chainId, currentGame.gameId)
      const myRole = determineRole(updated, address)

      set({
        currentGame: updated,
        currentRoundState: roundState,
        myRole,
      })

      // Bot background handler if needed
      if (isBotMatch && !botActionInProgress) {
        if (updated.phase === Phase.COMMIT && roundState.infiltratorCommitted && !roundState.defenderCommitted) {
          botActionInProgress = true
          set({ botStatus: 'Bot committing move...' })
          try {
            await botPlayer.autoCommit(chainId, updated.gameId, updated.round)
            set({ botStatus: 'Bot committed move.' })
          } catch (e) {
            console.warn('Bot background commit failed:', e)
          } finally {
            botActionInProgress = false
          }
        } else if (updated.phase === Phase.REVEAL && roundState.infiltratorRevealed && !roundState.defenderRevealed) {
          botActionInProgress = true
          set({ botStatus: 'Bot revealing move...' })
          try {
            await botPlayer.autoReveal(chainId, updated.gameId, updated.round)
            set({ botStatus: 'Bot revealed move.' })
          } catch (e) {
            console.warn('Bot background reveal failed:', e)
          } finally {
            botActionInProgress = false
          }
        }
      }

      if (updated.phase === Phase.FINISHED && pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
        get().refreshWallet()
        get().refreshBotInfo()
      }
    } catch {
      // background poll failure is non-fatal
    }
  },

  leaveCurrentGame: () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    set({
      currentGame: null,
      currentRoundState: null,
      myRole: null,
      statusMessage: null,
      pendingTx: null,
      isBotMatch: false,
      botStatus: null,
    })
  },
}))
