import { create } from 'zustand'
import { PLAYER, WAVE } from './constants'
import { runtime } from './runtime'
import { audio } from '../audio/audio'
import { getWorldSolids, resolveAgainstSolids, clampToArena } from './collision'
import type {
  FloatingDamage,
  GamePhase,
  LevelUpEvent,
  MobKind,
  MobState,
  PlayerRuntime,
  Projectile,
  Toast,
  VfxBurst,
} from './types'

let idCounter = 0
export const uid = (prefix = 'id') => `${prefix}_${++idCounter}_${Math.floor(Math.random() * 1e5)}`

const MOB_TABLE: Record<
  Exclude<MobKind, 'boss'>,
  Omit<MobState, 'id' | 'position' | 'hitFlash' | 'attackCd' | 'alive' | 'isBoss' | 'kind'>
> = {
  slime: { hp: 28, maxHp: 28, damage: 8, speed: 2.4, radius: 0.55, xp: 12 },
  mushroom: { hp: 40, maxHp: 40, damage: 12, speed: 1.8, radius: 0.5, xp: 16 },
  imp: { hp: 22, maxHp: 22, damage: 10, speed: 3.4, radius: 0.4, xp: 18 },
  beetle: { hp: 55, maxHp: 55, damage: 14, speed: 2.1, radius: 0.6, xp: 22 },
}

const MOB_KINDS = Object.keys(MOB_TABLE) as Array<Exclude<MobKind, 'boss'>>

function createPlayer(): PlayerRuntime {
  return {
    position: [0, 0.55, 0],
    facing: 0,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    xp: 0,
    level: 1,
    attackCd: 0,
    dashCd: 0,
    dashTimer: 0,
    invuln: 0,
    attackTimer: 0,
    attackFacing: 0,
    kills: 0,
  }
}

function xpToLevel(level: number) {
  return 40 + (level - 1) * 28
}

function spawnPoint(angle: number, radius: number, seed = 0): [number, number, number] {
  // Soft-resolve out of world props so waves don't spawn inside trees/rocks
  let x = Math.cos(angle) * radius
  let z = Math.sin(angle) * radius
  const solids = getWorldSolids(seed)
  const fixed = resolveAgainstSolids(x, z, 0.7, solids, 1)
  const clamped = clampToArena(fixed.x, fixed.z, 1.6)
  return [clamped.x, 0.55, clamped.z]
}

function createMob(kind: MobKind, position: [number, number, number], wave: number): MobState {
  if (kind === 'boss') {
    const scale = 1 + (wave / WAVE.bossEvery) * 0.35
    const maxHp = Math.round(220 * scale)
    return {
      id: uid('boss'),
      kind: 'boss',
      hp: maxHp,
      maxHp,
      damage: Math.round(18 * scale),
      speed: 2.6,
      radius: 1.15,
      xp: 120,
      position,
      hitFlash: 0,
      attackCd: 1.2,
      alive: true,
      isBoss: true,
    }
  }

  const base = MOB_TABLE[kind]
  const scale = 1 + (wave - 1) * 0.08
  const maxHp = Math.round(base.maxHp * scale)
  return {
    id: uid(kind),
    kind,
    hp: maxHp,
    maxHp,
    damage: Math.round(base.damage * (1 + (wave - 1) * 0.05)),
    speed: base.speed * (1 + (wave - 1) * 0.03),
    radius: base.radius,
    xp: Math.round(base.xp * scale),
    position,
    hitFlash: 0,
    attackCd: 0.6 + Math.random() * 0.4,
    alive: true,
    isBoss: false,
  }
}

export type GameStore = {
  phase: GamePhase
  wave: number
  banner: string | null
  bannerKey: number
  restTimer: number
  player: PlayerRuntime
  mobs: MobState[]
  projectiles: Projectile[]
  vfx: VfxBurst[]
  toasts: Toast[]
  floaters: FloatingDamage[]
  levelUp: LevelUpEvent | null
  mouseWorld: { x: number; z: number }
  seed: number

  startGame: () => void
  returnToTitle: () => void
  setPhase: (phase: GamePhase) => void
  setBanner: (text: string | null) => void
  setMouseWorld: (x: number, z: number) => void
  patchPlayer: (patch: Partial<PlayerRuntime>) => void
  setMobs: (mobs: MobState[] | ((prev: MobState[]) => MobState[])) => void
  setProjectiles: (p: Projectile[] | ((prev: Projectile[]) => Projectile[])) => void
  setVfx: (v: VfxBurst[] | ((prev: VfxBurst[]) => VfxBurst[])) => void
  addToast: (text: string, kind?: Toast['kind']) => void
  addFloater: (text: string, x: number, y: number) => void
  spawnWave: (wave: number) => void
  spawnBoss: (wave: number) => void
  damageMob: (id: string, amount: number) => void
  damagePlayer: (amount: number) => void
  healPlayer: (amount: number) => void
  grantXp: (amount: number) => void
  tickMeta: (dt: number) => void
  beginNextWave: () => void
  checkWaveClear: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'title',
  wave: 0,
  banner: null,
  bannerKey: 0,
  restTimer: 0,
  player: createPlayer(),
  mobs: [],
  projectiles: [],
  vfx: [],
  toasts: [],
  floaters: [],
  levelUp: null,
  mouseWorld: { x: 0, z: 1 },
  seed: Math.floor(Math.random() * 1e9),

  startGame: () => {
    runtime.mobs = []
    runtime.projectiles = []
    runtime.vfx = []
    runtime.levelUpFx = 0
    runtime.mobVersion++
    audio.unlock()
    audio.ambient('ambient-grove')
    audio.play('wave-start', { volume: 0.8 })
    set({
      phase: 'playing',
      wave: 1,
      banner: 'Wave 1',
      bannerKey: Date.now(),
      restTimer: 0,
      player: createPlayer(),
      mobs: [],
      projectiles: [],
      vfx: [],
      toasts: [{ id: uid('toast'), text: 'Welcome to MINEBREAK', kind: 'info', life: 2.5 }],
      floaters: [],
      levelUp: null,
      seed: Math.floor(Math.random() * 1e9),
    })
    get().spawnWave(1)
  },

  returnToTitle: () => {
    runtime.levelUpFx = 0
    set({
      phase: 'title',
      wave: 0,
      banner: null,
      restTimer: 0,
      player: createPlayer(),
      mobs: [],
      projectiles: [],
      vfx: [],
      toasts: [],
      floaters: [],
      levelUp: null,
    })
  },

  setPhase: (phase) => set({ phase }),
  setBanner: (banner) => set({ banner, bannerKey: Date.now() }),
  setMouseWorld: (x, z) => set({ mouseWorld: { x, z } }),

  patchPlayer: (patch) =>
    set((s) => ({
      player: { ...s.player, ...patch },
    })),

  setMobs: (mobs) =>
    set((s) => ({
      mobs: typeof mobs === 'function' ? mobs(s.mobs) : mobs,
    })),

  setProjectiles: (projectiles) =>
    set((s) => ({
      projectiles: typeof projectiles === 'function' ? projectiles(s.projectiles) : projectiles,
    })),

  setVfx: (vfx) =>
    set((s) => ({
      vfx: typeof vfx === 'function' ? vfx(s.vfx) : vfx,
    })),

  addToast: (text, kind = 'info') =>
    set((s) => ({
      toasts: [...s.toasts.slice(-5), { id: uid('toast'), text, kind, life: 2.4 }],
    })),

  addFloater: (text, x, y) =>
    set((s) => ({
      floaters: [...s.floaters.slice(-12), { id: uid('f'), text, x, y, life: 0.7 }],
    })),

  spawnWave: (wave) => {
    const count = Math.round(WAVE.baseMobCount + (wave - 1) * WAVE.mobCountPerWave)
    const seed = get().seed
    const mobs: MobState[] = []
    for (let i = 0; i < count; i++) {
      const kind = MOB_KINDS[Math.floor(Math.random() * MOB_KINDS.length)]!
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
      const radius =
        WAVE.spawnRadiusMin + Math.random() * (WAVE.spawnRadiusMax - WAVE.spawnRadiusMin)
      const pos = spawnPoint(angle, radius, seed)
      mobs.push(createMob(kind, pos, wave))
    }
    const next = [...get().mobs.filter((m) => m.alive), ...mobs]
    runtime.mobs = next.map((m) => ({ ...m, position: [...m.position] as [number, number, number] }))
    runtime.mobVersion++
    for (const m of mobs) {
      runtime.vfx.push({
        id: uid('vfx'),
        position: m.position,
        color: '#a8d48a',
        life: 0.55,
        maxLife: 0.55,
        scale: 1.2,
        kind: 'spawn',
      })
    }
    set({ mobs: next })
  },

  spawnBoss: (wave) => {
    const boss = createMob('boss', spawnPoint(-Math.PI / 2, 12, get().seed), wave)
    const next = [...get().mobs.filter((m) => m.alive && !m.isBoss), boss]
    runtime.mobs = next.map((m) => ({ ...m, position: [...m.position] as [number, number, number] }))
    runtime.mobVersion++
    runtime.vfx.push({
      id: uid('vfx'),
      position: boss.position,
      color: '#c080e0',
      life: 0.9,
      maxLife: 0.9,
      scale: 2.4,
      kind: 'spawn',
    })
    set({
      phase: 'playing',
      mobs: next,
      banner: 'Boss — Vault Tyrant',
      bannerKey: Date.now(),
    })
    audio.play('boss-roar', { volume: 0.95 })
    get().addToast('The Vault Tyrant awakens!', 'damage')
  },

  damageMob: (id, amount) => {
    const s = get()
    const mobs = s.mobs.map((m) => {
      if (m.id !== id || !m.alive) return m
      const hp = Math.max(0, m.hp - amount)
      return { ...m, hp, hitFlash: 0.12, alive: hp > 0 }
    })
    const killed = mobs.filter((m, i) => s.mobs[i]!.alive && !m.alive)
    let xpGain = 0
    const deathVfx: VfxBurst[] = []
    for (const m of killed) {
      xpGain += m.xp
      deathVfx.push({
        id: uid('vfx'),
        position: m.position,
        color: m.isBoss ? '#d080ff' : '#f0c27a',
        life: 0.55,
        maxLife: 0.55,
        scale: m.isBoss ? 2.5 : 1.1,
        kind: 'death',
      })
    }

    set({
      mobs,
      player: {
        ...s.player,
        kills: s.player.kills + killed.length,
      },
      vfx: [...s.vfx, ...deathVfx],
    })

    if (xpGain > 0) get().grantXp(xpGain)
    if (killed.some((m) => m.isBoss)) {
      get().addToast('Boss defeated!', 'loot')
      get().healPlayer(30)
      if (s.wave >= 15) {
        set({ phase: 'victory', banner: 'MINEBREAK is safe' })
      } else {
        get().checkWaveClear()
      }
    } else if (killed.length) {
      get().checkWaveClear()
    }
  },

  damagePlayer: (amount) => {
    const s = get()
    if (amount <= 0) return
    // Block if either store or runtime i-frames are active
    if (s.player.invuln > 0 || runtime.playerInvuln > 0 || s.phase !== 'playing') return
    const hp = Math.max(0, s.player.hp - amount)
    const invuln = 0.65
    runtime.playerInvuln = invuln
    runtime.playerHurtFx = 0.55
    runtime.lastHurtAmount = amount

    // World-space hurt VFX around the player
    const [px, py, pz] = runtime.playerPos
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      runtime.vfx.push({
        id: uid('vfx'),
        position: [px + Math.cos(a) * 0.35, py + 0.4 + (i % 3) * 0.15, pz + Math.sin(a) * 0.35],
        color: i % 2 === 0 ? '#ff6a4a' : '#c45c4a',
        life: 0.4 + (i % 3) * 0.06,
        maxLife: 0.4 + (i % 3) * 0.06,
        scale: 0.55 + (i % 3) * 0.12,
        kind: 'hurt',
      })
    }
    runtime.vfx.push({
      id: uid('vfx'),
      position: [px, py + 0.7, pz],
      color: '#ff8a70',
      life: 0.35,
      maxLife: 0.35,
      scale: 1.6,
      kind: 'hurt',
    })
    runtime.vfxVersion++

    set({
      player: {
        ...s.player,
        hp,
        invuln,
      },
    })
    audio.play('player-hurt', { volume: 0.75, rate: 0.95 + Math.random() * 0.1 })
    get().addToast(`-${amount} HP`, 'damage')
    if (hp <= 0) {
      audio.play('defeat', { volume: 0.9 })
      set({ phase: 'dead', banner: 'You fell in combat…' })
    }
  },

  healPlayer: (amount) => {
    const s = get()
    const hp = Math.min(s.player.maxHp, s.player.hp + amount)
    const gained = hp - s.player.hp
    if (gained <= 0) return
    set({
      player: { ...s.player, hp },
      vfx: [
        ...s.vfx,
        {
          id: uid('vfx'),
          position: [...s.player.position] as [number, number, number],
          color: '#7ed99a',
          life: 0.6,
          maxLife: 0.6,
          scale: 1.4,
          kind: 'heal',
        },
      ],
    })
    audio.play('heal', { volume: 0.55 })
    get().addToast(`+${gained} HP`, 'heal')
  },

  grantXp: (amount) => {
    const s = get()
    let { xp, level, maxHp, hp } = s.player
    xp += amount
    let levelsGained = 0
    while (xp >= xpToLevel(level)) {
      xp -= xpToLevel(level)
      level += 1
      maxHp += 12
      hp = Math.min(maxHp, hp + 20)
      levelsGained += 1
    }
    set({
      player: { ...s.player, xp, level, maxHp, hp },
    })
    if (levelsGained > 0) {
      const [px, py, pz] = runtime.playerPos
      // world FX: golden voxel fountain + ring
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2
        runtime.vfx.push({
          id: uid('vfx'),
          position: [px + Math.cos(a) * 0.4, py + 0.3, pz + Math.sin(a) * 0.4],
          color: i % 3 === 0 ? '#f4c56d' : i % 3 === 1 ? '#ffe8a8' : '#e07a3a',
          life: 1.1 + (i % 4) * 0.08,
          maxLife: 1.1 + (i % 4) * 0.08,
          scale: 0.9 + (i % 3) * 0.15,
          kind: 'levelup',
        })
      }
      runtime.vfx.push({
        id: uid('vfx'),
        position: [px, py + 0.6, pz],
        color: '#fff4c0',
        life: 1.4,
        maxLife: 1.4,
        scale: 2.4,
        kind: 'levelup',
      })
      runtime.levelUpFx = 2.4
      runtime.vfxVersion++

      set({
        levelUp: {
          level,
          key: Date.now(),
          life: 2.8,
          maxLife: 2.8,
        },
      })
      audio.play('level-up', { volume: 0.9 })
      get().addToast(
        levelsGained > 1
          ? `Level up! ×${levelsGained} → Lv ${level}`
          : `Level up! → Lv ${level}`,
        'loot',
      )
      // No center banner — subtle toast + world VFX only
    }
  },

  tickMeta: (dt) => {
    const s = get()
    const bannerAge = s.bannerKey ? (Date.now() - s.bannerKey) / 1000 : 999
    const clearBanner =
      s.banner &&
      bannerAge > 2.8 &&
      s.phase !== 'waveClear' &&
      s.phase !== 'bossIntro' &&
      s.phase !== 'dead' &&
      s.phase !== 'victory' &&
      !s.levelUp

    const levelUp =
      s.levelUp && s.levelUp.life - dt > 0
        ? { ...s.levelUp, life: s.levelUp.life - dt }
        : null

    if (runtime.levelUpFx > 0) {
      runtime.levelUpFx = Math.max(0, runtime.levelUpFx - dt)
    }

    set({
      toasts: s.toasts.map((t) => ({ ...t, life: t.life - dt })).filter((t) => t.life > 0),
      floaters: s.floaters.map((f) => ({ ...f, life: f.life - dt })).filter((f) => f.life > 0),
      vfx: s.vfx.map((v) => ({ ...v, life: v.life - dt })).filter((v) => v.life > 0),
      banner: clearBanner ? null : s.banner,
      levelUp,
    })

    if (s.phase === 'waveClear') {
      const restTimer = s.restTimer - dt
      if (restTimer <= 0) {
        get().beginNextWave()
      } else {
        set({ restTimer })
      }
    }
  },

  beginNextWave: () => {
    const next = get().wave + 1
    const isBoss = next % WAVE.bossEvery === 0
    set({
      wave: next,
      phase: isBoss ? 'bossIntro' : 'playing',
      restTimer: 0,
      banner: isBoss ? 'Something stirs…' : `Wave ${next}`,
      bannerKey: Date.now(),
    })
    if (!isBoss) {
      audio.play('wave-start', { volume: 0.75 })
    }
    if (isBoss) {
      window.setTimeout(() => {
        if (get().phase === 'bossIntro' || get().phase === 'playing') {
          get().spawnBoss(next)
        }
      }, 1200)
    } else {
      get().spawnWave(next)
    }
  },

  checkWaveClear: () => {
    const s = get()
    if (s.phase !== 'playing' && s.phase !== 'bossIntro') return
    const alive = s.mobs.some((m) => m.alive)
    if (alive) return
    if (s.wave >= 15 && s.wave % WAVE.bossEvery === 0) {
      audio.play('victory', { volume: 0.95 })
      set({ phase: 'victory', banner: 'MINEBREAK is safe' })
      return
    }
    set({
      phase: 'waveClear',
      restTimer: WAVE.restDuration,
      banner: `Wave ${s.wave} clear`,
      bannerKey: Date.now(),
    })
    get().healPlayer(12 + s.wave)
    get().addToast('Breathing room…', 'heal')
  },
}))

export function getXpProgress(player: PlayerRuntime) {
  const need = xpToLevel(player.level)
  return { xp: player.xp, need, ratio: player.xp / need }
}
