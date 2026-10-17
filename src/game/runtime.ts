/**
 * Mutable runtime bags updated every frame without React re-renders.
 * React store is only patched when UI-visible state changes.
 */
import type { MobState, Projectile, VfxBurst } from './types'

export type RuntimeBag = {
  mobs: MobState[]
  projectiles: Projectile[]
  vfx: VfxBurst[]
  playerPos: [number, number, number]
  playerFacing: number
  playerAttackTimer: number
  playerInvuln: number
  /** Active level-up world FX timer (seconds remaining) */
  levelUpFx: number
  /** Player hurt flash / feedback timer */
  playerHurtFx: number
  /** Last damage amount (for floating feedback) */
  lastHurtAmount: number
  /** bump to force React mesh list refresh (spawn/death) */
  mobVersion: number
  projectileVersion: number
  vfxVersion: number
}

export const runtime: RuntimeBag = {
  mobs: [],
  projectiles: [],
  vfx: [],
  playerPos: [0, 0.55, 0],
  playerFacing: 0,
  playerAttackTimer: 0,
  playerInvuln: 0,
  levelUpFx: 0,
  playerHurtFx: 0,
  lastHurtAmount: 0,
  mobVersion: 0,
  projectileVersion: 0,
  vfxVersion: 0,
}

export function syncMobsFromStore(mobs: MobState[]) {
  runtime.mobs = mobs.map((m) => ({ ...m, position: [...m.position] as [number, number, number] }))
  runtime.mobVersion++
}

export function pushVfx(v: VfxBurst) {
  runtime.vfx.push(v)
  runtime.vfxVersion++
}
