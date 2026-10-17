import type { Object3D } from 'three'
import { getAttack } from './combatAttacks'
import { easeOutCubic, lerp, smoothstep } from './easing'
import { setPos, setRot, setScale } from './pose'
import type { AnimDriver } from './types'

export type PlayerBones = {
  root: Object3D
  body: Object3D
  head: Object3D
  leftArm: Object3D
  rightArm: Object3D
  leftLeg: Object3D
  rightLeg: Object3D
  /** Body-centered two-handed weapon root */
  sword: Object3D
  scarf: Object3D
  bladeTip?: Object3D | null
}

/**
 * Rest: greatsword held upright-ish in front, both hands on the long hilt.
 * Left hand higher on grip, right hand lower (classic 2H stance).
 */
const REST = {
  // arms angled inward toward center hilt
  leftArm: { x: -0.55, y: 0.35, z: 0.55 },
  rightArm: { x: -0.45, y: -0.25, z: -0.45 },
  // weapon local euler on torso
  weapon: { x: 0.35, y: 0.08, z: -0.12 },
  weaponPos: { x: 0.02, y: -0.02, z: 0.28 },
}

/**
 * Apply hierarchical procedural pose — two-handed greatsword.
 */
export function applyPlayerPose(bones: PlayerBones, d: AnimDriver, dt: number) {
  void dt
  const t = d.time
  const st = d.stateTime

  let rootY = 0
  let rootRoll = 0
  let rootPitch = 0
  let bodyYaw = 0
  let bodyPitch = 0
  let bodyRoll = 0
  let headPitch = 0
  let headYaw = 0
  let headBob = 0

  let lArmX = REST.leftArm.x
  let lArmY = REST.leftArm.y
  let lArmZ = REST.leftArm.z
  let rArmX = REST.rightArm.x
  let rArmY = REST.rightArm.y
  let rArmZ = REST.rightArm.z

  let lLegX = 0
  let rLegX = 0
  let lLegZ = 0
  let rLegZ = 0

  let wX = REST.weapon.x
  let wY = REST.weapon.y
  let wZ = REST.weapon.z
  let wPosX = REST.weaponPos.x
  let wPosY = REST.weaponPos.y
  let wPosZ = REST.weaponPos.z

  let scaleY = 1
  let scaleX = 1
  let trail = 0

  const breath = Math.sin(t * 2.1) * 0.02

  switch (d.state) {
    case 'idle': {
      rootY = breath * 0.3
      bodyPitch = breath * 0.35
      headPitch = Math.sin(t * 1.3) * 0.05
      headYaw = Math.sin(t * 0.65) * 0.07
      bodyRoll = Math.sin(t * 0.85) * 0.025

      // both hands breathe with the blade
      const grip = Math.sin(t * 2.1) * 0.04
      lArmX = REST.leftArm.x + grip
      rArmX = REST.rightArm.x + grip * 0.8
      lArmY = REST.leftArm.y + Math.sin(t * 1.4) * 0.03
      rArmY = REST.rightArm.y - Math.sin(t * 1.4) * 0.03
      wX = REST.weapon.x + grip * 0.5
      wZ = REST.weapon.z + Math.sin(t * 1.6) * 0.03
      wPosY = REST.weaponPos.y + breath * 0.4
      break
    }
    case 'walk': {
      const cadence = 9.2 + d.speed * 2.8
      const phase = t * cadence
      const swing = Math.sin(phase)
      const swingOpp = Math.sin(phase + Math.PI)
      const lift = Math.max(0, Math.sin(phase))
      const liftOpp = Math.max(0, Math.sin(phase + Math.PI))

      rootY = Math.abs(Math.sin(phase * 2)) * 0.055 * d.speed
      bodyPitch = -0.06 * d.speed + Math.sin(phase * 2) * 0.025
      bodyRoll = swing * 0.04 * d.speed
      bodyYaw = swing * 0.03

      lLegX = swing * 0.55 * d.speed
      rLegX = swingOpp * 0.55 * d.speed
      lLegZ = lift * 0.08
      rLegZ = liftOpp * 0.08

      // 2H: arms stay on blade, slight sway with torso (no free arm swing)
      lArmX = REST.leftArm.x + swing * 0.08 * d.speed
      rArmX = REST.rightArm.x + swing * 0.06 * d.speed
      lArmY = REST.leftArm.y + swing * 0.05
      rArmY = REST.rightArm.y + swing * 0.04
      lArmZ = REST.leftArm.z
      rArmZ = REST.rightArm.z

      headBob = Math.sin(phase * 2) * 0.025
      wX = REST.weapon.x + swing * 0.06 * d.speed
      wY = REST.weapon.y + swing * 0.05 * d.speed
      wZ = REST.weapon.z + swing * 0.04
      wPosZ = REST.weaponPos.z + Math.abs(swing) * 0.02
      break
    }
    case 'sidestep': {
      const cadence = 11
      const phase = t * cadence
      const swing = Math.sin(phase)
      const side = Math.sign(d.localMoveX || 1)

      rootY = Math.abs(Math.sin(phase * 2)) * 0.05
      bodyRoll = side * 0.16 + swing * 0.03
      bodyYaw = -side * 0.1
      bodyPitch = 0.04

      lLegX = Math.sin(phase) * 0.25
      rLegX = Math.sin(phase + Math.PI) * 0.25
      lLegZ = side * 0.15 * Math.cos(phase)
      rLegZ = -side * 0.15 * Math.cos(phase)

      // blade tracks with side lean
      lArmX = REST.leftArm.x - 0.08
      rArmX = REST.rightArm.x - 0.08
      lArmY = REST.leftArm.y + side * 0.12
      rArmY = REST.rightArm.y + side * 0.1
      wZ = REST.weapon.z + side * 0.12
      wY = REST.weapon.y - side * 0.08
      headYaw = -side * 0.12
      break
    }
    case 'dash': {
      const p = smoothstep(Math.min(1, st / 0.22))
      rootY = lerp(0.1, 0.02, p)
      bodyPitch = lerp(-0.4, -0.12, p)
      bodyRoll = d.localMoveX * 0.22
      scaleY = lerp(0.9, 1.0, p)
      scaleX = lerp(1.1, 1.0, p)

      lLegX = 0.5
      rLegX = -0.22
      // 2H tuck — blade pulled close, both hands still on grip
      lArmX = lerp(REST.leftArm.x, -0.9, 0.7)
      rArmX = lerp(REST.rightArm.x, -0.75, 0.7)
      lArmY = 0.15
      rArmY = -0.1
      lArmZ = 0.35
      rArmZ = -0.25
      wX = lerp(REST.weapon.x, 0.9, 0.85)
      wY = 0.15
      wZ = -0.35
      wPosY = 0.05
      wPosZ = 0.12
      headPitch = 0.18
      trail = 0.3 * (1 - p)
      break
    }
    case 'attack': {
      const def = getAttack(d.attackId)
      const pose = def.sample(d.attackPhase)
      rootY = pose.rootY
      bodyYaw = pose.bodyYaw
      bodyPitch = pose.bodyPitch
      bodyRoll = pose.bodyRoll
      headYaw = pose.headYaw
      headPitch = pose.headPitch
      lArmX = pose.lArmX
      lArmY = pose.lArmY
      lArmZ = pose.lArmZ
      rArmX = pose.rArmX
      rArmY = pose.rArmY
      rArmZ = pose.rArmZ
      lLegX = pose.lLegX
      rLegX = pose.rLegX
      // swordX/Y/Z map to weapon root euler
      wX = pose.swordX
      wY = pose.swordY
      wZ = pose.swordZ
      // keep weapon slightly forward of chest during swings
      wPosX = REST.weaponPos.x + pose.bodyRoll * 0.08
      wPosY = REST.weaponPos.y + pose.rootY * 0.3
      wPosZ = REST.weaponPos.z + 0.04
      trail = pose.trail
      if (d.comboStep >= 3) {
        const punch = Math.sin(d.attackPhase * Math.PI) * 0.06
        scaleX = 1 + punch
        scaleY = 1 - punch * 0.5
      }
      break
    }
    case 'hit': {
      const u = Math.min(1, st / 0.25)
      bodyPitch = lerp(0.32, 0, u)
      bodyRoll = Math.sin(st * 40) * 0.08 * (1 - u)
      headPitch = 0.22 * (1 - u)
      // both hands still cling to blade while recoiling
      lArmX = lerp(REST.leftArm.x, -0.75, 1 - u * 0.3)
      rArmX = lerp(REST.rightArm.x, -0.7, 1 - u * 0.3)
      lArmY = REST.leftArm.y
      rArmY = REST.rightArm.y
      wX = lerp(REST.weapon.x, 0.55, 1 - u)
      wZ = lerp(REST.weapon.z, -0.25, 1 - u)
      rootY = 0.05 * (1 - u)
      scaleX = 1.05
      scaleY = 0.95
      break
    }
    default:
      break
  }

  d.swordTrail = trail

  setPos(bones.root, 0, rootY, 0)
  setRot(bones.root, rootPitch, 0, rootRoll)
  setScale(bones.root, scaleX, scaleY, scaleX)

  setRot(bones.body, bodyPitch, bodyYaw, bodyRoll)
  setPos(bones.head, 0, 0.42 + headBob, 0)
  setRot(bones.head, headPitch, headYaw, 0)

  setRot(bones.leftArm, lArmX, lArmY, lArmZ)
  setRot(bones.rightArm, rArmX, rArmY, rArmZ)
  setRot(bones.leftLeg, lLegX, 0, lLegZ)
  setRot(bones.rightLeg, rLegX, 0, rLegZ)

  // weapon root: position + rotation for two-handed swings
  setPos(bones.sword, wPosX, wPosY, wPosZ)
  setRot(bones.sword, wX, wY, wZ)

  if (bones.scarf) {
    const flutter =
      d.state === 'dash'
        ? 0.9
        : d.state === 'attack'
          ? 0.55 + trail * 0.4
          : d.state === 'walk'
            ? 0.35 + d.speed * 0.4
            : 0.15
    setRot(
      bones.scarf,
      Math.sin(t * (d.state === 'dash' ? 18 : 6)) * 0.25 * flutter,
      0,
      Math.cos(t * 4) * 0.15 * flutter,
    )
  }
}

export function sampleAttackTrail(d: AnimDriver): number {
  if (d.state !== 'attack') return 0
  return d.swordTrail
}

export { easeOutCubic, lerp, smoothstep }
