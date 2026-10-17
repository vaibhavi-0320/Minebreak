import type { AttackId } from './combatAttacks'

export type AnimState =
  | 'idle'
  | 'walk'
  | 'sidestep'
  | 'dash'
  | 'attack'
  | 'hit'
  | 'cast'
  | 'death'

/** Mutable driver updated every frame — no React re-renders. */
export type AnimDriver = {
  state: AnimState
  prevState: AnimState
  /** Seconds in current state */
  stateTime: number
  /** Wall-clock elapsed */
  time: number
  /** 0..1 locomotion intensity */
  speed: number
  /** Move relative to facing: +X right, +Z forward */
  localMoveX: number
  localMoveZ: number
  /** 0..1 attack progress */
  attackPhase: number
  /** Remaining hit flash seconds */
  hitFlash: number
  /** 0..1 death progress */
  deathPhase: number
  /** Facing yaw (world) */
  facing: number
  /** Active sword attack style */
  attackId: AttackId
  /** Combo index 0..n */
  comboStep: number
  /** Blade trail strength 0..1 (from attack pose) */
  swordTrail: number
}

export function createAnimDriver(): AnimDriver {
  return {
    state: 'idle',
    prevState: 'idle',
    stateTime: 0,
    time: 0,
    speed: 0,
    localMoveX: 0,
    localMoveZ: 0,
    attackPhase: 0,
    hitFlash: 0,
    deathPhase: 0,
    facing: 0,
    attackId: 'slash_h',
    comboStep: 0,
    swordTrail: 0,
  }
}

export function setAnimState(driver: AnimDriver, next: AnimState) {
  if (driver.state === next) return
  driver.prevState = driver.state
  driver.state = next
  driver.stateTime = 0
  if (next === 'death') driver.deathPhase = 0
}
