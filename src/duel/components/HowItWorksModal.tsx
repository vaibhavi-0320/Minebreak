export function HowItWorksModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(5, 8, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#161b22',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '16px',
          maxWidth: '620px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '28px',
          color: '#e6edf3',
          boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f0883e' }}>
            HOW VAULT//BREAK WORKS
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* 1. Core Rules */}
        <div>
          <h3 style={{ fontSize: '15px', color: '#58a6ff', margin: '0 0 8px 0' }}>1. The Duel Rules</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#8b949e', lineHeight: 1.6 }}>
            Two duelists enter the vault: the <strong>Infiltrator</strong> (Creator) and the <strong>Defender</strong> (Challenger).
            Players match stakes (or play free). Each round, players select one of three moves:
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginTop: '12px',
            }}
          >
            <div style={{ background: '#0d1117', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: '20px' }}>⚔️ ATTACK</div>
              <div style={{ fontSize: '11px', color: '#7ee787', marginTop: '4px' }}>Beats SCAN</div>
            </div>
            <div style={{ background: '#0d1117', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: '20px' }}>🛡️ SHIELD</div>
              <div style={{ fontSize: '11px', color: '#7ee787', marginTop: '4px' }}>Beats ATTACK</div>
            </div>
            <div style={{ background: '#0d1117', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: '20px' }}>👁️ SCAN</div>
              <div style={{ fontSize: '11px', color: '#7ee787', marginTop: '4px' }}>Beats SHIELD</div>
            </div>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#8b949e' }}>
            Winning a round awards <strong>1 Point</strong>. Same move results in a <strong>Draw (0 Points)</strong>. The first player to reach <strong>3 Points</strong> wins the entire match and claims the pot!
          </p>
        </div>

        {/* 2. Cryptographic Commit-Reveal */}
        <div>
          <h3 style={{ fontSize: '15px', color: '#58a6ff', margin: '0 0 8px 0' }}>2. Cryptographic Commit-Reveal</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#8b949e', lineHeight: 1.6 }}>
            Blockchain transactions are public. To prevent miners or opponents from peeking at your move, the duel uses a <strong>two-phase cryptographic scheme</strong>:
          </p>
          <ul style={{ margin: '8px 0 0 20px', padding: 0, fontSize: '13px', color: '#8b949e', lineHeight: 1.6 }}>
            <li>
              <strong>Commit Phase:</strong> Your browser generates a secret 256-bit cryptographic salt and computes
              <code style={{ background: '#0d1117', padding: '2px 6px', borderRadius: '4px', color: '#e6edf3', margin: '0 4px' }}>
                keccak256(contract, chainId, gameId, round, player, move, salt)
              </code>. Only this hash is sent to the blockchain.
            </li>
            <li>
              <strong>Reveal Phase:</strong> Once both players have committed, both players reveal their move and secret salt. The contract verifies the hash matches exactly.
            </li>
          </ul>
        </div>

        {/* 3. Anti-Stall Timeout System */}
        <div>
          <h3 style={{ fontSize: '15px', color: '#58a6ff', margin: '0 0 8px 0' }}>3. Anti-Stall Timeout Protection</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#8b949e', lineHeight: 1.6 }}>
            Every round has a contract deadline (120 seconds). If your opponent stalls or abandons the match:
          </p>
          <ul style={{ margin: '8px 0 0 20px', padding: 0, fontSize: '13px', color: '#8b949e', lineHeight: 1.6 }}>
            <li>
              If you submitted your action and the opponent failed to act: You can call <strong>Claim Timeout</strong> to immediately forfeit their stake and receive the entire match pot.
            </li>
            <li>
              If both players stall: Both players receive a 100% refund of their stakes.
            </li>
          </ul>
        </div>

        {/* 4. Pull-Payment Security */}
        <div>
          <h3 style={{ fontSize: '15px', color: '#58a6ff', margin: '0 0 8px 0' }}>4. Pull-Payment Winnings</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#8b949e', lineHeight: 1.6 }}>
            All prize pots are credited to your <strong>Pending Withdrawals</strong> balance in the contract. You can withdraw your winnings to your wallet anytime via the 1-click Claim button. This pull-payment pattern prevents gas griefing and reentrancy exploits.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700 }}
        >
          Got It — Return to Duel
        </button>
      </div>
    </div>
  )
}
