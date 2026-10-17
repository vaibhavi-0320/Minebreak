import { useEffect, useState } from 'react'
import { contractClient, type MatchReceipt } from '../contractClient'
import { useDuelStore } from '../duelStore'
import { txUrl, addressUrl, getNetwork } from '../networks'
import { MOVE_NAMES, Move } from '../types'
import { ethers } from 'ethers'

export function MatchReceiptPage({ gameId, onBack }: { gameId: bigint | number; onBack?: () => void }) {
  const chainId = useDuelStore((s) => s.chainId)
  const [receipt, setReceipt] = useState<MatchReceipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await contractClient.getMatchReceipt(chainId, gameId)
        if (!cancelled) setReceipt(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [chainId, gameId])

  const net = getNetwork(chainId)
  const currency = net?.currencySymbol ?? 'ETH'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'radial-gradient(ellipse at 50% 20%, #111726 0%, #090c14 100%)',
        color: '#e6edf3',
        overflowY: 'auto',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: '32px 20px',
      }}
    >
      <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Navigation & Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => {
              if (onBack) onBack()
              else window.location.href = '/'
            }}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#8b949e',
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            ← Back to Duel Lobby
          </button>
          <div style={{ fontSize: '13px', color: '#8b949e' }}>
            Network: <span style={{ color: '#58a6ff' }}>{net?.name ?? `Chain ${chainId}`}</span>
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '1px' }}>
            VAULT // BREAK — Match Receipt
          </h1>
          <p style={{ color: '#8b949e', margin: 0, fontSize: '14px' }}>
            On-chain cryptographic audit trail for Duel #{gameId.toString()}
          </p>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#8b949e', fontSize: '15px' }}>
            Scanning block events & verifying cryptographic commitments...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '16px',
              background: 'rgba(248, 81, 73, 0.1)',
              border: '1px solid #f85149',
              borderRadius: '8px',
              color: '#f85149',
            }}
          >
            Error loading match receipt: {error}
          </div>
        )}

        {receipt && (
          <>
            {/* Overview Card */}
            <div
              style={{
                background: 'rgba(22, 27, 34, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase' }}>Infiltrator</div>
                <div style={{ fontSize: '14px', fontFamily: 'monospace', margin: '4px 0' }}>
                  {receipt.infiltrator ? (
                    <a
                      href={addressUrl(chainId, receipt.infiltrator) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#f0883e', textDecoration: 'underline' }}
                    >
                      {receipt.infiltrator.slice(0, 6)}...{receipt.infiltrator.slice(-4)}
                    </a>
                  ) : (
                    '—'
                  )}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800 }}>{receipt.finalInfiltratorScore} pts</div>
              </div>

              <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase' }}>Winner & Payout</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#3fb950', marginTop: '4px' }}>
                  {receipt.winner === ethers.ZeroAddress ? 'Draw / Cancelled' : 'Winner Declared'}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '2px', color: '#e6edf3' }}>
                  Pot: {ethers.formatEther(receipt.payout)} {currency}
                </div>
                {receipt.winner !== ethers.ZeroAddress && (
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#8b949e' }}>
                    <a
                      href={addressUrl(chainId, receipt.winner) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#58a6ff' }}
                    >
                      {receipt.winner.slice(0, 6)}...{receipt.winner.slice(-4)}
                    </a>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase' }}>Defender</div>
                <div style={{ fontSize: '14px', fontFamily: 'monospace', margin: '4px 0' }}>
                  {receipt.defender && receipt.defender !== ethers.ZeroAddress ? (
                    <a
                      href={addressUrl(chainId, receipt.defender) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#58a6ff', textDecoration: 'underline' }}
                    >
                      {receipt.defender.slice(0, 6)}...{receipt.defender.slice(-4)}
                    </a>
                  ) : (
                    'Waiting...'
                  )}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800 }}>{receipt.finalDefenderScore} pts</div>
              </div>
            </div>

            {/* Rounds Verification Table */}
            <div
              style={{
                background: 'rgba(22, 27, 34, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Commit-Reveal Rounds Audit</h3>
              {receipt.rounds.length === 0 ? (
                <div style={{ color: '#8b949e', fontSize: '13px' }}>No rounds have completed yet in this match.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#8b949e', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Round</th>
                      <th style={{ padding: '8px 10px' }}>Infiltrator Move</th>
                      <th style={{ padding: '8px 10px' }}>Defender Move</th>
                      <th style={{ padding: '8px 10px' }}>Commitment Check</th>
                      <th style={{ padding: '8px 10px' }}>Round Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.rounds.map((r) => (
                      <tr key={r.round} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '12px 10px', fontWeight: 700 }}>#{r.round}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{ color: '#f0883e', fontWeight: 600 }}>
                            {MOVE_NAMES[r.infiltratorMove as Move] ?? 'None'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{ color: '#58a6ff', fontWeight: 600 }}>
                            {MOVE_NAMES[r.defenderMove as Move] ?? 'None'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: r.infiltratorValidReveal && r.defenderValidReveal ? 'rgba(46, 160, 67, 0.2)' : 'rgba(210, 153, 34, 0.2)',
                              color: r.infiltratorValidReveal && r.defenderValidReveal ? '#3fb950' : '#d29922',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {r.infiltratorValidReveal && r.defenderValidReveal ? '✓ Validated on-chain' : 'Pending Reveal'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                          {r.infiltratorScore} - {r.defenderScore}{' '}
                          <span style={{ fontSize: '11px', color: '#8b949e' }}>
                            ({r.result === 1 ? 'Infiltrator won' : r.result === 2 ? 'Defender won' : 'Draw'})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* On-Chain Events Audit Trail */}
            <div
              style={{
                background: 'rgba(22, 27, 34, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>On-Chain Events Audit Trail</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {receipt.events.map((ev, i) => (
                  <div
                    key={`${ev.txHash}_${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(13, 17, 23, 0.6)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#58a6ff',
                          fontFamily: 'monospace',
                        }}
                      >
                        {ev.name}
                      </span>
                      <span style={{ fontSize: '11px', color: '#8b949e' }}>Block #{ev.blockNumber}</span>
                    </div>

                    <a
                      href={txUrl(chainId, ev.txHash) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#7ee787',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        textDecoration: 'underline',
                      }}
                      title={ev.txHash}
                    >
                      {ev.txHash.slice(0, 10)}...{ev.txHash.slice(-8)} ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
