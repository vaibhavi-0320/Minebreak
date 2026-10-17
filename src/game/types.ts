export type GamePhase = 'title' | 'playing' | 'waveClear' | 'bossIntro' | 'dead' | 'victory'

export type MobKind = 'slime' | 'mushroom' | 'imp' | 'beetle' | 'boss'

export type Vec2 = { x: number; z: number }

export type MobState = {
  id: string
  kind: MobKind
  hp: number
  maxHp: number
  damage: number
  speed: number
  radius: number
  xp: number
  position: [number, number, number]
  hitFlash: number
  attackCd: number
  alive: boolean
  isBoss: boolean
}

export type Projectile = {
  id: string
  position: [number, number, number]
  velocity: [number, number, number]
  damage: number
  life: number
  fromBoss: boolean
  radius: number
}

export type VfxBurst = {
  id: string
  position: [number, number, number]
  color: string
  life: number
  maxLife: number
  scale: number
  kind: 'hit' | 'heal' | 'spawn' | 'death' | 'slash' | 'levelup' | 'hurt'
}

export type LevelUpEvent = {
  level: number
  key: number
  life: number
  maxLife: number
}

export type Toast = {
  id: string
  text: string
  kind: 'info' | 'heal' | 'damage' | 'loot'
  life: number
}

export type FloatingDamage = {
  id: string
  text: string
  x: number
  y: number
  life: number
}

export type PlayerRuntime = {
  position: [number, number, number]
  facing: number
  hp: number
  maxHp: number
  xp: number
  level: number
  attackCd: number
  dashCd: number
  dashTimer: number
  invuln: number
  attackTimer: number
  attackFacing: number
  kills: number
}
