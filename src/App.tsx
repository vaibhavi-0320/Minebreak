import { useState, useEffect } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { HUD } from './ui/HUD'
import { MatchReceiptPage } from './duel/components/MatchReceiptPage'

function getMatchIdFromUrl(): bigint | null {
  const pathMatch = window.location.pathname.match(/^\/match\/(\d+)/)
  if (pathMatch) return BigInt(pathMatch[1])
  const hashMatch = window.location.hash.match(/^#\/match\/(\d+)/)
  if (hashMatch) return BigInt(hashMatch[1])
  return null
}

export default function App() {
  const [matchId, setMatchId] = useState<bigint | null>(getMatchIdFromUrl())

  useEffect(() => {
    const onPop = () => {
      setMatchId(getMatchIdFromUrl())
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('hashchange', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('hashchange', onPop)
    }
  }, [])

  if (matchId !== null) {
    return (
      <MatchReceiptPage
        gameId={matchId}
        onBack={() => {
          window.history.pushState({}, '', '/')
          setMatchId(null)
        }}
      />
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <GameCanvas />
      <HUD />
    </div>
  )
}
