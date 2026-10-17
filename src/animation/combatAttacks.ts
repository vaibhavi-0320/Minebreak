import { easeOutCubic, lerp, smoothstep } from './easing'

export type AttackId =
  | 'slash_h'
  | 'slash_h_rev'
  | 'slash_v'
  | 'slash_diag'
  | 'slash_thrust'
  | 'slash_spin'

export type AttackPose = {
  rootY: number
  bodyYaw: number
  bodyPitch: number
  bodyRoll: number
  headYaw: number
  headPitch: number
  lArmX: number
  lArmY: number
  lArmZ: number
  rArmX: number
  rArmY: number
  rArmZ: number
  lLegX: number
  rLegX: number
  /** two-handed weapon root euler (body-local) */
  swordX: number
  swordY: number
  swordZ: number
  trail: number
}

export type AttackDef = {
  id: AttackId
  label: string
  duration: number
  hitAt: number
  chainFrom: number
  chainUntil: number
  damageMul: number
  knockbackMul: number
  lunge: number
  arc: {
    yaw: number
    pitch: number
    thetaStart: number
    thetaLength: number
    y: number
    color: string
  }
  sample: (phase: number) => AttackPose
}

/** Two-hand rest — both arms on the hilt */
const REST = {
  lArm: { x: -0.55, y: 0.35, z: 0.55 },
  rArm: { x: -0.45, y: -0.25, z: -0.45 },
  weapon: { x: 0.35, y: 0.08, z: -0.12 },
}

function basePose(): AttackPose {
  return {
    rootY: 0,
    bodyYaw: 0,
    bodyPitch: 0,
    bodyRoll: 0,
    headYaw: 0,
    headPitch: 0,
    lArmX: REST.lArm.x,
    lArmY: REST.lArm.y,
    lArmZ: REST.lArm.z,
    rArmX: REST.rArm.x,
    rArmY: REST.rArm.y,
    rArmZ: REST.rArm.z,
    lLegX: 0,
    rLegX: 0,
    swordX: REST.weapon.x,
    swordY: REST.weapon.y,
    swordZ: REST.weapon.z,
    trail: 0,
  }
}

function triPhase(
  p: number,
  windEnd: number,
  strikeEnd: number,
  wind: Partial<AttackPose>,
  strike: Partial<AttackPose>,
  recover: Partial<AttackPose> = {},
): AttackPose {
  const out = basePose()
  const apply = (from: AttackPose, to: Partial<AttackPose>, u: number) => {
    const keys = Object.keys(out) as (keyof AttackPose)[]
    for (const k of keys) {
      const a = from[k]
      const b = to[k]
      if (typeof a === 'number' && typeof b === 'number') {
        ;(out as AttackPose)[k] = lerp(a, b, u)
      }
    }
  }

  if (p < windEnd) {
    const u = easeOutCubic(p / windEnd)
    apply(basePose(), wind, u)
    out.trail = u * 0.2
  } else if (p < strikeEnd) {
    const u = easeOutCubic((p - windEnd) / (strikeEnd - windEnd))
    const from: AttackPose = { ...basePose(), ...wind, trail: 0.25 }
    apply(from, { ...strike, trail: 1 }, u)
  } else {
    const u = smoothstep((p - strikeEnd) / Math.max(0.001, 1 - strikeEnd))
    const from: AttackPose = { ...basePose(), ...strike, trail: 0.85 }
    apply(from, { ...basePose(), ...recover, trail: 0 }, u)
  }
  return out
}

/**
 * Two-handed attack poses: both arms stay engaged on the greatsword,
 * weapon root drives the heavy arc.
 */
export const ATTACKS: Record<AttackId, AttackDef> = {
  slash_h: {
    id: 'slash_h',
    label: 'Great Slash',
    duration: 0.46,
    hitAt: 0.36,
    chainFrom: 0.4,
    chainUntil: 0.92,
    damageMul: 1.05,
    knockbackMul: 1.1,
    lunge: 1.5,
    arc: {
      yaw: 0,
      pitch: 0.12,
      thetaStart: -1.0,
      thetaLength: 2.05,
      y: 0.75,
      color: '#ffe6a0',
    },
    sample: (p) =>
      triPhase(
        p,
        0.3,
        0.56,
        {
          bodyYaw: -0.5,
          bodyPitch: -0.12,
          bodyRoll: -0.12,
          // chamber high right
          lArmX: -1.1,
          lArmY: 0.55,
          lArmZ: 0.4,
          rArmX: -0.95,
          rArmY: -0.15,
          rArmZ: -0.7,
          swordX: -0.25,
          swordY: 0.85,
          swordZ: -0.55,
          lLegX: 0.12,
          rLegX: -0.08,
        },
        {
          bodyYaw: 0.65,
          bodyPitch: 0.14,
          bodyRoll: 0.2,
          // both hands ride the blade through the cut
          lArmX: -0.15,
          lArmY: -0.35,
          lArmZ: 0.7,
          rArmX: 0.1,
          rArmY: -0.85,
          rArmZ: 0.15,
          swordX: 0.55,
          swordY: -0.95,
          swordZ: -0.35,
          lLegX: -0.28,
          rLegX: 0.32,
          rootY: 0.05,
        },
      ),
  },

  slash_h_rev: {
    id: 'slash_h_rev',
    label: 'Return Cut',
    duration: 0.44,
    hitAt: 0.34,
    chainFrom: 0.38,
    chainUntil: 0.92,
    damageMul: 1.1,
    knockbackMul: 1.1,
    lunge: 1.45,
    arc: {
      yaw: 0,
      pitch: -0.08,
      thetaStart: 0.15,
      thetaLength: 2.0,
      y: 0.72,
      color: '#ffd080',
    },
    sample: (p) =>
      triPhase(
        p,
        0.28,
        0.54,
        {
          bodyYaw: 0.5,
          bodyPitch: -0.08,
          bodyRoll: 0.14,
          lArmX: -0.9,
          lArmY: -0.2,
          lArmZ: 0.75,
          rArmX: -0.85,
          rArmY: -0.75,
          rArmZ: 0.1,
          swordX: 0.15,
          swordY: -0.8,
          swordZ: -0.4,
        },
        {
          bodyYaw: -0.6,
          bodyPitch: 0.12,
          bodyRoll: -0.16,
          lArmX: -0.2,
          lArmY: 0.7,
          lArmZ: 0.35,
          rArmX: 0.05,
          rArmY: 0.35,
          rArmZ: -0.65,
          swordX: 0.45,
          swordY: 0.9,
          swordZ: -0.5,
          lLegX: 0.22,
          rLegX: -0.18,
          rootY: 0.04,
        },
      ),
  },

  slash_v: {
    id: 'slash_v',
    label: 'Overhead',
    duration: 0.52,
    hitAt: 0.42,
    chainFrom: 0.44,
    chainUntil: 0.94,
    damageMul: 1.3,
    knockbackMul: 1.35,
    lunge: 1.15,
    arc: {
      yaw: Math.PI / 2,
      pitch: 1.15,
      thetaStart: -0.45,
      thetaLength: 1.55,
      y: 0.95,
      color: '#fff0c0',
    },
    sample: (p) =>
      triPhase(
        p,
        0.34,
        0.6,
        {
          bodyYaw: 0,
          bodyPitch: -0.42,
          // lift greatsword high overhead with both hands
          lArmX: -2.05,
          lArmY: 0.25,
          lArmZ: 0.25,
          rArmX: -1.95,
          rArmY: -0.15,
          rArmZ: -0.2,
          swordX: -1.35,
          swordY: 0.05,
          swordZ: 0.05,
          rootY: 0.1,
          lLegX: 0.1,
        },
        {
          bodyYaw: 0.08,
          bodyPitch: 0.48,
          bodyRoll: 0.06,
          lArmX: 0.35,
          lArmY: 0.2,
          lArmZ: 0.55,
          rArmX: 0.45,
          rArmY: -0.15,
          rArmZ: -0.35,
          swordX: 1.15,
          swordY: -0.05,
          swordZ: -0.1,
          rootY: 0.02,
          lLegX: -0.12,
          rLegX: 0.38,
        },
      ),
  },

  slash_diag: {
    id: 'slash_diag',
    label: 'Cross Cut',
    duration: 0.48,
    hitAt: 0.38,
    chainFrom: 0.42,
    chainUntil: 0.93,
    damageMul: 1.2,
    knockbackMul: 1.15,
    lunge: 1.85,
    arc: {
      yaw: 0.45,
      pitch: 0.55,
      thetaStart: -0.85,
      thetaLength: 1.8,
      y: 0.8,
      color: '#ffc878',
    },
    sample: (p) =>
      triPhase(
        p,
        0.3,
        0.58,
        {
          bodyYaw: -0.38,
          bodyPitch: -0.28,
          bodyRoll: -0.22,
          lArmX: -1.55,
          lArmY: 0.65,
          lArmZ: 0.35,
          rArmX: -1.35,
          rArmY: 0.15,
          rArmZ: -0.55,
          swordX: -0.75,
          swordY: 0.7,
          swordZ: -0.45,
          rootY: 0.06,
        },
        {
          bodyYaw: 0.52,
          bodyPitch: 0.3,
          bodyRoll: 0.24,
          lArmX: 0.15,
          lArmY: -0.45,
          lArmZ: 0.65,
          rArmX: 0.35,
          rArmY: -0.7,
          rArmZ: 0.05,
          swordX: 0.85,
          swordY: -0.65,
          swordZ: -0.55,
          lLegX: -0.3,
          rLegX: 0.28,
          rootY: 0.03,
        },
      ),
  },

  slash_thrust: {
    id: 'slash_thrust',
    label: 'Impale',
    duration: 0.4,
    hitAt: 0.32,
    chainFrom: 0.36,
    chainUntil: 0.9,
    damageMul: 1.0,
    knockbackMul: 0.9,
    lunge: 2.8,
    arc: {
      yaw: 0,
      pitch: 0,
      thetaStart: -0.28,
      thetaLength: 0.55,
      y: 0.78,
      color: '#e8f0ff',
    },
    sample: (p) =>
      triPhase(
        p,
        0.26,
        0.52,
        {
          bodyYaw: 0.05,
          bodyPitch: -0.18,
          // pull back for two-hand thrust
          lArmX: -0.7,
          lArmY: 0.2,
          lArmZ: 0.4,
          rArmX: -0.65,
          rArmY: -0.15,
          rArmZ: -0.35,
          swordX: 0.55,
          swordY: 0.05,
          swordZ: -0.05,
          rootY: 0.04,
          lLegX: 0.28,
        },
        {
          bodyYaw: 0,
          bodyPitch: 0.22,
          lArmX: -0.25,
          lArmY: 0.15,
          lArmZ: 0.5,
          rArmX: -0.15,
          rArmY: -0.1,
          rArmZ: -0.3,
          swordX: 1.25,
          swordY: 0,
          swordZ: 0.05,
          lLegX: -0.08,
          rLegX: 0.42,
          rootY: 0.02,
        },
      ),
  },

  slash_spin: {
    id: 'slash_spin',
    label: 'Whirlwind',
    duration: 0.62,
    hitAt: 0.44,
    chainFrom: 0.72,
    chainUntil: 0.95,
    damageMul: 1.5,
    knockbackMul: 1.55,
    lunge: 0.55,
    arc: {
      yaw: 0,
      pitch: 0.05,
      thetaStart: 0,
      thetaLength: Math.PI * 1.9,
      y: 0.72,
      color: '#ffb060',
    },
    sample: (p) => {
      const out = basePose()
      if (p < 0.22) {
        const u = easeOutCubic(p / 0.22)
        out.bodyPitch = -0.18 * u
        out.lArmX = lerp(REST.lArm.x, -1.0, u)
        out.rArmX = lerp(REST.rArm.x, -0.9, u)
        out.lArmY = lerp(REST.lArm.y, 0.4, u)
        out.rArmY = lerp(REST.rArm.y, -0.3, u)
        out.swordX = lerp(REST.weapon.x, -0.15, u)
        out.swordY = lerp(REST.weapon.y, 0.4, u)
        out.trail = u * 0.35
        out.rootY = 0.08 * u
      } else if (p < 0.74) {
        const u = (p - 0.22) / 0.52
        out.bodyYaw = u * Math.PI * 2
        out.bodyPitch = 0.08
        out.bodyRoll = Math.sin(u * Math.PI * 2) * 0.12
        // locked two-hand grip, blade extended
        out.lArmX = -0.55
        out.lArmY = 0.15 + Math.sin(u * Math.PI * 2) * 0.2
        out.lArmZ = 0.6
        out.rArmX = -0.4
        out.rArmY = -0.35 + Math.sin(u * Math.PI * 2) * 0.15
        out.rArmZ = -0.35
        out.swordX = 0.2
        out.swordY = -0.3 + Math.sin(u * Math.PI * 2) * 0.4
        out.swordZ = -0.55
        out.trail = 1
        out.rootY = 0.06
        out.lLegX = Math.sin(u * Math.PI * 2) * 0.22
        out.rLegX = -Math.sin(u * Math.PI * 2) * 0.22
      } else {
        const u = smoothstep((p - 0.74) / 0.26)
        out.bodyYaw = 0
        out.lArmX = lerp(-0.55, REST.lArm.x, u)
        out.lArmY = lerp(0.15, REST.lArm.y, u)
        out.lArmZ = lerp(0.6, REST.lArm.z, u)
        out.rArmX = lerp(-0.4, REST.rArm.x, u)
        out.rArmY = lerp(-0.35, REST.rArm.y, u)
        out.rArmZ = lerp(-0.35, REST.rArm.z, u)
        out.swordX = lerp(0.2, REST.weapon.x, u)
        out.swordY = lerp(-0.3, REST.weapon.y, u)
        out.swordZ = lerp(-0.55, REST.weapon.z, u)
        out.trail = 1 - u
      }
      out.headYaw = out.bodyYaw * 0.12
      return out
    },
  },
}

export const OPENER_POOL: AttackId[] = [
  'slash_h',
  'slash_v',
  'slash_diag',
  'slash_thrust',
]

export const COMBO_ROUTE: AttackId[] = [
  'slash_h',
  'slash_h_rev',
  'slash_diag',
  'slash_spin',
]

export function pickOpener(rng = Math.random): AttackId {
  return OPENER_POOL[Math.floor(rng() * OPENER_POOL.length)]!
}

export function nextComboAttack(comboStep: number): AttackId {
  const idx = Math.min(comboStep, COMBO_ROUTE.length - 1)
  return COMBO_ROUTE[idx]!
}

export function getAttack(id: AttackId): AttackDef {
  return ATTACKS[id]
}
