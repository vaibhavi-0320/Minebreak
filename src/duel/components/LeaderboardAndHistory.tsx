import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { contractClient } from '../contractClient'
import { useDuelStore } from '../duelStore'
import { getNetwork } from '../networks'

interface OpenGame {
  gameId: bigint
  creator: string
  stake: bigint
  txHash: string
}

interface FinishedGame {
  gameId: bigint
  winner: string
  infiltratorScore: number
  defenderScore: number
  txHash: string
}

interface LeaderboardEntry {
  player: string
  wins: number
}

export function LeaderboardAndHistory() {
  const chainId = useDuelStore((s) => s.chainId)
  const joinGame = useDuelStore((s) => s.joinGame)
  const openMatchReceipt = useDuelStore((s) => s.openMatchReceipt)
  const isActing = useDuelStore((s) => s.isActing)

  const [openGames, setOpenGames] = useState<OpenGame[]>([])
  const [recentGames, setRecentGames] = useState<FinishedGame[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const net = getNetwork(chainId)
  const currency = net?.currencySymbol ?? 'ETH'

  useEffect(() => {
    let cancelled = false
    async function fetchEvents() {
      setLoading(true)
      try {
        const contract = contractClient.getReadOnlyContract(chainId)
        const logs = await contractClient.getContractLogsChunked(chainId)

        const createdMap = new Map<bigint, { creator: string; stake: bigint; txHash: string }>()
        const joinedSet = new Set<string>()
        const endedList: FinishedGame[] = []
        const winCounts = new Map<string, number>()

        for (const log of logs) {
          try {
            const parsed = contract.interface.parseLog(log)
            if (!parsed) continue

            if (parsed.name === 'GameCreated') {
              const gId = BigInt(parsed.args[0])
              createdMap.set(gId, {
                creator: parsed.args[1],
                stake: BigInt(parsed.args[2]),
                txHash: log.transactionHash,
              })
            } else if (parsed.name === 'GameJoined' || parsed.name === 'GameCancelled') {
              const gId = parsed.args[0].toString()
              joinedSet.add(gId)
            } else if (parsed.name === 'GameEnded') {
              const gId = BigInt(parsed.args[0])
              const winner = String(parsed.args[1])
              endedList.unshift({
                gameId: gId,
                winner,
                infiltratorScore: Number(parsed.args[2]),
                defenderScore: Number(parsed.args[3]),
                txHash: log.transactionHash,
              })

              if (winner !== ethers.ZeroAddress) {
                winCounts.set(winner, (winCounts.get(winner) || 0) + 1)
              }
            }
          } catch {
            // ignore non-matching logs
          }
        }

        // Open games are those created but not yet joined/cancelled
        const open: OpenGame[] = []
        for (const [id, data] of createdMap.entries()) {
          if (!joinedSet.has(id.toString())) {
            open.unshift({
              gameId: id,
              creator: data.creator,
              stake: data.stake,
              txHash: data.txHash,
            })
          }
        }

        // Sorted leaderboard
        const board: LeaderboardEntry[] = Array.from(winCounts.entries())
          .map(([player, wins]) => ({ player, wins }))
          .sort((a, b) => b.wins - a.wins)
          .slice(0, 5)

        if (!cancelled) {
          setOpenGames(open.slice(0, 5))
          setRecentGames(endedList.slice(0, 5))
          setLeaderboard(board)
        }
      } catch (err) {
        console.warn('Failed to load on-chain match events:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchEvents()
    return () => {
      cancelled = true
    }
  }, [chainId])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '12px' }}>
      {/* OPEN GAMES WAITING FOR CHALLENGER */}
      <div
        style={{
          background: 'rgba(22, 27, 34, 0.85)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', color: '#e6edf3' }}>Open Duels Waiting</h4>
          <span style={{ fontSize: '11px', color: '#8b949e' }}>Join Directly</span>
        </div>

        {loading ? (
          <div style={{ color: '#8b949e', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            Scanning contract for open duels...
          </div>
        ) : openGames.length === 0 ? (
          <div style={{ color: '#8b949e', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            No open duels waiting. Create one to challenge others!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {openGames.map((g) => (
              <div
                key={g.gameId.toString()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'rgba(13, 17, 23, 0.6)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#f0883e' }}>
                    Match #{g.gameId.toString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8b949e', fontFamily: 'monospace' }}>
                    Host: {g.creator.slice(0, 6)}...{g.creator.slice(-4)} · Stake: {ethers.formatEther(g.stake)} {currency}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => joinGame(g.gameId)}
                  disabled={isActing}
                  className="btn-primary"
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: isActing ? 'wait' : 'pointer',
                  }}
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LEADERBOARD & RECENT MATCHES */}
      <div
        style={{
          background: 'rgba(22, 27, 34, 0.85)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', color: '#e6edf3' }}>Vault Leaderboard</h4>
          <span style={{ fontSize: '11px', color: '#8b949e' }}>Top Duelists</span>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ color: '#8b949e', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
            No completed matches on this chain yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {leaderboard.map((entry, idx) => (
              <div
                key={entry.player}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(13, 17, 23, 0.6)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, color: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : '#cd7f32' }}>
                    #{idx + 1}
                  </span>
                  <span style={{ fontFamily: 'monospace', color: '#c9d1d9' }}>
                    {entry.player.slice(0, 6)}...{entry.player.slice(-4)}
                  </span>
                </div>
                <div style={{ fontWeight: 700, color: '#3fb950' }}>{entry.wins} Wins</div>
              </div>
            ))}
          </div>
        )}

        {recentGames.length > 0 && (
          <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '6px' }}>Recent Match Receipts:</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {recentGames.map((rg) => (
                <button
                  key={rg.gameId.toString()}
                  type="button"
                  onClick={() => openMatchReceipt(rg.gameId)}
                  style={{
                    background: 'rgba(56, 139, 253, 0.1)',
                    border: '1px solid rgba(56, 139, 253, 0.2)',
                    color: '#58a6ff',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  #{rg.gameId.toString()} ({rg.infiltratorScore}-{rg.defenderScore}) ↗
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
