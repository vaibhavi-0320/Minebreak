import { useState } from 'react'
import { NETWORKS, SUPPORTED_CHAIN_IDS } from '../networks'
import { contractClient } from '../contractClient'
import { useDuelStore } from '../duelStore'

export function NetworkChip() {
  const chainId = useDuelStore((s) => s.chainId)
  const switchNetwork = useDuelStore((s) => s.switchNetwork)
  const [menuOpen, setMenuOpen] = useState(false)

  const currentConfig = NETWORKS[chainId]
  const isSupported = Boolean(currentConfig)
  const contractAddress = contractClient.getContractAddress(chainId)

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="voxel-btn-chip"
        onClick={() => setMenuOpen(!menuOpen)}
        title={contractAddress ? `Contract: ${contractAddress}` : 'No contract deployed'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(20, 24, 33, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '6px 12px',
          color: '#e6edf3',
          fontSize: '13px',
          fontFamily: 'monospace',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isSupported && contractAddress ? '#2ea043' : '#d29922',
            boxShadow: isSupported && contractAddress ? '0 0 8px #2ea043' : 'none',
          }}
        />
        <span>{currentConfig ? currentConfig.name : `Chain ${chainId}`}</span>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>▼</span>
      </button>

      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 1000,
            background: '#161b22',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            padding: '6px',
            minWidth: '180px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ padding: '4px 8px', fontSize: '11px', color: '#8b949e', textTransform: 'uppercase' }}>
            Switch Network
          </div>
          {SUPPORTED_CHAIN_IDS.map((cId) => {
            const net = NETWORKS[cId]
            const active = cId === chainId
            const deployed = Boolean(contractClient.getContractAddress(cId))
            return (
              <button
                key={cId}
                type="button"
                onClick={() => {
                  switchNetwork(cId)
                  setMenuOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: active ? 'rgba(56, 139, 253, 0.15)' : 'transparent',
                  color: active ? '#58a6ff' : '#c9d1d9',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                }}
              >
                <span>{net.name}</span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: deployed ? 'rgba(46, 160, 67, 0.2)' : 'rgba(210, 153, 34, 0.2)',
                    color: deployed ? '#3fb950' : '#d29922',
                  }}
                >
                  {deployed ? 'Ready' : 'No Deploy'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
