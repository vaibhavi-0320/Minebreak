import { ethers } from 'ethers'
import vaultBreakArtifact from './contract/VaultBreak.json'
import { NETWORKS } from './networks'
import type { GameView, RoundStateView, Move, Phase } from './types'

export interface ContractDeployment {
  address: string
  deployBlock?: number
}

export interface ArtifactData {
  abi: ethers.InterfaceAbi
  bytecode?: string
  deployments: Record<string, ContractDeployment>
}

export interface MatchReceiptRound {
  round: number
  infiltratorMove: Move
  defenderMove: Move
  infiltratorCommitHash?: string
  defenderCommitHash?: string
  infiltratorValidReveal: boolean
  defenderValidReveal: boolean
  result: number
  infiltratorScore: number
  defenderScore: number
}

export interface MatchReceipt {
  gameId: bigint
  chainId: number
  infiltrator: string
  defender: string
  winner: string
  stake: bigint
  payout: bigint
  phase: Phase
  finalInfiltratorScore: number
  finalDefenderScore: number
  rounds: MatchReceiptRound[]
  events: Array<{
    name: string
    txHash: string
    blockNumber: number
    args: Record<string, unknown>
  }>
}

const artifact = vaultBreakArtifact as unknown as ArtifactData

// Cache for queried logs to prevent hitting RPC rate limits
const eventLogCache: Record<string, { toBlock: number; logs: ethers.Log[] }> = {}

export class ContractClient {
  setCustomContractAddress(chainId: number, address: string, deployBlock?: number): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`minebreak_contract_${chainId}`, address)
      if (deployBlock !== undefined) {
        localStorage.setItem(`minebreak_contract_block_${chainId}`, String(deployBlock))
      }
    }
  }

  getContractAddress(chainId: number): string | null {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(`minebreak_contract_${chainId}`)
      if (saved && ethers.isAddress(saved)) return saved
    }
    const deployment = artifact.deployments[chainId.toString()]
    return deployment?.address ?? null
  }

  getDeployBlock(chainId: number): number {
    if (typeof localStorage !== 'undefined') {
      const savedBlock = localStorage.getItem(`minebreak_contract_block_${chainId}`)
      if (savedBlock && !isNaN(Number(savedBlock))) return Number(savedBlock)
    }
    const deployment = artifact.deployments[chainId.toString()]
    return deployment?.deployBlock ?? 0
  }

  async deployContract(signer: ethers.Signer): Promise<{ address: string; deployBlock: number; txHash: string }> {
    if (!artifact.bytecode) {
      throw new Error('VaultBreak bytecode not found in artifact')
    }
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer)
    const contract = await factory.deploy()
    await contract.waitForDeployment()
    const address = await contract.getAddress()

    const deployTx = contract.deploymentTransaction()
    let deployBlock = 0
    if (deployTx && signer.provider) {
      const receipt = await deployTx.wait()
      deployBlock = receipt ? receipt.blockNumber : await signer.provider.getBlockNumber()
    } else if (signer.provider) {
      deployBlock = await signer.provider.getBlockNumber()
    }

    const network = await signer.provider?.getNetwork()
    const chainId = Number(network?.chainId ?? 31337)
    this.setCustomContractAddress(chainId, address, deployBlock)

    return { address, deployBlock, txHash: deployTx?.hash ?? '' }
  }

  async requestLocalFaucet(address: string): Promise<string> {
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545')
    const formatted = ethers.getAddress(address)
    // 10 ETH in hex = 0x8ac7230489e80000
    await provider.send('hardhat_setBalance', [formatted, '0x8ac7230489e80000'])
    const bal = await provider.getBalance(formatted)
    return ethers.formatEther(bal)
  }

  getReadOnlyContract(chainId: number): ethers.Contract {
    const addr = this.getContractAddress(chainId)
    if (!addr) {
      throw new Error(`VaultBreak contract not deployed on chain ${chainId}`)
    }
    const net = NETWORKS[chainId]
    const rpcUrl = net?.rpcUrl ?? 'http://127.0.0.1:8545'
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    return new ethers.Contract(addr, artifact.abi, provider)
  }

  getWriteContract(chainId: number, signer: ethers.Signer): ethers.Contract {
    const addr = this.getContractAddress(chainId)
    if (!addr) {
      throw new Error(`VaultBreak contract not deployed on chain ${chainId}`)
    }
    return new ethers.Contract(addr, artifact.abi, signer)
  }

  async getGame(chainId: number, gameId: bigint | number): Promise<GameView> {
    const contract = this.getReadOnlyContract(chainId)
    const raw = await contract.getGame(gameId)
    const stake = await contract.stakeOf(gameId)

    return {
      gameId: BigInt(gameId),
      infiltrator: raw[0],
      defender: raw[1],
      infiltratorScore: Number(raw[2]),
      defenderScore: Number(raw[3]),
      round: BigInt(raw[4]),
      phase: Number(raw[5]) as Phase,
      winner: raw[6],
      deadline: BigInt(raw[7]),
      stake: BigInt(stake),
    }
  }

  async getGameOrNull(chainId: number, gameId: bigint | number): Promise<GameView | null> {
    try {
      return await this.getGame(chainId, gameId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (
        msg.includes('Game does not exist') ||
        msg.includes('missing revert data') ||
        msg.includes('CALL_EXCEPTION')
      ) {
        return null
      }
      throw err
    }
  }

  async getRoundState(chainId: number, gameId: bigint | number): Promise<RoundStateView> {
    const contract = this.getReadOnlyContract(chainId)
    const raw = await contract.getRoundState(gameId)
    return {
      infiltratorCommitted: Boolean(raw[0]),
      defenderCommitted: Boolean(raw[1]),
      infiltratorRevealed: Boolean(raw[2]),
      defenderRevealed: Boolean(raw[3]),
      lastInfiltratorMove: Number(raw[4]) as Move,
      lastDefenderMove: Number(raw[5]) as Move,
      lastResult: Number(raw[6]),
    }
  }

  async getPendingWithdrawal(chainId: number, player: string): Promise<bigint> {
    try {
      const contract = this.getReadOnlyContract(chainId)
      return (await contract.pendingWithdrawals(player)) as bigint
    } catch {
      return 0n
    }
  }

  async getPlayerStats(chainId: number, player: string): Promise<{ wins: number; played: number }> {
    try {
      const contract = this.getReadOnlyContract(chainId)
      const w = await contract.wins(player)
      const p = await contract.played(player)
      return { wins: Number(w), played: Number(p) }
    } catch {
      return { wins: 0, played: 0 }
    }
  }

  private async getEstimatedGas(
    contract: ethers.Contract,
    method: string,
    args: unknown[],
    overrides: ethers.Overrides = {},
    fallbackLimit: bigint = 200000n
  ): Promise<bigint> {
    try {
      const fn = contract[method]
      if (typeof fn?.estimateGas === 'function') {
        const estimated: bigint = await fn.estimateGas(...args, overrides)
        return (estimated * 130n) / 100n
      }
      return fallbackLimit
    } catch {
      return fallbackLimit
    }
  }

  async createGame(chainId: number, signer: ethers.Signer, stakeEth: string): Promise<{ gameId: bigint; txHash: string }> {
    const contract = this.getWriteContract(chainId, signer)
    const value = ethers.parseEther(stakeEth || '0')
    const gasLimit = await this.getEstimatedGas(contract, 'createGame', [], { value }, 150000n)
    const tx = await contract.createGame({ value, gasLimit })
    const receipt = await tx.wait()

    let gameId = 0n
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log)
        if (parsed?.name === 'GameCreated') {
          gameId = BigInt(parsed.args[0])
          break
        }
      } catch {
        // non-matching log
      }
    }

    return { gameId, txHash: receipt.hash }
  }

  async joinGame(chainId: number, signer: ethers.Signer, gameId: bigint, stakeEth: string): Promise<string> {
    const contract = this.getWriteContract(chainId, signer)
    const value = ethers.parseEther(stakeEth || '0')
    const gasLimit = await this.getEstimatedGas(contract, 'joinGame', [gameId], { value }, 150000n)
    const tx = await contract.joinGame(gameId, { value, gasLimit })
    const receipt = await tx.wait()
    return receipt.hash
  }

  async cancelGame(chainId: number, signer: ethers.Signer, gameId: bigint): Promise<string> {
    const contract = this.getWriteContract(chainId, signer)
    const gasLimit = await this.getEstimatedGas(contract, 'cancelGame', [gameId], {}, 100000n)
    const tx = await contract.cancelGame(gameId, { gasLimit })
    const receipt = await tx.wait()
    return receipt.hash
  }

  async commitMove(chainId: number, signer: ethers.Signer, gameId: bigint, commitment: string): Promise<string> {
    const contract = this.getWriteContract(chainId, signer)
    const gasLimit = await this.getEstimatedGas(contract, 'commitMove', [gameId, commitment], {}, 120000n)
    const tx = await contract.commitMove(gameId, commitment, { gasLimit })
    const receipt = await tx.wait()
    return receipt.hash
  }

  async revealMove(chainId: number, signer: ethers.Signer, gameId: bigint, move: Move, salt: string): Promise<string> {
    const contract = this.getWriteContract(chainId, signer)
    const gasLimit = await this.getEstimatedGas(contract, 'revealMove', [gameId, move, salt], {}, 250000n)
    const tx = await contract.revealMove(gameId, move, salt, { gasLimit })
    const receipt = await tx.wait()
    return receipt.hash
  }

  async claimTimeout(chainId: number, signer: ethers.Signer, gameId: bigint): Promise<string> {
    const contract = this.getWriteContract(chainId, signer)
    const gasLimit = await this.getEstimatedGas(contract, 'claimTimeout', [gameId], {}, 120000n)
    const tx = await contract.claimTimeout(gameId, { gasLimit })
    const receipt = await tx.wait()
    return receipt.hash
  }

  async withdraw(chainId: number, signer: ethers.Signer): Promise<string> {
    const contract = this.getWriteContract(chainId, signer)
    const gasLimit = await this.getEstimatedGas(contract, 'withdraw', [], {}, 80000n)
    const tx = await contract.withdraw({ gasLimit })
    const receipt = await tx.wait()
    return receipt.hash
  }

  /**
   * Incremental chunked log query to avoid public RPC rate limits
   */
  async getContractLogsChunked(chainId: number, fromBlockOverride?: number): Promise<ethers.Log[]> {
    const contract = this.getReadOnlyContract(chainId)
    const provider = contract.runner?.provider as ethers.JsonRpcProvider
    if (!provider) return []

    const currentBlock = await provider.getBlockNumber()
    const deployBlock = fromBlockOverride ?? this.getDeployBlock(chainId)
    const cacheKey = `${chainId}_${contract.target}`
    const cached = eventLogCache[cacheKey] || { toBlock: deployBlock, logs: [] }

    const fromBlock = cached.toBlock <= deployBlock ? deployBlock : cached.toBlock + 1
    if (fromBlock > currentBlock) {
      return cached.logs
    }

    const maxChunk = 1000
    const newLogs: ethers.Log[] = []

    for (let chunkStart = fromBlock; chunkStart <= currentBlock; chunkStart += maxChunk) {
      const chunkEnd = Math.min(chunkStart + maxChunk - 1, currentBlock)
      try {
        const logs = await provider.getLogs({
          address: contract.target,
          fromBlock: chunkStart,
          toBlock: chunkEnd,
        })
        newLogs.push(...logs)
      } catch (err) {
        console.warn(`Error querying logs chunk ${chunkStart}-${chunkEnd}:`, err)
        break
      }
    }

    const allLogs = [...cached.logs, ...newLogs]
    eventLogCache[cacheKey] = { toBlock: currentBlock, logs: allLogs }
    return allLogs
  }

  /**
   * Fetches full match receipt and round events for /match/:gameId
   */
  async getMatchReceipt(chainId: number, gameId: bigint | number): Promise<MatchReceipt> {
    const targetId = BigInt(gameId)
    const game = await this.getGame(chainId, targetId)
    const contract = this.getReadOnlyContract(chainId)
    const logs = await this.getContractLogsChunked(chainId)

    const parsedEvents: MatchReceipt['events'] = []
    const roundMap: Record<number, MatchReceiptRound> = {}

    for (const log of logs) {
      try {
        const parsed = contract.interface.parseLog(log)
        if (!parsed) continue

        const evGameId = parsed.args.gameId !== undefined ? BigInt(parsed.args.gameId) : null
        if (evGameId === null || evGameId !== targetId) continue

        const argsObj: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(parsed.args)) {
          if (isNaN(Number(k))) {
            argsObj[k] = typeof v === 'bigint' ? v.toString() : v
          }
        }

        parsedEvents.push({
          name: parsed.name,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          args: argsObj,
        })

        // Process round-level events
        if (parsed.name === 'MoveCommitted') {
          const rNum = Number(parsed.args.round)
          if (!roundMap[rNum]) {
            roundMap[rNum] = {
              round: rNum,
              infiltratorMove: 0 as Move,
              defenderMove: 0 as Move,
              infiltratorValidReveal: false,
              defenderValidReveal: false,
              result: 0,
              infiltratorScore: 0,
              defenderScore: 0,
            }
          }
        } else if (parsed.name === 'MoveRevealed') {
          const rNum = Number(parsed.args.round)
          const pAddr = String(parsed.args.player).toLowerCase()
          const move = Number(parsed.args.move) as Move
          if (!roundMap[rNum]) {
            roundMap[rNum] = {
              round: rNum,
              infiltratorMove: 0 as Move,
              defenderMove: 0 as Move,
              infiltratorValidReveal: false,
              defenderValidReveal: false,
              result: 0,
              infiltratorScore: 0,
              defenderScore: 0,
            }
          }
          if (pAddr === game.infiltrator.toLowerCase()) {
            roundMap[rNum].infiltratorMove = move
            roundMap[rNum].infiltratorValidReveal = true
          } else if (pAddr === game.defender.toLowerCase()) {
            roundMap[rNum].defenderMove = move
            roundMap[rNum].defenderValidReveal = true
          }
        } else if (parsed.name === 'RoundResolved') {
          const rNum = Number(parsed.args.round)
          if (!roundMap[rNum]) {
            roundMap[rNum] = {
              round: rNum,
              infiltratorMove: 0 as Move,
              defenderMove: 0 as Move,
              infiltratorValidReveal: true,
              defenderValidReveal: true,
              result: 0,
              infiltratorScore: 0,
              defenderScore: 0,
            }
          }
          roundMap[rNum].infiltratorMove = Number(parsed.args.infiltratorMove) as Move
          roundMap[rNum].defenderMove = Number(parsed.args.defenderMove) as Move
          roundMap[rNum].result = Number(parsed.args.result)
          roundMap[rNum].infiltratorScore = Number(parsed.args.infiltratorScore)
          roundMap[rNum].defenderScore = Number(parsed.args.defenderScore)
          roundMap[rNum].infiltratorValidReveal = true
          roundMap[rNum].defenderValidReveal = true
        }
      } catch {
        // non-contract log
      }
    }

    const rounds = Object.values(roundMap).sort((a, b) => a.round - b.round)
    const pot = game.stake * 2n

    return {
      gameId: targetId,
      chainId,
      infiltrator: game.infiltrator,
      defender: game.defender,
      winner: game.winner,
      stake: game.stake,
      payout: game.winner !== ethers.ZeroAddress ? pot : 0n,
      phase: game.phase,
      finalInfiltratorScore: game.infiltratorScore,
      finalDefenderScore: game.defenderScore,
      rounds,
      events: parsedEvents,
    }
  }
}

export const contractClient = new ContractClient()
