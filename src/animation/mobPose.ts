import type { Object3D } from 'three'
import { easeOutCubic, lerp, smoothstep } from './easing'
import { setPos, setRot, setScale } from './pose'
import type { AnimDriver } from './types'
import type { MobKind } from '../game/types'

export type MobBones = {
  root: Object3D
  body: Object3D
  head?: Object3D | null
  leftLimb?: Object3D | null
  rightLimb?: Object3D | null
  extra?: Object3D | null
}

export function applyMobPose(kind: MobKind, bones: MobBones, d: AnimDriver) {
  switch (kind) {
    case 'slime':
      applySlime(bones, d)
      break
    case 'mushroom':
      applyMushroom(bones, d)
      break
    case 'imp':
      applyImp(bones, d)
      break
    case 'beetle':
      applyBeetle(bones, d)
      break
    case 'boss':
      applyBoss(bones, d)
      break
  }

  // shared hit flash squash
  if (d.hitFlash > 0) {
    const k = Math.min(1, d.hitFlash * 8)
    setScale(bones.root, 1 + 0.08 * k, 1 - 0.1 * k, 1 + 0.08 * k)
    setRot(bones.body, bones.body.rotation.x + 0.15 * k, bones.body.rotation.y, bones.body.rotation.z)
  }

  if (d.state === 'death') {
    const u = smoothstep(d.deathPhase)
    setScale(bones.root, lerp(1, 0.2, u), lerp(1, 0.05, u), lerp(1, 0.2, u))
    setPos(bones.root, 0, lerp(0, -0.2, u), 0)
    setRot(bones.body, lerp(0, 0.8, u), d.time * 3 * u, 0)
  }
}

function applySlime(bones: MobBones, d: AnimDriver) {
  const t = d.time
  let sy = 1
  let sx = 1
  let y = 0
  let pitch = 0

  if (d.state === 'idle') {
    const b = Math.sin(t * 3)
    sy = 1 + b * 0.08
    sx = 1 - b * 0.06
    y = Math.abs(b) * 0.03
  } else if (d.state === 'walk' || d.state === 'sidestep') {
    const hop = Math.abs(Math.sin(t * 8))
    y = hop * 0.22 * d.speed
    sy = 1 - hop * 0.2
    sx = 1 + hop * 0.18
    pitch = -0.15 * d.speed
  } else if (d.state === 'attack') {
    const p = d.attackPhase
    if (p < 0.4) {
      const u = p / 0.4
      sy = lerp(1, 0.7, u)
      sx = lerp(1, 1.25, u)
      y = 0.05
    } else {
      const u = (p - 0.4) / 0.6
      sy = lerp(0.7, 1.15, easeOutCubic(u))
      sx = lerp(1.25, 0.9, easeOutCubic(u))
      y = lerp(0.05, 0.25, easeOutCubic(Math.min(1, u * 2))) * (1 - u)
      pitch = -0.35 * (1 - u)
    }
  } else if (d.state === 'dash') {
    sy = 0.75
    sx = 1.3
    pitch = -0.4
    y = 0.1
  }

  setScale(bones.root, sx, sy, sx)
  setPos(bones.root, 0, y, 0)
  setRot(bones.body, pitch, 0, d.localMoveX * 0.2)
}

function applyMushroom(bones: MobBones, d: AnimDriver) {
  const t = d.time
  let bob = 0
  let sway = 0
  let capScale = 1
  let bodyPitch = 0

  if (d.state === 'idle') {
    bob = Math.sin(t * 2) * 0.03
    sway = Math.sin(t * 1.2) * 0.06
    capScale = 1 + Math.sin(t * 2) * 0.03
  } else if (d.state === 'walk' || d.state === 'sidestep') {
    const phase = t * 7
    bob = Math.abs(Math.sin(phase)) * 0.08
    sway = Math.sin(phase) * 0.12
    bodyPitch = -0.1
    setRot(bones.leftLimb, Math.sin(phase) * 0.4, 0, 0)
    setRot(bones.rightLimb, Math.sin(phase + Math.PI) * 0.4, 0, 0)
  } else if (d.state === 'attack') {
    const p = d.attackPhase
    if (p < 0.35) {
      bodyPitch = -0.4 * (p / 0.35)
      capScale = 1.15
    } else {
      const u = (p - 0.35) / 0.65
      bodyPitch = lerp(-0.4, 0.5, easeOutCubic(u))
      capScale = lerp(1.15, 0.95, u)
      bob = easeOutCubic(Math.min(1, u * 2)) * 0.15 * (1 - u)
    }
  }

  setPos(bones.root, 0, bob, 0)
  setRot(bones.body, bodyPitch, sway, d.localMoveX * 0.15)
  if (bones.head) setScale(bones.head, capScale, 1 / Math.sqrt(capScale), capScale)
}

function applyImp(bones: MobBones, d: AnimDriver) {
  const t = d.time
  let y = 0.08 + Math.sin(t * 5) * 0.06
  let bodyRoll = 0
  let bodyPitch = 0

  // wing flap on limbs
  const flapSpeed = d.state === 'dash' ? 22 : d.state === 'walk' ? 14 : 8
  const flap = Math.sin(t * flapSpeed)
  setRot(bones.leftLimb, 0.2, 0, 0.5 + flap * 0.55)
  setRot(bones.rightLimb, 0.2, 0, -0.5 - flap * 0.55)

  if (d.state === 'idle') {
    bodyRoll = Math.sin(t * 2) * 0.08
  } else if (d.state === 'walk' || d.state === 'sidestep') {
    y = 0.12 + Math.abs(Math.sin(t * 10)) * 0.1
    bodyPitch = -0.15
    bodyRoll = d.localMoveX * 0.25
  } else if (d.state === 'dash') {
    y = 0.2
    bodyPitch = -0.5
  } else if (d.state === 'attack' || d.state === 'cast') {
    const p = d.attackPhase
    bodyPitch = p < 0.4 ? -0.3 : 0.4 * easeOutCubic((p - 0.4) / 0.6)
    y = 0.18
    // throw pose
    setRot(bones.rightLimb, -1.2 + d.attackPhase * 1.5, 0.4, -0.3)
  }

  setPos(bones.root, 0, y, 0)
  setRot(bones.body, bodyPitch, 0, bodyRoll)
  if (bones.head) setRot(bones.head, Math.sin(t * 3) * 0.1, Math.sin(t * 1.5) * 0.15, 0)
}

function applyBeetle(bones: MobBones, d: AnimDriver) {
  const t = d.time
  let y = 0
  let pitch = 0
  let roll = 0

  if (d.state === 'idle') {
    y = Math.sin(t * 2.5) * 0.02
    setRot(bones.leftLimb, 0, 0, Math.sin(t * 3) * 0.1)
    setRot(bones.rightLimb, 0, 0, -Math.sin(t * 3) * 0.1)
  } else if (d.state === 'walk' || d.state === 'sidestep') {
    const phase = t * 12
    y = Math.abs(Math.sin(phase * 2)) * 0.04
    pitch = -0.12
    roll = Math.sin(phase) * 0.08
    // scuttle legs
    setRot(bones.leftLimb, Math.sin(phase) * 0.5, 0, 0.3)
    setRot(bones.rightLimb, Math.sin(phase + Math.PI) * 0.5, 0, -0.3)
    if (bones.extra) setRot(bones.extra, Math.sin(phase * 0.5) * 0.2, 0, 0)
  } else if (d.state === 'attack') {
    const p = d.attackPhase
    if (p < 0.35) {
      pitch = -0.5 * (p / 0.35)
      y = 0.08
    } else {
      const u = easeOutCubic((p - 0.35) / 0.65)
      pitch = lerp(-0.5, 0.55, u)
      y = lerp(0.08, 0.02, u)
    }
  } else if (d.state === 'dash') {
    pitch = -0.35
    y = 0.06
  }

  setPos(bones.root, 0, y, 0)
  setRot(bones.body, pitch, 0, roll + d.localMoveX * 0.2)
}

function applyBoss(bones: MobBones, d: AnimDriver) {
  const t = d.time
  let y = 0
  let bodyYaw = 0
  let bodyPitch = 0
  let bodyRoll = 0

  // heavy breath
  const breath = Math.sin(t * 1.6)
  setScale(bones.body, 1 + breath * 0.03, 1 + breath * 0.04, 1 + breath * 0.03)

  if (d.state === 'idle') {
    bodyYaw = Math.sin(t * 0.6) * 0.08
    setRot(bones.leftLimb, Math.sin(t * 1.2) * 0.08, 0, 0.15)
    setRot(bones.rightLimb, Math.sin(t * 1.2 + 1) * 0.08, 0, -0.15)
    if (bones.head) setRot(bones.head, 0, Math.sin(t * 0.8) * 0.12, 0)
  } else if (d.state === 'walk' || d.state === 'sidestep') {
    const phase = t * 5
    y = Math.abs(Math.sin(phase)) * 0.1
    bodyRoll = Math.sin(phase) * 0.08
    bodyPitch = -0.08
    setRot(bones.leftLimb, Math.sin(phase) * 0.35, 0, 0.1)
    setRot(bones.rightLimb, Math.sin(phase + Math.PI) * 0.35, 0, -0.1)
    if (bones.extra) {
      // crown sway
      setRot(bones.extra, 0, Math.sin(phase * 0.5) * 0.1, Math.sin(phase) * 0.05)
    }
  } else if (d.state === 'attack' || d.state === 'cast') {
    const p = d.attackPhase
    if (p < 0.3) {
      const u = p / 0.3
      bodyPitch = -0.25 * u
      setRot(bones.leftLimb, -0.8 * u, 0, 0.4)
      setRot(bones.rightLimb, -0.8 * u, 0, -0.4)
      y = 0.15 * u
    } else if (p < 0.55) {
      const u = easeOutCubic((p - 0.3) / 0.25)
      bodyPitch = lerp(-0.25, 0.4, u)
      setRot(bones.leftLimb, lerp(-0.8, 0.6, u), 0, lerp(0.4, 0.1, u))
      setRot(bones.rightLimb, lerp(-0.8, 0.6, u), 0, lerp(-0.4, -0.1, u))
      y = lerp(0.15, 0, u)
    } else {
      const u = (p - 0.55) / 0.45
      bodyPitch = lerp(0.4, 0, u)
      setRot(bones.leftLimb, lerp(0.6, 0, u), 0, 0.15)
      setRot(bones.rightLimb, lerp(0.6, 0, u), 0, -0.15)
    }
  } else if (d.state === 'dash') {
    bodyPitch = -0.3
    y = 0.1
  }

  setPos(bones.root, 0, y, 0)
  setRot(bones.body, bodyPitch, bodyYaw, bodyRoll)
}
