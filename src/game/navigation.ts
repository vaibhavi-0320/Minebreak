/**
 * Local steering / re-route for mobs around circular world solids.
 * Cheap enough for every mob every frame — no global grid A*.
 */
import type { SolidCircle } from './collision'
import { ARENA_HALF } from './constants'

export type SteerState = {
  /** Sticky wall-follow side: -1 = left, +1 = right */
  side: number
  /** Seconds of low progress while still far from target */
  stuck: number
  /** Cooldown before flipping side again */
  flipCd: number
  /** Temporary detour waypoint (world XZ); active while life > 0 */
  wx: number
  wz: number
  wLife: number
  /** Last frame position for progress check */
  lastX: number
  lastZ: number
}

export function createSteerState(x = 0, z = 0): SteerState {
  return {
    side: Math.random() > 0.5 ? 1 : -1,
    stuck: 0,
    flipCd: 0,
    wx: 0,
    wz: 0,
    wLife: 0,
    lastX: x,
    lastZ: z,
  }
}

function overlapsSolid(
  x: number,
  z: number,
  radius: number,
  solids: readonly SolidCircle[],
  padding = 0.08,
): boolean {
  const r = radius + padding
  for (const s of solids) {
    // Hedges are arena border — clampToArena already handles them; skip dense ring
    if (s.kind === 'hedge') continue
    const min = r + s.r
    const dx = x - s.x
    const dz = z - s.z
    if (dx * dx + dz * dz < min * min) return true
  }
  return false
}

/** True if a straight polyline from A→B stays clear for a circle of given radius. */
export function clearLine(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  radius: number,
  solids: readonly SolidCircle[],
  steps = 5,
): boolean {
  const limit = ARENA_HALF - 1.5
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = ax + (bx - ax) * t
    const z = az + (bz - az) * t
    if (Math.abs(x) > limit || Math.abs(z) > limit) return false
    if (overlapsSolid(x, z, radius, solids)) return false
  }
  return true
}

/**
 * Find nearest solid that blocks the segment from mob toward target.
 * Returns null if clear.
 */
function blockingSolid(
  x: number,
  z: number,
  dirX: number,
  dirZ: number,
  look: number,
  radius: number,
  solids: readonly SolidCircle[],
): SolidCircle | null {
  let best: SolidCircle | null = null
  let bestT = look
  for (const s of solids) {
    if (s.kind === 'hedge') continue
    // Project solid center onto forward ray
    const ox = s.x - x
    const oz = s.z - z
    const t = ox * dirX + oz * dirZ
    if (t < 0 || t > look) continue
    const closestX = x + dirX * t
    const closestZ = z + dirZ * t
    const lat = Math.hypot(s.x - closestX, s.z - closestZ)
    if (lat < s.r + radius + 0.12 && t < bestT) {
      bestT = t
      best = s
    }
  }
  return best
}

/**
 * Sample candidate headings and pick the one that:
 *  - has free space ahead
 *  - progresses toward the goal
 *  - respects sticky wall-follow side when blocked
 */
function pickSteerDir(
  x: number,
  z: number,
  goalX: number,
  goalZ: number,
  radius: number,
  solids: readonly SolidCircle[],
  side: number,
  probe: number,
): { dirX: number; dirZ: number; blocked: boolean } {
  const gdx = goalX - x
  const gdz = goalZ - z
  const gDist = Math.hypot(gdx, gdz) || 1e-6
  const desiredX = gdx / gDist
  const desiredZ = gdz / gDist

  // Fast path: direct line free → go straight
  if (clearLine(x, z, goalX, goalZ, radius, solids, 6)) {
    return { dirX: desiredX, dirZ: desiredZ, blocked: false }
  }

  const ahead = blockingSolid(x, z, desiredX, desiredZ, probe * 2.2, radius, solids)
  let blocked = !!ahead

  // Candidate angles relative to desired heading (radians)
  // Prefer small deflections, then wider arcs on the sticky side
  const candidates: number[] = [0]
  for (let i = 1; i <= 10; i++) {
    const a = i * 0.22 // ~12.6° steps up to ~126°
    candidates.push(side * a, -side * a)
  }
  // Full opposite as last resort
  candidates.push(Math.PI * 0.85 * side, Math.PI * 0.85 * -side, Math.PI)

  let bestScore = -Infinity
  let bestX = desiredX
  let bestZ = desiredZ
  let found = false

  const baseAng = Math.atan2(desiredX, desiredZ)

  for (const offset of candidates) {
    const ang = baseAng + offset
    const dirX = Math.sin(ang)
    const dirZ = Math.cos(ang)

    // Probe several distances — need room to actually step
    const p1x = x + dirX * probe * 0.55
    const p1z = z + dirZ * probe * 0.55
    const p2x = x + dirX * probe
    const p2z = z + dirZ * probe
    if (overlapsSolid(p1x, p1z, radius, solids)) continue
    if (overlapsSolid(p2x, p2z, radius, solids)) continue
    if (Math.abs(p2x) > ARENA_HALF - 1.5 || Math.abs(p2z) > ARENA_HALF - 1.5) continue

    // Longer clear corridor is better
    const longClear = clearLine(x, z, x + dirX * probe * 2.4, z + dirZ * probe * 2.4, radius, solids, 4)

    // How much this step reduces distance to goal
    const afterDist = Math.hypot(goalX - p2x, goalZ - p2z)
    const progress = gDist - afterDist

    // Align with desired + sticky side preference when blocked
    const align = dirX * desiredX + dirZ * desiredZ
    const sideBias = Math.sin(offset) * side * (blocked ? 0.35 : 0.08)

    let score = progress * 2.4 + align * 1.1 + sideBias
    if (longClear) score += 0.85
    // Prefer smaller turns when progress is similar
    score -= Math.abs(offset) * 0.12

    // If an obstacle is dead ahead, reward paths that clear its silhouette
    if (ahead) {
      const away = Math.hypot(p2x - ahead.x, p2z - ahead.z) - ahead.r - radius
      score += Math.min(1.2, away * 0.45)
    }

    if (score > bestScore) {
      bestScore = score
      bestX = dirX
      bestZ = dirZ
      found = true
    }
  }

  if (!found) {
    // Completely boxed — back away from nearest solid
    let nx = 0
    let nz = 0
    for (const s of solids) {
      if (s.kind === 'hedge') continue
      const dx = x - s.x
      const dz = z - s.z
      const d = Math.hypot(dx, dz) || 1e-6
      if (d < s.r + radius + 1.2) {
        const w = 1 / d
        nx += (dx / d) * w
        nz += (dz / d) * w
      }
    }
    const len = Math.hypot(nx, nz)
    if (len > 1e-6) {
      return { dirX: nx / len, dirZ: nz / len, blocked: true }
    }
    // Last resort: slide along sticky tangent of desired
    return {
      dirX: -desiredZ * side,
      dirZ: desiredX * side,
      blocked: true,
    }
  }

  return { dirX: bestX, dirZ: bestZ, blocked }
}

/**
 * Compute a tangent detour waypoint around the solid blocking the path to the player.
 */
function makeDetourWaypoint(
  x: number,
  z: number,
  px: number,
  pz: number,
  radius: number,
  solids: readonly SolidCircle[],
  side: number,
): { x: number; z: number } | null {
  const dx = px - x
  const dz = pz - z
  const dist = Math.hypot(dx, dz) || 1e-6
  const dirX = dx / dist
  const dirZ = dz / dist
  const blocker = blockingSolid(x, z, dirX, dirZ, 7, radius, solids)
  if (!blocker) return null

  // Tangent points roughly: offset perpendicular from solid center
  const clearR = blocker.r + radius + 0.55
  const toMobX = x - blocker.x
  const toMobZ = z - blocker.z
  const toMobLen = Math.hypot(toMobX, toMobZ) || 1e-6
  // Perpendicular to radial
  const tx = (-toMobZ / toMobLen) * side
  const tz = (toMobX / toMobLen) * side
  let wx = blocker.x + tx * clearR
  let wz = blocker.z + tz * clearR

  // Push waypoint slightly toward player so they exit around the obstacle
  const toPlayerX = px - blocker.x
  const toPlayerZ = pz - blocker.z
  const tpl = Math.hypot(toPlayerX, toPlayerZ) || 1e-6
  wx += (toPlayerX / tpl) * 0.4
  wz += (toPlayerZ / tpl) * 0.4

  // If waypoint itself is blocked, slide further out
  if (overlapsSolid(wx, wz, radius, solids, 0.15)) {
    wx = blocker.x + tx * (clearR + 0.7)
    wz = blocker.z + tz * (clearR + 0.7)
  }

  const limit = ARENA_HALF - 1.6
  wx = Math.max(-limit, Math.min(limit, wx))
  wz = Math.max(-limit, Math.min(limit, wz))
  return { x: wx, z: wz }
}

/**
 * Advance a mob one frame toward the player with obstacle-aware steering.
 * Returns the new position and the facing used for movement (not necessarily toward player).
 */
export function steerMob(
  x: number,
  z: number,
  playerX: number,
  playerZ: number,
  radius: number,
  speed: number,
  dt: number,
  solids: readonly SolidCircle[],
  state: SteerState,
): { x: number; z: number; faceX: number; faceZ: number; moving: boolean } {
  state.flipCd = Math.max(0, state.flipCd - dt)
  state.wLife = Math.max(0, state.wLife - dt)

  const toPlayer = Math.hypot(playerX - x, playerZ - z)

  // Progress tracking — did we close distance to player?
  const prevToPlayer = Math.hypot(playerX - state.lastX, playerZ - state.lastZ)
  const moved = Math.hypot(x - state.lastX, z - state.lastZ)
  const closed = prevToPlayer - toPlayer

  if (toPlayer > 1.6) {
    if (moved < speed * dt * 0.28 && closed < 0.02) {
      state.stuck += dt
    } else if (closed > 0.04) {
      state.stuck = Math.max(0, state.stuck - dt * 1.5)
    }
  } else {
    state.stuck = 0
    state.wLife = 0
  }

  // Stuck recovery: flip side + plant a tangent waypoint around the blocker
  if (state.stuck > 0.35 && state.flipCd <= 0) {
    state.side *= -1
    state.flipCd = 0.7
    state.stuck = 0
    const wp = makeDetourWaypoint(x, z, playerX, playerZ, radius, solids, state.side)
    if (wp) {
      state.wx = wp.x
      state.wz = wp.z
      state.wLife = 1.6
    }
  }

  // Also set a waypoint proactively when something is blocking the direct line
  if (state.wLife <= 0 && toPlayer > 2) {
    const dx = playerX - x
    const dz = playerZ - z
    const d = Math.hypot(dx, dz) || 1
    if (
      !clearLine(x, z, playerX, playerZ, radius, solids, 5) &&
      blockingSolid(x, z, dx / d, dz / d, 4.5, radius, solids)
    ) {
      const wp = makeDetourWaypoint(x, z, playerX, playerZ, radius, solids, state.side)
      if (wp) {
        state.wx = wp.x
        state.wz = wp.z
        state.wLife = 1.1
      }
    }
  }

  // Goal = waypoint while active and not yet reached, else player
  let goalX = playerX
  let goalZ = playerZ
  if (state.wLife > 0) {
    const toW = Math.hypot(state.wx - x, state.wz - z)
    if (toW < 0.55) {
      state.wLife = 0
    } else {
      goalX = state.wx
      goalZ = state.wz
    }
  }

  const probe = Math.max(0.75, radius + 0.55)
  const { dirX, dirZ, blocked } = pickSteerDir(
    x,
    z,
    goalX,
    goalZ,
    radius,
    solids,
    state.side,
    probe,
  )

  // Slight speed keep-up when detouring so they don't feel sluggish
  const stepSpeed = blocked || state.wLife > 0 ? speed * 1.08 : speed
  let nx = x + dirX * stepSpeed * dt
  let nz = z + dirZ * stepSpeed * dt

  // Soft slide along solids if we still clip (cheap secondary resolve)
  for (let pass = 0; pass < 2; pass++) {
    for (const s of solids) {
      if (s.kind === 'hedge') continue
      const ox = nx - s.x
      const oz = nz - s.z
      const dist = Math.hypot(ox, oz)
      const min = radius + s.r + 0.06
      if (dist < min && dist > 1e-6) {
        const push = (min - dist) * 1.05
        nx += (ox / dist) * push
        nz += (oz / dist) * push
      }
    }
  }

  const limit = ARENA_HALF - 1.4
  nx = Math.max(-limit, Math.min(limit, nx))
  nz = Math.max(-limit, Math.min(limit, nz))

  state.lastX = x
  state.lastZ = z

  return {
    x: nx,
    z: nz,
    faceX: dirX,
    faceZ: dirZ,
    moving: true,
  }
}
