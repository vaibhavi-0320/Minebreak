import type { AnimDriver, AnimState } from './types'
import { setAnimState } from './types'

export type LocomotionInput = {
  /** horizontal speed in world units/sec */
  speed: number
  /** move dir relative to facing: x = right, z = forward (-1..1-ish) */
  localMoveX: number
  localMoveZ: number
  dashing: boolean
  attacking: boolean
  attackPhase: number
  hitFlash: number
  casting?: boolean
  dead?: boolean
  deathPhase?: number
  /** walk threshold */
  walkSpeed?: number
}

/**
 * Pick the best locomotion/combat state for this frame.
 * Attack/dash/hit/death take priority over movement.
 */
export function updateAnimDriver(
  driver: AnimDriver,
  dt: number,
  input: LocomotionInput,
) {
  driver.time += dt
  driver.stateTime += dt
  driver.hitFlash = input.hitFlash
  driver.attackPhase = input.attackPhase
  driver.deathPhase = input.deathPhase ?? 0
  driver.localMoveX = input.localMoveX
  driver.localMoveZ = input.localMoveZ

  const walkSpeed = input.walkSpeed ?? 0.35
  const moving = input.speed > walkSpeed
  driver.speed = Math.min(1, input.speed / 6)

  let next: AnimState = 'idle'

  if (input.dead) {
    next = 'death'
  } else if (input.hitFlash > 0.08 && driver.state !== 'attack') {
    next = 'hit'
  } else if (input.attacking) {
    next = input.casting ? 'cast' : 'attack'
  } else if (input.dashing) {
    next = 'dash'
  } else if (moving) {
    // side-step when mostly strafing relative to facing
    const absX = Math.abs(input.localMoveX)
    const absZ = Math.abs(input.localMoveZ)
    next = absX > absZ * 1.15 && absX > 0.35 ? 'sidestep' : 'walk'
  } else {
    next = 'idle'
  }

  // don't interrupt a short hit react too early unless dashing/attacking
  if (driver.state === 'hit' && next === 'idle' && driver.stateTime < 0.18) {
    next = 'hit'
  }

  // keep attack until phase completes
  if (driver.state === 'attack' && input.attacking) {
    next = 'attack'
  }

  setAnimState(driver, next)
}

/** Convert world-space velocity to local facing space. */
export function worldToLocalMove(
  vx: number,
  vz: number,
  facing: number,
): { x: number; z: number; speed: number } {
  const speed = Math.hypot(vx, vz)
  if (speed < 1e-5) return { x: 0, z: 0, speed: 0 }
  const sin = Math.sin(facing)
  const cos = Math.cos(facing)
  // facing is atan2(x,z) — forward is (sin, cos)
  // local Z (forward) = dot(vel, forward)
  // local X (right) = dot(vel, right) where right = (cos, -sin)
  const z = vx * sin + vz * cos
  const x = vx * cos - vz * sin
  return { x: x / speed, z: z / speed, speed }
}
