import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { useDuelStore } from '../duelStore'
import { STAKE_OPTIONS, getNetwork, txUrl } from '../networks'
import { Move, Phase, MOVE_NAMES, MOVE_DESCRIPTIONS } from '../types'
import { NetworkChip } from './NetworkChip'
import { WalletButton } from './WalletButton'
import { WrongNetworkBanner } from './WrongNetworkBanner'
import { MatchReceiptPage } from './MatchReceiptPage'
import { DuelArena3D } from './DuelArena3D'
import { HowItWorksModal } from './HowItWorksModal'
import { LeaderboardAndHistory } from './LeaderboardAndHistory'

import { contractClient } from '../contractClient'

function formatAddr(addr: string): string {
  if (!addr || addr === ethers.ZeroAddress) return 'None'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function DuelLobby() {
  const closeDuelMode = useDuelStore((s) => s.closeDuelMode)
  const chainId = useDuelStore((s) => s.chainId)
  const address = useDuelStore((s) => s.address)
  const balance = useDuelStore((s) => s.balance)
  const selectedStakeIndex = useDuelStore((s) => s.selectedStakeIndex)
  const setSelectedStakeIndex = useDuelStore((s) => s.setSelectedStakeIndex)
  const joinGameInput = useDuelStore((s) => s.joinGameInput)
  const setJoinGameInput = useDuelStore((s) => s.setJoinGameInput)
  const createGame = useDuelStore((s) => s.createGame)
  const joinGame = useDuelStore((s) => s.joinGame)
  const cancelGame = useDuelStore((s) => s.cancelGame)
  const commitMove = useDuelStore((s) => s.commitMove)
  const revealMove = useDuelStore((s) => s.revealMove)
  const claimTimeout = useDuelStore((s) => s.claimTimeout)
  const leaveCurrentGame = useDuelStore((s) => s.leaveCurrentGame)
  const loadGame = useDuelStore((s) => s.loadGame)
  const statusMessage = useDuelStore((s) => s.statusMessage)
  const isActing = useDuelStore((s) => s.isActing)
  const pendingTx = useDuelStore((s) => s.pendingTx)
  const playerStats = useDuelStore((s) => s.playerStats)

  // Solo Demo Bot & Contract Deployment
  const startBotMatch = useDuelStore((s) => s.startBotMatch)
  const isBotMatch = useDuelStore((s) => s.isBotMatch)
  const botAddress = useDuelStore((s) => s.botAddress)
  const botBalance = useDuelStore((s) => s.botBalance)
  const botStatus = useDuelStore((s) => s.botStatus)
  const fundBot = useDuelStore((s) => s.fundBot)
  const sweepBotFunds = useDuelStore((s) => s.sweepBotFunds)
  const deployContract = useDuelStore((s) => s.deployContract)
  const requestLocalFaucet = useDuelStore((s) => s.requestLocalFaucet)

  const currentGame = useDuelStore((s) => s.currentGame)
  const currentRoundState = useDuelStore((s) => s.currentRoundState)
  const myRole = useDuelStore((s) => s.myRole)

  const matchReceiptGameId = useDuelStore((s) => s.matchReceiptGameId)
  const openMatchReceipt = useDuelStore((s) => s.openMatchReceipt)
  const closeMatchReceipt = useDuelStore((s) => s.closeMatchReceipt)

  const [pickedMove, setPickedMove] = useState<Move>(Move.ATTACK)
  const [copied, setCopied] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  const [resumeId, setResumeId] = useState<string | null>(null)
  const [customContractInput, setCustomContractInput] = useState('')

  // Track active match in localStorage for recovery
  useEffect(() => {
    if (currentGame && currentGame.phase !== Phase.FINISHED) {
      localStorage.setItem('minebreak_active_game_id', currentGame.gameId.toString())
    } else if (currentGame && currentGame.phase === Phase.FINISHED) {
      localStorage.removeItem('minebreak_active_game_id')
    }
  }, [currentGame])

  // Check for saved match to resume
  useEffect(() => {
    if (!currentGame) {
      const saved = localStorage.getItem('minebreak_active_game_id')
      if (saved) setResumeId(saved)
    } else {
      setResumeId(null)
    }
  }, [currentGame])

  // Contract deadline countdown timer
  useEffect(() => {
    if (
      !currentGame ||
      !currentGame.deadline ||
      currentGame.deadline === 0n ||
      currentGame.phase === Phase.WAITING ||
      currentGame.phase === Phase.FINISHED
    ) {
      setSecondsLeft(null)
      return
    }

    const updateTimer = () => {
      const nowSec = Math.floor(Date.now() / 1000)
      const diff = Number(currentGame.deadline) - nowSec
      setSecondsLeft(Math.max(0, diff))
    }

    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [currentGame])

  if (matchReceiptGameId !== null) {
    return <MatchReceiptPage gameId={matchReceiptGameId} onBack={closeMatchReceipt} />
  }

  const net = getNetwork(chainId)
  const currency = net?.currencySymbol ?? 'ETH'

  const handleCopyId = () => {
    if (currentGame) {
      navigator.clipboard.writeText(currentGame.gameId.toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isInf = myRole === 'infiltrator'
  const isDef = myRole === 'defender'
  const myCommitted = isInf
    ? Boolean(currentRoundState?.infiltratorCommitted)
    : isDef
    ? Boolean(currentRoundState?.defenderCommitted)
    : false
  const oppCommitted = isInf
    ? Boolean(currentRoundState?.defenderCommitted)
    : isDef
    ? Boolean(currentRoundState?.infiltratorCommitted)
    : false

  const myRevealed = isInf
    ? Boolean(currentRoundState?.infiltratorRevealed)
    : isDef
    ? Boolean(currentRoundState?.defenderRevealed)
    : false
  const oppRevealed = isInf
    ? Boolean(currentRoundState?.defenderRevealed)
    : isDef
    ? Boolean(currentRoundState?.infiltratorRevealed)
    : false

  const canClaimTimeout =
    secondsLeft === 0 &&
    currentGame &&
    (currentGame.phase === Phase.COMMIT || currentGame.phase === Phase.REVEAL)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        background: 'radial-gradient(ellipse at 50% 20%, rgba(18, 24, 38, 0.95) 0%, rgba(10, 12, 18, 0.98) 100%)',
        color: '#e6edf3',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        overflowY: 'auto',
      }}
    >
      {/* Wrong Network Banner */}
      <WrongNetworkBanner />

      {/* How it works modal */}
      {howItWorksOpen && <HowItWorksModal onClose={() => setHowItWorksOpen(false)} />}

      {/* Top Navigation Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 28px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(13, 17, 23, 0.8)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={closeDuelMode}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#8b949e',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ← Back to Menu
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/logo.png"
              alt="MINEBREAK"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '2px solid #f0883e',
                boxShadow: '0 0 10px rgba(240, 136, 62, 0.4)',
                objectFit: 'cover',
              }}
            />
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '1.5px', color: '#f0883e' }}>
              MINEBREAK
            </span>
            <span
              style={{
                fontSize: '11px',
                background: 'rgba(240, 136, 62, 0.15)',
                color: '#f0883e',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              DUEL PVP
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setHowItWorksOpen(true)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#8b949e',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>📖</span>
            <span>Rules & Crypto</span>
          </button>
          <NetworkChip />
          <WalletButton />
        </div>
      </header>

      {/* Rules Ribbon */}
      <div
        style={{
          background: 'rgba(56, 139, 253, 0.1)',
          borderBottom: '1px solid rgba(56, 139, 253, 0.2)',
          padding: '8px 24px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#58a6ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <span>⚔️ <strong>ATTACK</strong> beats SCAN</span>
        <span>•</span>
        <span>🛡️ <strong>SHIELD</strong> beats ATTACK</span>
        <span>•</span>
        <span>👁️ <strong>SCAN</strong> beats SHIELD</span>
        <span>•</span>
        <span>🏆 First to 3 Points Wins Match</span>
      </div>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '24px 20px', maxWidth: '880px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* MINEBREAK Hero Banner */}
        {!currentGame && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              borderRadius: '16px',
              overflow: 'hidden',
              marginBottom: '20px',
              border: '1px solid rgba(240, 136, 62, 0.35)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
            }}
          >
            <img
              src="/banner.png"
              alt="MINEBREAK"
              style={{
                width: '100%',
                maxHeight: '190px',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* RESUME ACTIVE MATCH BANNER */}
        {resumeId && !currentGame && (
          <div
            style={{
              padding: '14px 20px',
              background: 'rgba(56, 139, 253, 0.15)',
              border: '1px solid #388bfd',
              borderRadius: '10px',
              color: '#e6edf3',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <strong>Active Match in Progress!</strong> Duel #{resumeId} is awaiting your moves.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => loadGame(BigInt(resumeId))}
                className="btn-primary"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                Resume Match #{resumeId}
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('minebreak_active_game_id')
                  setResumeId(null)
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#8b949e',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Transaction Pending Banner */}
        {pendingTx && (
          <div
            style={{
              padding: '14px 18px',
              background: 'rgba(56, 139, 253, 0.15)',
              border: '1px solid #388bfd',
              borderRadius: '8px',
              color: '#58a6ff',
              marginBottom: '20px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: 'pulse 2s infinite',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>⏳</span>
              <div>
                <strong>Transaction Pending (~12s block time):</strong> {pendingTx.description}
              </div>
            </div>
            {txUrl(chainId, pendingTx.hash) && (
              <a
                href={txUrl(chainId, pendingTx.hash)!}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#7ee787',
                  textDecoration: 'underline',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
              >
                View on Etherscan ↗
              </a>
            )}
          </div>
        )}

        {statusMessage && !pendingTx && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(210, 153, 34, 0.15)',
              border: '1px solid #d29922',
              borderRadius: '8px',
              color: '#e3b341',
              marginBottom: '20px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{statusMessage}</span>
          </div>
        )}

        {/* LOBBY VIEW (No active game) */}
        {!currentGame && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Player Stats Card */}
            {address && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  padding: '16px',
                  background: 'rgba(22, 27, 34, 0.8)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase' }}>Wins</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#3fb950' }}>{playerStats.wins}</div>
                </div>
                <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase' }}>Matches Played</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#e6edf3' }}>{playerStats.played}</div>
                </div>
                <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase' }}>Win Rate</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#58a6ff' }}>
                    {playerStats.played > 0
                      ? `${Math.round((playerStats.wins / playerStats.played) * 100)}%`
                      : '—'}
                  </div>
                </div>
              </div>
            )}

            {/* CONTRACT NOT DEPLOYED BANNER */}
            {!contractClient.getContractAddress(chainId) && (
              <div
                style={{
                  background: 'rgba(218, 54, 51, 0.15)',
                  border: '1px solid #da3633',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ color: '#f85149', fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>⚠️</span> VaultBreak Contract Not Deployed on {net?.name || `Chain ${chainId}`}
                    </div>
                    <div style={{ color: '#c9d1d9', fontSize: '13px', marginTop: '6px', maxWidth: '580px', lineHeight: '1.5' }}>
                      To duel on {net?.name}, deploy the smart contract in 1 click using your connected wallet (costs ~0.003 {currency}), or enter an existing deployed contract address.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deployContract()}
                    disabled={isActing || !address}
                    className="btn-primary"
                    style={{
                      padding: '10px 20px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: isActing || !address ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isActing ? 'Deploying...' : `⚡ Deploy to ${net?.name} via MetaMask`}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#8b949e' }}>Or enter existing contract address:</span>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={customContractInput}
                    onChange={(e) => setCustomContractInput(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(13, 17, 23, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      color: '#e6edf3',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      width: '320px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (ethers.isAddress(customContractInput.trim())) {
                        contractClient.setCustomContractAddress(chainId, customContractInput.trim())
                        useDuelStore.getState().refreshWallet()
                        setCustomContractInput('')
                      } else {
                        alert('Please enter a valid Ethereum address (0x...)')
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(56, 139, 253, 0.2)',
                      border: '1px solid #388bfd',
                      color: '#58a6ff',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Save Address
                  </button>
                </div>
              </div>
            )}

            {/* LOCAL FAUCET BANNER */}
            {chainId === 31337 && parseFloat(balance) < 1.0 && (
              <div
                style={{
                  background: 'rgba(56, 139, 253, 0.12)',
                  border: '1px solid #388bfd',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>💧</span>
                  <span style={{ color: '#58a6ff', fontWeight: 700, fontSize: '13px' }}>Local Hardhat Chain:</span>
                  <span style={{ color: '#c9d1d9', fontSize: '13px' }}>
                    Wallet balance: <b style={{ color: '#e6edf3' }}>{balance} ETH</b>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => requestLocalFaucet()}
                  disabled={isActing}
                  className="btn-primary"
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {isActing ? 'Funding...' : '💧 Faucet 10 Local ETH'}
                </button>
              </div>
            )}

            {/* HTTPS + HARDHAT NOTICE */}
            {chainId === 31337 && typeof window !== 'undefined' && window.location.protocol === 'https:' && (
              <div
                style={{
                  background: 'rgba(210, 153, 34, 0.15)',
                  border: '1px solid #d29922',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#e6edf3',
                  fontSize: '13px',
                }}
              >
                <span style={{ fontSize: '18px' }}>💡</span>
                <div>
                  <b style={{ color: '#e3b341' }}>Testing Hardhat Local on Vercel:</b> Browsers block local network RPCs (<code style={{ color: '#79c0ff' }}>http://127.0.0.1:8545</code>) on HTTPS websites.
                  For local Hardhat testing, open <a href="http://localhost:2035" target="_blank" rel="noreferrer" style={{ color: '#58a6ff', textDecoration: 'underline', fontWeight: 'bold' }}>http://localhost:2035</a>. For production duels on Vercel, switch MetaMask to <b>Ethereum Sepolia</b>!
                </div>
              </div>
            )}

            {/* SOLO DEMO HERO CARD (1-Click Duel vs AI Defender) */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(240, 136, 62, 0.18) 0%, rgba(22, 27, 34, 0.95) 100%)',
                border: '1px solid rgba(240, 136, 62, 0.4)',
                borderRadius: '14px',
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 4px 24px rgba(240, 136, 62, 0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '19px', fontWeight: 800, color: '#f0883e' }}>
                      ⚡ SOLO DEMO: INSTANT DUEL VS AI DEFENDER
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(63, 185, 80, 0.2)',
                        color: '#3fb950',
                        fontWeight: 700,
                        border: '1px solid rgba(63, 185, 80, 0.4)',
                      }}
                    >
                      100% REAL ON-CHAIN
                    </span>
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#c9d1d9', maxWidth: '640px', lineHeight: '1.5' }}>
                    Perfect for presentations and live tests without needing a second player. You host as Infiltrator, and an automated on-chain Bot joins, commits secret moves, and reveals them against you!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => startBotMatch()}
                  disabled={isActing}
                  className="btn-primary"
                  style={{
                    padding: '14px 28px',
                    fontSize: '15px',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #f0883e 0%, #d2691e 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isActing ? 'wait' : 'pointer',
                    boxShadow: '0 4px 16px rgba(240, 136, 62, 0.4)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isActing ? 'Setting Up Duel...' : '🚀 START SOLO DEMO MATCH'}
                </button>
              </div>

              {/* Bot Wallet Info & Funding Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#8b949e',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  paddingTop: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>🤖 Demo Bot: <code style={{ color: '#58a6ff' }}>{formatAddr(botAddress)}</code></span>
                  <span>•</span>
                  <span>Bot Balance: <b style={{ color: '#e6edf3' }}>{botBalance} {currency}</b></span>
                  {botStatus && (
                    <>
                      <span>•</span>
                      <span style={{ color: '#f0883e', fontStyle: 'italic' }}>{botStatus}</span>
                    </>
                  )}
                </div>

                {chainId === 11155111 && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => fundBot('0.003')}
                      disabled={isActing}
                      style={{
                        background: 'rgba(56, 139, 253, 0.15)',
                        border: '1px solid #388bfd',
                        color: '#58a6ff',
                        borderRadius: '4px',
                        padding: '4px 10px',
                        cursor: isActing ? 'wait' : 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      + Fund Bot (0.003 Sepolia ETH)
                    </button>
                    {parseFloat(botBalance) > 0.0005 && (
                      <button
                        type="button"
                        onClick={() => sweepBotFunds()}
                        disabled={isActing}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: '#c9d1d9',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          cursor: isActing ? 'wait' : 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        Sweep Bot ETH Back
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Create & Join Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* CREATE MATCH CARD */}
              <div
                style={{
                  background: 'rgba(22, 27, 34, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#e6edf3' }}>Create Vault Match</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>
                    Host a duel as Infiltrator and invite an opponent to match your stake.
                  </p>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '8px' }}>Select Stake Tier:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {STAKE_OPTIONS.map((val, idx) => {
                      const active = idx === selectedStakeIndex
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setSelectedStakeIndex(idx)}
                          style={{
                            padding: '10px 6px',
                            borderRadius: '8px',
                            border: active ? '1px solid #f0883e' : '1px solid rgba(255,255,255,0.1)',
                            background: active ? 'rgba(240, 136, 62, 0.15)' : 'rgba(255,255,255,0.03)',
                            color: active ? '#f0883e' : '#c9d1d9',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {val === 0 ? 'Free' : `${val} ${currency}`}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => createGame()}
                  disabled={isActing}
                  className="btn-primary"
                  style={{
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    width: '100%',
                    marginTop: 'auto',
                    cursor: isActing ? 'wait' : 'pointer',
                    opacity: isActing ? 0.6 : 1,
                  }}
                >
                  {isActing ? 'Processing Transaction...' : 'Initialize Vault Duel'}
                </button>
              </div>

              {/* JOIN MATCH CARD */}
              <div
                style={{
                  background: 'rgba(22, 27, 34, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#e6edf3' }}>Join Existing Duel</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>
                    Enter an open Game ID to join as Defender. Your wallet matches the creator's stake.
                  </p>
                </div>

                <div>
                  <label htmlFor="join-game-id-input" style={{ fontSize: '12px', color: '#8b949e', marginBottom: '8px', display: 'block' }}>
                    Game ID:
                  </label>
                  <input
                    id="join-game-id-input"
                    type="number"
                    min="0"
                    placeholder="e.g. 0"
                    value={joinGameInput}
                    onChange={(e) => setJoinGameInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(13, 17, 23, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#e6edf3',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => joinGame()}
                  disabled={isActing || !joinGameInput.trim()}
                  className="btn-primary"
                  style={{
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    width: '100%',
                    marginTop: 'auto',
                    cursor: isActing || !joinGameInput.trim() ? 'not-allowed' : 'pointer',
                    opacity: !joinGameInput.trim() || isActing ? 0.6 : 1,
                  }}
                >
                  {isActing ? 'Processing Transaction...' : 'Enter Duel as Defender'}
                </button>
              </div>
            </div>

            {/* STAGE 6: LEADERBOARD, OPEN GAMES LIST, RECENT MATCHES */}
            <LeaderboardAndHistory />
          </div>
        )}

        {/* ACTIVE DUEL VIEW */}
        {currentGame && (
          <div
            style={{
              background: 'rgba(22, 27, 34, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {/* Duel Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#f0883e' }}>
                  DUEL #{currentGame.gameId.toString()}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: 'rgba(56, 139, 253, 0.15)',
                    color: '#58a6ff',
                    fontWeight: 600,
                  }}
                >
                  Role: {myRole ? myRole.toUpperCase() : 'SPECTATOR'}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: 'rgba(240, 136, 62, 0.15)',
                    color: '#f0883e',
                  }}
                >
                  Stake: {ethers.formatEther(currentGame.stake)} {currency}
                </span>

                {secondsLeft !== null && (
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: secondsLeft < 30 ? 'rgba(248, 81, 73, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                      color: secondsLeft < 30 ? '#f85149' : '#c9d1d9',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                    }}
                  >
                    ⏰ {formatSeconds(secondsLeft)}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => openMatchReceipt(currentGame.gameId)}
                  style={{
                    background: 'rgba(56, 139, 253, 0.15)',
                    border: '1px solid #388bfd',
                    color: '#58a6ff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  📜 On-Chain Receipt
                </button>
                <button
                  type="button"
                  onClick={leaveCurrentGame}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#8b949e',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  ✕ Leave
                </button>
              </div>
            </div>

            {/* STAGE 5: 3D DUEL ARENA WITH RIGGED CHARACTERS */}
            {currentGame.phase !== Phase.WAITING && (
              <DuelArena3D
                phase={currentGame.phase}
                infiltratorCommitted={Boolean(currentRoundState?.infiltratorCommitted)}
                defenderCommitted={Boolean(currentRoundState?.defenderCommitted)}
                lastResult={currentRoundState?.lastResult ?? 0}
                infiltratorScore={currentGame.infiltratorScore}
                defenderScore={currentGame.defenderScore}
              />
            )}

            {/* STAGE 6: URGENT TIMEOUT CLAIM PANEL */}
            {canClaimTimeout && (
              <div
                style={{
                  padding: '16px 20px',
                  background: 'rgba(248, 81, 73, 0.15)',
                  border: '2px solid #f85149',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  animation: 'pulse 1.5s infinite',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px', color: '#ff7b72' }}>
                    ⏰ Round Deadline Expired!
                  </div>
                  <div style={{ fontSize: '12px', color: '#c9d1d9', marginTop: '2px' }}>
                    Your opponent has stalled past the deadline. Claim timeout to immediately win the match and pot!
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => claimTimeout()}
                  disabled={isActing}
                  style={{
                    padding: '10px 18px',
                    background: '#f85149',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: isActing ? 'wait' : 'pointer',
                  }}
                >
                  {isActing ? 'Claiming...' : '⚡ Claim Timeout Victory'}
                </button>
              </div>
            )}

            {/* WAITING PHASE */}
            {currentGame.phase === Phase.WAITING && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '36px 20px',
                  background: 'rgba(13, 17, 23, 0.5)',
                  borderRadius: '12px',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                }}
              >
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Waiting for Opponent</h3>
                <p style={{ color: '#8b949e', fontSize: '14px', maxWidth: '440px', margin: '0 auto 20px' }}>
                  Share this Game ID with your rival so they can join as Defender.
                </p>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: '#1f242c',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    marginBottom: '24px',
                  }}
                >
                  <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', color: '#58a6ff' }}>
                    {currentGame.gameId.toString()}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: copied ? '#2ea043' : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {copied ? 'Copied!' : 'Copy ID'}
                  </button>
                </div>

                {isInf && (
                  <div>
                    <button
                      type="button"
                      onClick={() => cancelGame()}
                      disabled={isActing}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(248, 81, 73, 0.15)',
                        border: '1px solid #f85149',
                        color: '#f85149',
                        borderRadius: '6px',
                        cursor: isActing ? 'wait' : 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      {isActing ? 'Cancelling...' : 'Cancel Duel & Refund Stake'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ACTIVE MATCH PHASES (COMMIT, REVEAL, FINISHED) */}
            {currentGame.phase !== Phase.WAITING && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Scoreboard */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    background: '#161b22',
                    borderRadius: '12px',
                    padding: '14px 20px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '12px', color: '#f0883e', fontWeight: 600 }}>INFILTRATOR</div>
                    <div style={{ fontSize: '13px', color: '#8b949e', fontFamily: 'monospace' }}>
                      {formatAddr(currentGame.infiltrator)} {isInf && '(You)'}
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#e6edf3' }}>
                      {currentGame.infiltratorScore} <span style={{ fontSize: '14px', color: '#8b949e' }}>/ 3</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#8b949e', textTransform: 'uppercase' }}>
                      Round {currentGame.round.toString()}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '12px',
                        marginTop: '4px',
                        background:
                          currentGame.phase === Phase.COMMIT
                            ? 'rgba(56, 139, 253, 0.2)'
                            : currentGame.phase === Phase.REVEAL
                            ? 'rgba(240, 136, 62, 0.2)'
                            : 'rgba(46, 160, 67, 0.2)',
                        color:
                          currentGame.phase === Phase.COMMIT
                            ? '#58a6ff'
                            : currentGame.phase === Phase.REVEAL
                            ? '#f0883e'
                            : '#3fb950',
                      }}
                    >
                      {currentGame.phase === Phase.COMMIT
                        ? 'COMMIT PHASE'
                        : currentGame.phase === Phase.REVEAL
                        ? 'REVEAL PHASE'
                        : 'FINISHED'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#58a6ff', fontWeight: 600 }}>DEFENDER</div>
                    <div style={{ fontSize: '13px', color: '#8b949e', fontFamily: 'monospace' }}>
                      {formatAddr(currentGame.defender)} {isDef && '(You)'} {isBotMatch && '(🤖 AI Bot)'}
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#e6edf3' }}>
                      {currentGame.defenderScore} <span style={{ fontSize: '14px', color: '#8b949e' }}>/ 3</span>
                    </div>
                  </div>
                </div>

                {/* Solo Demo Bot Status Pill */}
                {isBotMatch && (
                  <div
                    style={{
                      background: 'rgba(56, 139, 253, 0.12)',
                      border: '1px solid #388bfd',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      color: '#58a6ff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>🤖</span>
                    <span>{botStatus || 'AI Defender is participating on-chain.'}</span>
                  </div>
                )}

                {/* Last Round Result Banner */}
                {currentRoundState && currentRoundState.lastResult !== 0 && (
                  <div
                    style={{
                      padding: '10px 16px',
                      background: 'rgba(56, 139, 253, 0.08)',
                      borderRadius: '8px',
                      border: '1px solid rgba(56, 139, 253, 0.2)',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>
                      Last Round:{' '}
                      <strong>{MOVE_NAMES[currentRoundState.lastInfiltratorMove]}</strong> (Inf) vs{' '}
                      <strong>{MOVE_NAMES[currentRoundState.lastDefenderMove]}</strong> (Def)
                    </span>
                    <span style={{ fontWeight: 600, color: '#58a6ff' }}>
                      {currentRoundState.lastResult === 1
                        ? 'Infiltrator Scored (+1)'
                        : currentRoundState.lastResult === 2
                        ? 'Defender Scored (+1)'
                        : 'Draw Round (0)'}
                    </span>
                  </div>
                )}

                {/* COMMIT PHASE INTERACTION */}
                {currentGame.phase === Phase.COMMIT && (
                  <div
                    style={{
                      padding: '20px',
                      background: '#161b22',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: '15px' }}>Secret Move Commitment</span>
                      <div style={{ fontSize: '12px', color: '#8b949e' }}>
                        Opponent: {oppCommitted ? '✅ Committed' : '⏳ Choosing move...'}
                      </div>
                    </div>

                    {myCommitted ? (
                      <div
                        style={{
                          padding: '16px',
                          textAlign: 'center',
                          background: 'rgba(46, 160, 67, 0.1)',
                          border: '1px solid rgba(46, 160, 67, 0.3)',
                          borderRadius: '8px',
                          color: '#3fb950',
                          fontSize: '14px',
                          fontWeight: 600,
                        }}
                      >
                        🔒 Move Locked & Committed! Awaiting opponent commit...
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                          {[Move.ATTACK, Move.SHIELD, Move.SCAN].map((m) => {
                            const isPicked = pickedMove === m
                            const icon = m === Move.ATTACK ? '⚔️' : m === Move.SHIELD ? '🛡️' : '👁️'
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setPickedMove(m)}
                                disabled={isActing}
                                style={{
                                  padding: '14px',
                                  borderRadius: '10px',
                                  border: isPicked ? '2px solid #58a6ff' : '1px solid rgba(255, 255, 255, 0.12)',
                                  background: isPicked ? 'rgba(56, 139, 253, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                  color: '#e6edf3',
                                  cursor: isActing ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <span style={{ fontSize: '26px' }}>{icon}</span>
                                <span style={{ fontWeight: 700, fontSize: '13px' }}>{MOVE_NAMES[m]}</span>
                                <span style={{ fontSize: '11px', color: '#8b949e' }}>{MOVE_DESCRIPTIONS[m]}</span>
                              </button>
                            )
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => commitMove(pickedMove)}
                          disabled={isActing}
                          className="btn-primary"
                          style={{
                            padding: '12px',
                            fontSize: '14px',
                            fontWeight: 700,
                            cursor: isActing ? 'wait' : 'pointer',
                            opacity: isActing ? 0.6 : 1,
                          }}
                        >
                          {isActing ? 'Submitting Commitment...' : `Commit Secret Move (${MOVE_NAMES[pickedMove]})`}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* REVEAL PHASE INTERACTION */}
                {currentGame.phase === Phase.REVEAL && (
                  <div
                    style={{
                      padding: '20px',
                      background: '#161b22',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: '15px' }}>Move Reveal Phase</span>
                      <div style={{ fontSize: '12px', color: '#8b949e' }}>
                        Opponent: {oppRevealed ? '✅ Revealed' : '⏳ Pending reveal...'}
                      </div>
                    </div>

                    {myRevealed ? (
                      <div
                        style={{
                          padding: '16px',
                          textAlign: 'center',
                          background: canClaimTimeout ? 'rgba(248, 81, 73, 0.15)' : 'rgba(46, 160, 67, 0.1)',
                          border: canClaimTimeout ? '1px solid rgba(248, 81, 73, 0.4)' : '1px solid rgba(46, 160, 67, 0.3)',
                          borderRadius: '8px',
                          color: canClaimTimeout ? '#ff7b72' : '#3fb950',
                          fontSize: '14px',
                          fontWeight: 600,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          alignItems: 'center',
                        }}
                      >
                        <span>
                          {canClaimTimeout
                            ? '⏰ Round Deadline Expired! Opponent failed to reveal in time.'
                            : '🔓 Move Revealed! Waiting for opponent to reveal...'}
                        </span>
                        {canClaimTimeout && (
                          <button
                            type="button"
                            onClick={() => claimTimeout()}
                            disabled={isActing}
                            className="btn-primary"
                            style={{
                              background: '#f85149',
                              border: 'none',
                              padding: '10px 24px',
                              fontSize: '14px',
                              fontWeight: 800,
                              color: '#fff',
                              cursor: isActing ? 'wait' : 'pointer',
                              borderRadius: '6px',
                              boxShadow: '0 4px 16px rgba(248, 81, 73, 0.4)',
                            }}
                          >
                            {isActing ? 'Claiming Victory...' : '⚡ Claim Timeout Victory & Win Match'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => revealMove()}
                        disabled={isActing}
                        className="btn-primary"
                        style={{
                          padding: '12px',
                          fontSize: '14px',
                          fontWeight: 700,
                          cursor: isActing ? 'wait' : 'pointer',
                          opacity: isActing ? 0.6 : 1,
                        }}
                      >
                        {isActing ? 'Submitting Reveal...' : 'Reveal Secret Move'}
                      </button>
                    )}
                  </div>
                )}

                {/* FINISHED PHASE VIEW */}
                {currentGame.phase === Phase.FINISHED && (
                  <div
                    style={{
                      padding: '28px',
                      textAlign: 'center',
                      background: 'rgba(13, 17, 23, 0.8)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                  >
                    <div style={{ fontSize: '42px', marginBottom: '8px' }}>
                      {currentGame.winner.toLowerCase() === address?.toLowerCase() ? '🏆' : '💀'}
                    </div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>
                      {currentGame.winner.toLowerCase() === address?.toLowerCase()
                        ? 'VAULT VICTORY!'
                        : currentGame.winner === ethers.ZeroAddress
                        ? 'MATCH CANCELLED / DRAW'
                        : 'DEFEAT'}
                    </h2>
                    <p style={{ color: '#8b949e', fontSize: '14px', margin: '0 0 20px' }}>
                      Final Score: {currentGame.infiltratorScore} - {currentGame.defenderScore}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => openMatchReceipt(currentGame.gameId)}
                        className="btn-primary"
                        style={{ padding: '10px 20px', fontSize: '13px' }}
                      >
                        📜 View Full Match Receipt
                      </button>
                      <button
                        type="button"
                        onClick={leaveCurrentGame}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: '#c9d1d9',
                          padding: '10px 20px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                        }}
                      >
                        Return to Lobby
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
