import { ethers } from 'ethers'
import { useDuelStore } from '../duelStore'
import { getNetwork } from '../networks'

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function WalletButton() {
  const address = useDuelStore((s) => s.address)
  const balance = useDuelStore((s) => s.balance)
  const chainId = useDuelStore((s) => s.chainId)
  const isConnecting = useDuelStore((s) => s.isConnecting)
  const isActing = useDuelStore((s) => s.isActing)
  const connectWallet = useDuelStore((s) => s.connectWallet)
  const pendingWithdrawal = useDuelStore((s) => s.pendingWithdrawal)
  const withdraw = useDuelStore((s) => s.withdraw)

  const net = getNetwork(chainId)
  const currency = net?.currencySymbol ?? 'ETH'
  const hasWinnings = pendingWithdrawal > 0n
  const formattedWinnings = hasWinnings ? ethers.formatEther(pendingWithdrawal) : '0'

  if (!address) {
    return (
      <button
        type="button"
        className="btn-primary"
        onClick={() => connectWallet()}
        disabled={isConnecting}
        style={{
          padding: '8px 16px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: isConnecting ? 'wait' : 'pointer',
        }}
      >
        <span>⚡</span>
        <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
      </button>
    )
  }

  const displayBalance = balance ? parseFloat(balance).toFixed(4) : '0.0000'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {hasWinnings && (
        <button
          type="button"
          onClick={() => withdraw()}
          disabled={isActing}
          title="Claim unwithdrawn match pot winnings directly into your wallet"
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 'bold',
            borderRadius: '6px',
            border: '1px solid #ffaa00',
            background: 'linear-gradient(135deg, #ff8800, #ffbb00)',
            color: '#1a1000',
            cursor: isActing ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            animation: 'pulse 2s infinite',
          }}
        >
          <span>🏆</span>
          <span>Claim {formattedWinnings} {currency}</span>
        </button>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(20, 24, 33, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '6px 12px',
          color: '#e6edf3',
          fontSize: '13px',
          fontFamily: 'monospace',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ color: '#7ee787' }}>{displayBalance} {currency}</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <span style={{ color: '#58a6ff' }} title={address}>
          {truncateAddress(address)}
        </span>
      </div>
    </div>
  )
}
