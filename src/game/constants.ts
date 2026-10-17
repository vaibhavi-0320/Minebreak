export const ARENA_SIZE = 42
export const ARENA_HALF = ARENA_SIZE / 2

export const PLAYER = {
  maxHp: 100,
  speed: 6.2,
  dashSpeed: 14,
  dashDuration: 0.22,
  dashCooldown: 1.1,
  /** residual GCD for openers — combos use attack-local windows */
  attackCooldown: 0.14,
  attackRange: 2.25,
  attackArc: Math.PI * 0.78,
  attackDamage: 18,
  radius: 0.42,
  height: 1.15,
} as const

export const WAVE = {
  baseMobCount: 4,
  mobCountPerWave: 1.35,
  spawnRadiusMin: 10,
  spawnRadiusMax: 17,
  restDuration: 4.5,
  bossEvery: 5,
} as const

export const CAMERA = {
  height: 18,
  distance: 16,
  lookAhead: 1.4,
  lerp: 4.5,
  fov: 38,
} as const

export const COLORS = {
  grass: '#5f8f5c',
  grassDark: '#4a7349',
  dirt: '#8b6b4a',
  path: '#c4a574',
  water: '#6aa8b8',
  stone: '#8a8f86',
  wood: '#a0674a',
  leaf: '#6fad68',
  flowerPink: '#e8a0b0',
  flowerYellow: '#f0d06a',
  roof: '#c45c4a',
  plaster: '#f0e4d0',
  playerBody: '#f0c27a',
  playerCloak: '#4f7a8a',
  playerHat: '#e07a3a',
  slime: '#7ecf8a',
  mushroom: '#d4847a',
  imp: '#9b6bb8',
  beetle: '#5a7a8a',
  boss: '#6b3a7a',
  bossAccent: '#f0a05a',
  ember: '#ff8a4a',
  gold: '#f4c56d',
  heal: '#7ed99a',
  sky: '#b8d0dc',
  fog: '#c5d4c0',
  sun: '#fff2d4',
} as const
