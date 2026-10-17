import { useDuelStore } from '../duelStore'
import { isSupportedChain, getDefaultChainId, getNetwork } from '../networks'

export function WrongNetworkBanner() {
  const address = useDuelStore((s) => s.address)
  const chainId = useDuelStore((s) => s.chainId)
  const switchNetwork = useDuelStore((s) => s.switchNetwork)
  const isActing = useDuelStore((s) => s.isActing)

  if (!address || isSupportedChain(chainId)) {
    return null
  }

  const defaultChain = getDefaultChainId()
  const targetConfig = getNetwork(defaultChain)

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, #b35900, #d97706)',
        color: '#ffffff',
        padding: '10px 20px',
        fontSize: '13px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 9999,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>⚠️</span>
        <span>
          Unsupported Network (Chain ID: {chainId}). Please switch to {targetConfig?.name ?? 'Ethereum Sepolia'}.
        </span>
      </div>
      <button
        type="button"
        onClick={() => switchNetwork(defaultChain)}
        disabled={isActing}
        style={{
          background: '#ffffff',
          color: '#b35900',
          border: 'none',
          padding: '6px 14px',
          borderRadius: '6px',
          fontWeight: 700,
          cursor: isActing ? 'wait' : 'pointer',
          fontSize: '12px',
        }}
      >
        {isActing ? 'Switching...' : `Switch to ${targetConfig?.name ?? 'Sepolia'}`}
      </button>
    </div>
  )
}
