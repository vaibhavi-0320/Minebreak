/**
 * Shared soft-body collision for player, mobs, and world props.
 * Player is kinematic in Rapier, so resolution is done in software.
 */
import { ARENA_HALF } from './constants'
import { buildHandcraftedLayout } from '../meshes/props'

export type SolidCircle = {
  x: number
  z: number
  r: number
  /** Optional label for debug */
  kind?: string
}

/** Per-prop solid radii (XZ footprint). Flowers are non-solid. */
const PROP_RADIUS: Record<string, number> = {
  tree: 0.58,
  rock: 0.48,
  lantern: 0.28,
  fence: 0.32,
  mushroom: 0.28,
  shrine: 0.85,
  cottage: 1.55,
}

let cachedSeed = -1
let cachedSolids: SolidCircle[] = []

/** Build or reuse the solid list for a world seed. */
export function getWorldSolids(seed: number): SolidCircle[] {
  if (seed === cachedSeed && cachedSolids.length) return cachedSolids
  const layout = buildHandcraftedLayout(seed)
  const solids: SolidCircle[] = []

  for (const p of layout) {
    const r = PROP_RADIUS[p.kind]
    if (!r) continue
    solids.push({
      x: p.position[0],
      z: p.position[2],
      r: p.kind === 'tree' && p.tall ? r * 1.08 : r,
      kind: p.kind,
    })
  }

  // Decorative border hedges sit just inside the arena wall ring
  const hedgeR = ARENA_HALF + 0.2
  for (let i = 0; i < 32; i++) {
    const t = (i / 32) * Math.PI * 2
    solids.push({
      x: Math.cos(t) * hedgeR,
      z: Math.sin(t) * hedgeR,
      r: 0.55,
      kind: 'hedge',
    })
  }

  // Water pond — soft block (can't walk through)
  solids.push({ x: 9, z: -11, r: 2.15, kind: 'pond' })

  cachedSeed = seed
  cachedSolids = solids
  return solids
}

/** Push a circle out of all solids. Returns resolved (x, z). */
export function resolveAgainstSolids(
  x: number,
  z: number,
  radius: number,
  solids: readonly SolidCircle[],
  strength = 1,
): { x: number; z: number } {
  let nx = x
  let nz = z
  // Two passes for clustered props
  for (let pass = 0; pass < 2; pass++) {
    for (const s of solids) {
      const dx = nx - s.x
      const dz = nz - s.z
      const dist = Math.hypot(dx, dz)
      const min = radius + s.r
      if (dist < min && dist > 1e-6) {
        const push = (min - dist) * strength
        nx += (dx / dist) * push
        nz += (dz / dist) * push
      } else if (dist <= 1e-6) {
        // Exact overlap — nudge along seed-stable axis
        nx += min * 0.5
      }
    }
  }
  return { x: nx, z: nz }
}

/**
 * Soft-separate two circles. Mutates positions in place if arrays provided,
 * or returns deltas.
 */
export function separateCircles(
  ax: number,
  az: number,
  ar: number,
  bx: number,
  bz: number,
  br: number,
  /** How much of the overlap A absorbs (0–1). Rest goes to B. */
  aShare = 0.5,
): { dax: number; daz: number; dbx: number; dbz: number } {
  const dx = ax - bx
  const dz = az - bz
  const dist = Math.hypot(dx, dz)
  const min = ar + br
  if (dist >= min || dist < 1e-8) {
    return { dax: 0, daz: 0, dbx: 0, dbz: 0 }
  }
  const overlap = min - dist
  const nx = dx / dist
  const nz = dz / dist
  return {
    dax: nx * overlap * aShare,
    daz: nz * overlap * aShare,
    dbx: -nx * overlap * (1 - aShare),
    dbz: -nz * overlap * (1 - aShare),
  }
}

/** Clamp to playable arena (inside soft walls). */
export function clampToArena(x: number, z: number, margin = 1.2): { x: number; z: number } {
  const limit = ARENA_HALF - margin
  return {
    x: Math.max(-limit, Math.min(limit, x)),
    z: Math.max(-limit, Math.min(limit, z)),
  }
}
