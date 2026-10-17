import { useEffect, useState } from 'react'
import { useGameStore, getXpProgress } from '../game/store'
import { WAVE } from '../game/constants'
import { runtime } from '../game/runtime'
import { audio } from '../audio/audio'
import { DuelLobby } from '../duel/components/DuelLobby'
import { useDuelStore } from '../duel/duelStore'

/** Classic MMO unit-frame bar (HP / XP / boss) */
function UnitBar({
  kind,
  ratio,
  label,
  value,
}: {
  kind: 'hp' | 'xp' | 'boss'
  ratio: number
  label: string
  value: string
}) {
  const pct = Math.max(0, Math.min(100, ratio * 100))
  return (
    <div className={`unit-bar unit-bar-${kind}`}>
      <div className="unit-bar-track">
        <span className="unit-bar-fill" style={{ width: `${pct}%` }} />
        <span className="unit-bar-gloss" />
        <span className="unit-bar-label">{label}</span>
        <span className="unit-bar-value">{value}</span>
      </div>
    </div>
  )
}

/** Subtle corner notice — never blocks the character. */
function LevelUpCelebration() {
  const levelUp = useGameStore((s) => s.levelUp)
  if (!levelUp) return null

  const fade = Math.min(1, levelUp.life / 0.45)
  const lifeRatio = levelUp.life / levelUp.maxLife

  return (
    <div
      className="notify-chip levelup-toast"
      key={levelUp.key}
      style={{ opacity: Math.min(1, fade) * (0.55 + lifeRatio * 0.45) }}
    >
      <div className="notify-chip-inner voxel-panel accent-gold">
        <span className="notify-chip-tag">Level up</span>
        <span className="notify-chip-strong">LV {levelUp.level}</span>
        <span className="notify-chip-meta">+12 Max HP · +20 Heal</span>
      </div>
    </div>
  )
}

function EventNotify() {
  const banner = useGameStore((s) => s.banner)
  const bannerKey = useGameStore((s) => s.bannerKey)
  const phase = useGameStore((s) => s.phase)
  const restTimer = useGameStore((s) => s.restTimer)
  const levelUp = useGameStore((s) => s.levelUp)
  const boss = useGameStore((s) => s.mobs.some((m) => m.alive && m.isBoss))

  if (!banner || phase === 'dead' || phase === 'victory' || phase === 'title' || levelUp) {
    return null
  }

  return (
    <div
      key={bannerKey}
      className={`event-notify ${boss ? 'is-boss' : ''} ${phase === 'waveClear' ? 'is-rest' : ''}`}
    >
      <div className={`event-notify-inner voxel-panel ${boss ? 'accent-boss' : ''}`}>
        <span className="event-notify-text">{banner}</span>
        {phase === 'waveClear' && (
          <span className="event-notify-meta">Rest {Math.ceil(restTimer)}s</span>
        )}
      </div>
    </div>
  )
}

function HurtVignette() {
  const [intensity, setIntensity] = useState(0)
  const [amount, setAmount] = useState(0)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const t = runtime.playerHurtFx
      setIntensity(t > 0 ? Math.min(1, t / 0.55) : 0)
      if (t > 0) setAmount(runtime.lastHurtAmount)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (intensity <= 0.02) return null

  return (
    <div className="hurt-vignette" style={{ opacity: intensity * 0.85 }} aria-hidden>
      <div className="hurt-float" style={{ opacity: intensity }}>
        -{amount}
      </div>
    </div>
  )
}

/** MMORPG-style player unit frame: portrait + name + level + bars */
function PlayerUnitFrame() {
  const player = useGameStore((s) => s.player)
  const levelUp = useGameStore((s) => s.levelUp)
  const xp = getXpProgress(player)
  const hurt = player.invuln > 0.4

  return (
    <div className={`unit-frame player-frame ${hurt ? 'hp-flash' : ''}`}>
      <div className="unit-portrait">
        <div className="unit-portrait-ring">
          <div className="unit-portrait-face" aria-hidden>
            <span className="unit-portrait-hat" />
            <span className="unit-portrait-eyes" />
          </div>
        </div>
        <span className={`unit-level-badge ${levelUp ? 'pop' : ''}`}>{player.level}</span>
      </div>

      <div className="unit-body">
        <div className="unit-name-row">
          <span className="unit-name">Breaker</span>
          <span className="unit-class">Mine Vanguard</span>
        </div>
        <UnitBar
          kind="hp"
          ratio={player.hp / player.maxHp}
          label="HP"
          value={`${Math.ceil(player.hp)} / ${player.maxHp}`}
        />
        <UnitBar
          kind="xp"
          ratio={xp.ratio}
          label="XP"
          value={`${xp.xp} / ${xp.need}`}
        />
      </div>
    </div>
  )
}

/** Target / boss frame — right side, MMO style */
function TargetUnitFrame() {
  const mobs = useGameStore((s) => s.mobs)
  const boss = mobs.find((m) => m.alive && m.isBoss)
  const aliveMobs = mobs.filter((m) => m.alive && !m.isBoss).length
  const wave = useGameStore((s) => s.wave)
  const nextBossWave = Math.ceil(Math.max(wave, 1) / WAVE.bossEvery) * WAVE.bossEvery

  if (boss) {
    return (
      <div className="unit-frame target-frame is-boss">
        <div className="unit-body target-body">
          <div className="unit-name-row">
            <span className="unit-name">Vault Tyrant</span>
            <span className="unit-class boss-tag">Boss</span>
          </div>
          <UnitBar
            kind="boss"
            ratio={boss.hp / boss.maxHp}
            label="HP"
            value={`${Math.ceil(boss.hp)} / ${boss.maxHp}`}
          />
        </div>
        <div className="unit-portrait target-portrait">
          <div className="unit-portrait-ring boss-ring">
            <div className="unit-portrait-face boss-face" aria-hidden>
              <span className="unit-portrait-crown" />
              <span className="unit-portrait-eyes boss-eyes" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="unit-frame target-frame is-idle">
      <div className="unit-body target-body">
        <div className="unit-name-row">
          <span className="unit-name">Mines</span>
          <span className="unit-class">Sector</span>
        </div>
        <div className="target-idle-stats">
          <span>
            Hostiles <strong>{aliveMobs}</strong>
          </span>
          <span>
            Boss @ <strong>W{nextBossWave}</strong>
          </span>
        </div>
      </div>
    </div>
  )
}

/** Wave / kills — top-center session strip (not inside player frame) */
function SessionStrip() {
  const wave = useGameStore((s) => s.wave)
  const kills = useGameStore((s) => s.player.kills)

  return (
    <div className="session-strip">
      <div className="session-strip-inner">
        <div className="session-stat">
          <span className="session-k">Wave</span>
          <span className="session-v">{wave}</span>
        </div>
        <div className="session-divider" />
        <div className="session-stat">
          <span className="session-k">Kills</span>
          <span className="session-v">{kills}</span>
        </div>
      </div>
    </div>
  )
}

export function HUD() {
  const phase = useGameStore((s) => s.phase)
  const player = useGameStore((s) => s.player)
  const wave = useGameStore((s) => s.wave)
  const restTimer = useGameStore((s) => s.restTimer)
  const toasts = useGameStore((s) => s.toasts)
  const startGame = useGameStore((s) => s.startGame)
  const returnToTitle = useGameStore((s) => s.returnToTitle)
  const beginNextWave = useGameStore((s) => s.beginNextWave)

  const duelModeOpen = useDuelStore((s) => s.duelModeOpen)
  const openDuelMode = useDuelStore((s) => s.openDuelMode)
  const [showCredits, setShowCredits] = useState(false)

  if (duelModeOpen) {
    return <DuelLobby />
  }

  if (phase === 'title') {
    return (
      <div className="ui-root">
        {showCredits && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 3000,
              background: 'rgba(5, 8, 15, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setShowCredits(false)}
          >
            <div
              className="voxel-panel accent-gold"
              style={{
                maxWidth: '440px',
                width: '100%',
                padding: '24px',
                textAlign: 'center',
                color: '#e6edf3',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ margin: '0 0 12px 0', fontSize: '20px', color: '#f0883e' }}>CREDITS</h2>
              <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                <strong>Built on Embervale (MIT License)</strong>
              </p>
              <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 20px 0' }}>
                Engine: React 19 · React Three Fiber · Rapier 3D · ElevenLabs SFX · ethers.js v6
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowCredits(false)}
                style={{ width: '100%' }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        <div className="title-screen">
          <div
            className="title-card voxel-panel accent-gold"
            style={{
              maxWidth: '520px',
              padding: 0,
              overflow: 'hidden',
              borderRadius: '16px',
            }}
          >
            {/* MINEBREAK Hero Banner */}
            <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
              <img
                src="/banner.png"
                alt="MINEBREAK"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  borderBottom: '2px solid rgba(240, 136, 62, 0.4)',
                }}
              />
            </div>

            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p className="tagline" style={{ margin: 0, fontSize: '13px', color: '#c9d1d9', lineHeight: 1.5 }}>
                Voxel arena action & on-chain vault duels. Venture through the mines, then face duelists in the Vault.
              </p>
              <div className="meta" style={{ margin: 0 }}>
                <div>
                  <strong>Move</strong> — WASD / Arrows
                </div>
                <div>
                  <strong>Attack</strong> — Click or Space
                </div>
                <div>
                  <strong>Dash</strong> — Shift
                </div>
                <div>
                  <strong>Goal</strong> — Survive to wave 15
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #f0883e 0%, #b85412 100%)',
                    boxShadow: '0 4px 16px rgba(240, 136, 62, 0.4)',
                    borderColor: '#f0883e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    fontSize: '15px',
                    fontWeight: 800,
                  }}
                  onClick={() => {
                    audio.unlock()
                    audio.play('ui-select', { volume: 0.7 })
                    openDuelMode()
                  }}
                >
                  <img src="/logo.png" alt="Minebreak" style={{ width: '22px', height: '22px', borderRadius: '50%' }} />
                  <span>⚔️ MINEBREAK Vault Duel (PvP)</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    audio.unlock()
                    audio.play('ui-select', { volume: 0.7 })
                    startGame()
                  }}
                >
                  Enter the Mines (PvE)
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setShowCredits(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#8b949e',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Credits
              </button>
              <span style={{ color: '#555' }}>·</span>
              <p className="title-attribution" style={{ margin: 0 }}>
                Built on Embervale (MIT License)
              </p>
            </div>
          </div>
          <footer className="site-credit" role="contentinfo">
            <span>Built on Embervale (MIT License)</span>
          </footer>
        </div>
      </div>
    )
  }

  return (
    <div className="ui-root">
      <div className="hud">
        <HurtVignette />

        {/* MMO layout: player frame L · session strip C · target frame R */}
        <div className="hud-frames">
          <PlayerUnitFrame />
          <SessionStrip />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <TargetUnitFrame />
            <button
              type="button"
              onClick={() => openDuelMode()}
              style={{
                background: 'linear-gradient(135deg, rgba(240, 136, 62, 0.95) 0%, rgba(184, 84, 18, 0.95) 100%)',
                border: '1px solid #f0883e',
                borderRadius: '8px',
                padding: '6px 14px',
                color: '#fff',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(240, 136, 62, 0.4)',
                pointerEvents: 'auto',
              }}
            >
              <img src="/logo.png" alt="Duel" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
              <span>MINEBREAK DUEL (PVP)</span>
            </button>
          </div>
        </div>

        <EventNotify />
        <LevelUpCelebration />

        {phase === 'waveClear' && (
          <div className="wave-skip">
            <div className="wave-skip-inner voxel-panel">
              <span className="wave-skip-meta">Rest {Math.ceil(restTimer)}s</span>
              <button type="button" className="btn-primary btn-compact" onClick={beginNextWave}>
                Next wave
              </button>
            </div>
          </div>
        )}

        <div className="controls-hint voxel-panel">
          <span className="pixel-label">Controls</span>
          WASD move · Click/Space attack
          <br />
          Chain clicks for combos · Shift dash
        </div>

        <a
          className="hud-credit"
          href="https://github.com/vaibhavi-0320/Minebreak"
          target="_blank"
          rel="noopener noreferrer"
          title="MINEBREAK GitHub"
        >
          MINEBREAK
        </a>

        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`}>
              {t.text}
            </div>
          ))}
        </div>
      </div>

      {phase === 'dead' && (
        <div className="overlay-center">
          <div className="overlay-card voxel-panel accent-gold">
            <h1>Fallen in Combat</h1>
            <p>
              Wave {wave} · {player.kills} hostiles cleared. The mines will wait for another try.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                audio.play('ui-select', { volume: 0.65 })
                startGame()
              }}
            >
              Rise again
            </button>
            <div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  audio.play('ui-select', { volume: 0.55 })
                  returnToTitle()
                }}
              >
                Back to title
              </button>
            </div>
            <p className="overlay-credit">
              Built on Embervale (MIT License)
            </p>
          </div>
        </div>
      )}

      {phase === 'victory' && (
        <div className="overlay-center">
          <div className="overlay-card voxel-panel accent-gold">
            <h1>MINEBREAK Cleared</h1>
            <p>
              You cleared {wave} waves with {player.kills} hostiles neutralized. The vault is secure.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                audio.play('ui-select', { volume: 0.65 })
                startGame()
              }}
            >
              Play again
            </button>
            <div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  audio.play('ui-select', { volume: 0.55 })
                  returnToTitle()
                }}
              >
                Back to title
              </button>
            </div>
            <p className="overlay-credit">
              Built on Embervale (MIT License)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
