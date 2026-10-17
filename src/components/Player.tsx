import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier'
import { useKeyboardControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  getAttack,
  nextComboAttack,
  pickOpener,
  type AttackDef,
  type AttackId,
} from '../animation/combatAttacks'
import { createAnimDriver } from '../animation/types'
import { updateAnimDriver, worldToLocalMove } from '../animation/locomotion'
import { PLAYER } from '../game/constants'
import { useGameStore, uid } from '../game/store'
import { runtime, pushVfx } from '../game/runtime'
import {
  getWorldSolids,
  resolveAgainstSolids,
  separateCircles,
  clampToArena,
} from '../game/collision'
import { audio } from '../audio/audio'
import { RiggedPlayer } from '../meshes/riggedPlayer'

const up = new THREE.Vector3(0, 1, 0)
const move = new THREE.Vector3()
const aim = new THREE.Vector3()
const camForward = new THREE.Vector3()
const camRight = new THREE.Vector3()

const COMBO_RESET = 0.42 // seconds after attack ends before combo resets
const MAX_COMBO = 4

function getCameraRelativeMove(
  camera: THREE.Camera,
  forward: boolean,
  back: boolean,
  left: boolean,
  right: boolean,
  out: THREE.Vector3,
) {
  camera.getWorldDirection(camForward)
  camForward.y = 0
  if (camForward.lengthSq() < 1e-6) camForward.set(0, 0, -1)
  else camForward.normalize()
  camRight.crossVectors(camForward, up).normalize()

  const inputY = (forward ? 1 : 0) + (back ? -1 : 0)
  const inputX = (right ? 1 : 0) + (left ? -1 : 0)
  out.set(0, 0, 0)
  out.addScaledVector(camForward, inputY)
  out.addScaledVector(camRight, inputX)
  if (out.lengthSq() > 0) out.normalize()
  return out
}

type CombatState = {
  attack: number
  dash: number
  dashTimer: number
  invuln: number
  attackTimer: number
  attackDuration: number
  facing: number
  hitFlash: number
  prevHp: number
  /** active attack */
  attackId: AttackId
  comboStep: number
  comboTimer: number
  /** queue next attack in combo when window opens */
  bufferChain: boolean
  /** ensure damage once per swing */
  hitDealt: boolean
  attackPressEdge: boolean
}

export function Player() {
  const body = useRef<RapierRigidBody>(null)
  const group = useRef<THREE.Group>(null)
  const mouseDown = useRef(false)
  const wasAttackKey = useRef(false)
  const slashRef = useRef<THREE.Mesh>(null)
  const slashMat = useRef<THREE.MeshBasicMaterial>(null)
  const trailRef = useRef<THREE.Mesh>(null)
  const anim = useMemo(() => createAnimDriver(), [])
  const { camera, pointer, raycaster, gl } = useThree()
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const hit = useRef(new THREE.Vector3())
  const [, getKeys] = useKeyboardControls()
  const dustAcc = useRef(0)

  const cd = useRef<CombatState>({
    attack: 0,
    dash: 0,
    dashTimer: 0,
    invuln: 0,
    attackTimer: 0,
    attackDuration: 0.42,
    facing: 0,
    hitFlash: 0,
    prevHp: PLAYER.maxHp,
    attackId: 'slash_h',
    comboStep: 0,
    comboTimer: 0,
    bufferChain: false,
    hitDealt: false,
    attackPressEdge: false,
  })

  useEffect(() => {
    const el = gl.domElement
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) mouseDown.current = true
    }
    const onUp = (e: PointerEvent) => {
      if (e.button === 0) mouseDown.current = false
    }
    const onLeave = () => {
      mouseDown.current = false
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [gl])

  useFrame((_, dt) => {
    const store = useGameStore.getState()
    if (store.phase === 'title' || store.phase === 'dead' || store.phase === 'victory') return
    const rb = body.current
    if (!rb) return

    raycaster.setFromCamera(pointer, camera)
    if (raycaster.ray.intersectPlane(groundPlane.current, hit.current)) {
      store.setMouseWorld(hit.current.x, hit.current.z)
    }

    const keys = getKeys()
    const c = cd.current
    c.attack = Math.max(0, c.attack - dt)
    c.dash = Math.max(0, c.dash - dt)
    c.dashTimer = Math.max(0, c.dashTimer - dt)
    // Pick up invuln granted by damage (store/runtime) — never clobber it with 0
    c.invuln = Math.max(c.invuln, store.player.invuln, runtime.playerInvuln)
    c.invuln = Math.max(0, c.invuln - dt)
    c.attackTimer = Math.max(0, c.attackTimer - dt)
    c.hitFlash = Math.max(0, c.hitFlash - dt)
    c.comboTimer = Math.max(0, c.comboTimer - dt)

    if (store.player.hp < c.prevHp) c.hitFlash = 0.28
    c.prevHp = store.player.hp

    getCameraRelativeMove(camera, keys.forward, keys.back, keys.left, keys.right, move)

    const t = rb.translation()
    const mw = store.mouseWorld
    aim.set(mw.x - t.x, 0, mw.z - t.z)
    const facing = aim.lengthSq() > 0.0001 ? Math.atan2(aim.x, aim.z) : c.facing
    c.facing = facing

    // ── attack input edge ────────────────────────────────────
    const attackHeld = keys.attack || mouseDown.current
    const attackEdge = attackHeld && !wasAttackKey.current
    wasAttackKey.current = attackHeld

    const phase =
      c.attackTimer > 0 ? 1 - c.attackTimer / c.attackDuration : 0
    const def = getAttack(c.attackId)
    const inAttack = c.attackTimer > 0
    const inChainWindow =
      inAttack && phase >= def.chainFrom && phase <= def.chainUntil

    if (attackEdge && store.phase === 'playing' && c.dashTimer <= 0) {
      if (inChainWindow && c.comboStep < MAX_COMBO - 1) {
        // buffer next combo hit during active swing
        c.bufferChain = true
      } else if (
        !inAttack &&
        c.comboTimer > 0 &&
        c.comboStep < MAX_COMBO - 1 &&
        c.attack <= 0
      ) {
        // continue combo shortly after previous recovery
        const next = c.comboStep + 1
        startAttack(c, nextComboAttack(next), next)
      } else if (!inAttack && c.attack <= 0) {
        // fresh opener — random style
        startAttack(c, pickOpener(), 0)
      }
    }

    // fire buffered chain at earliest good moment
    if (c.bufferChain && inAttack && phase >= def.chainFrom) {
      c.bufferChain = false
      const nextStep = c.comboStep + 1
      if (nextStep < MAX_COMBO) {
        startAttack(c, nextComboAttack(nextStep), nextStep)
      }
    }

    // reset combo if idle too long
    if (!inAttack && c.comboTimer <= 0) {
      c.comboStep = 0
    }

    // ── hit detection once per swing ─────────────────────────
    if (inAttack && !c.hitDealt && phase >= def.hitAt) {
      c.hitDealt = true
      performMeleeAttack(
        t.x,
        t.z,
        facing,
        store.player.level,
        def,
        c.comboStep,
      )
    }

    // ── dash ─────────────────────────────────────────────────
    if (keys.dash && c.dash <= 0 && c.dashTimer <= 0 && !inAttack) {
      c.dashTimer = PLAYER.dashDuration
      c.dash = PLAYER.dashCooldown
      c.invuln = Math.max(c.invuln, PLAYER.dashDuration + 0.05)
      audio.play('dash', { volume: 0.75, rate: 0.95 + Math.random() * 0.1 })
      pushVfx({
        id: uid('vfx'),
        position: [t.x, 0.3, t.z],
        color: '#f4c56d',
        life: 0.28,
        maxLife: 0.28,
        scale: 1.1,
        kind: 'slash',
      })
    }

    const speed = c.dashTimer > 0 ? PLAYER.dashSpeed : PLAYER.speed
    // slight move lock during heavy attacks
    const moveScale = inAttack ? (def.id === 'slash_spin' ? 0.25 : 0.55) : 1
    let vx = move.x * speed * moveScale
    let vz = move.z * speed * moveScale
    if (c.dashTimer > 0 && move.lengthSq() < 0.01) {
      vx = Math.sin(facing) * PLAYER.dashSpeed
      vz = Math.cos(facing) * PLAYER.dashSpeed
    }

    if (inAttack) {
      const lungeGate = phase > def.hitAt - 0.08 && phase < def.hitAt + 0.18
      if (lungeGate) {
        vx += Math.sin(facing) * def.lunge
        vz += Math.cos(facing) * def.lunge
      }
    }

    let nx = t.x + vx * dt
    let nz = t.z + vz * dt

    // World props + hedges + pond
    const solids = getWorldSolids(store.seed)
    const againstWorld = resolveAgainstSolids(nx, nz, PLAYER.radius, solids, 1)
    nx = againstWorld.x
    nz = againstWorld.z

    // Soft body-block vs living mobs (dash slips through)
    if (c.dashTimer <= 0) {
      for (const mob of runtime.mobs) {
        if (!mob.alive) continue
        const sep = separateCircles(
          nx,
          nz,
          PLAYER.radius,
          mob.position[0],
          mob.position[2],
          mob.radius * 0.92,
          0.72,
        )
        nx += sep.dax
        nz += sep.daz
        // Nudge mob slightly so stacks don't pin the player
        mob.position[0] += sep.dbx * 0.55
        mob.position[2] += sep.dbz * 0.55
      }
      // Re-resolve props after mob push
      const again = resolveAgainstSolids(nx, nz, PLAYER.radius, solids, 1)
      nx = again.x
      nz = again.z
    }

    const clamped = clampToArena(nx, nz, 1.2)
    nx = clamped.x
    nz = clamped.z

    rb.setNextKinematicTranslation({ x: nx, y: 0.55, z: nz })
    rb.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(up, facing))

    // foot dust + soft steps
    const moveSpeed = Math.hypot(vx, vz)
    audio.tickFootstep(dt, c.dashTimer > 0 ? 0 : moveSpeed)
    dustAcc.current += dt * (c.dashTimer > 0 ? 3 : moveSpeed > 1 ? 1 : 0)
    if (dustAcc.current > 0.12 && moveSpeed > 2) {
      dustAcc.current = 0
      pushVfx({
        id: uid('vfx'),
        position: [nx - Math.sin(facing) * 0.15, 0.12, nz - Math.cos(facing) * 0.15],
        color: c.dashTimer > 0 ? '#f0d090' : '#c4b89a',
        life: 0.22,
        maxLife: 0.22,
        scale: c.dashTimer > 0 ? 0.9 : 0.45,
        kind: 'spawn',
      })
    }

    // anim driver
    const local = worldToLocalMove(vx, vz, facing)
    updateAnimDriver(anim, dt, {
      speed: moveSpeed,
      localMoveX: local.x,
      localMoveZ: local.z,
      dashing: c.dashTimer > 0,
      attacking: inAttack,
      attackPhase: phase,
      hitFlash: c.hitFlash,
    })
    anim.facing = facing
    anim.attackId = c.attackId
    anim.comboStep = c.comboStep

    // slash arc mesh — style-specific
    updateSlashArc(slashRef.current, slashMat.current, def, phase, inAttack, c.comboStep)

    if (group.current) {
      group.current.position.set(nx, 0, nz)
      group.current.rotation.y = facing
      // Hurt flash blink + dash i-frame blink
      const hurtBlink = runtime.playerHurtFx > 0 && Math.floor(runtime.playerHurtFx * 24) % 2 === 0
      if (c.invuln > 0 && c.dashTimer <= 0) {
        group.current.visible = Math.floor(c.invuln * 18) % 2 === 0
      } else if (hurtBlink) {
        group.current.visible = false
      } else {
        group.current.visible = true
      }
      // slight knockback tilt while hurt
      if (runtime.playerHurtFx > 0) {
        const kick = (runtime.playerHurtFx / 0.55) * 0.12
        group.current.rotation.x = -kick
        group.current.position.y = kick * 0.4
      } else {
        group.current.rotation.x = 0
        group.current.position.y = 0
      }
    }

    if (trailRef.current) {
      const dashing = c.dashTimer > 0
      trailRef.current.visible = dashing
      if (dashing) {
        trailRef.current.scale.set(1, 1, 1 + (1 - c.dashTimer / PLAYER.dashDuration) * 1.2)
        const mat = trailRef.current.material as THREE.MeshBasicMaterial
        mat.opacity = 0.35 * (c.dashTimer / PLAYER.dashDuration)
      }
    }

    runtime.playerPos = [nx, 0.55, nz]
    runtime.playerFacing = facing
    runtime.playerAttackTimer = c.attackTimer
    runtime.playerInvuln = c.invuln

    const prev = store.player
    if (
      Math.abs(prev.position[0] - nx) > 0.01 ||
      Math.abs(prev.position[2] - nz) > 0.01 ||
      Math.abs(prev.facing - facing) > 0.05 ||
      prev.attackCd !== c.attack ||
      Math.abs(prev.invuln - c.invuln) > 0.02
    ) {
      store.patchPlayer({
        position: [nx, 0.55, nz],
        facing,
        attackCd: c.attack,
        dashCd: c.dash,
        dashTimer: c.dashTimer,
        invuln: c.invuln,
        attackTimer: c.attackTimer,
        attackFacing: facing,
      })
    }
  })

  return (
    <>
      <RigidBody
        ref={body}
        type="kinematicPosition"
        colliders={false}
        position={[0, 0.55, 0]}
        enabledRotations={[false, false, false]}
      >
        <CapsuleCollider args={[0.28, PLAYER.radius]} />
      </RigidBody>
      <group ref={group}>
        <RiggedPlayer driver={anim} />

        {/* dynamic attack arc */}
        <mesh ref={slashRef} visible={false}>
          <ringGeometry args={[0.55, 1.85, 28, 1, -0.8, 1.7]} />
          <meshBasicMaterial
            ref={slashMat}
            color="#ffe6a0"
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        <mesh ref={trailRef} position={[0, 0.55, -0.35]} visible={false}>
          <boxGeometry args={[0.35, 0.7, 0.8]} />
          <meshBasicMaterial color="#f4c56d" transparent opacity={0.3} depthWrite={false} />
        </mesh>
      </group>
    </>
  )
}

function startAttack(c: CombatState, id: AttackId, comboStep: number) {
  const def = getAttack(id)
  c.attackId = id
  c.comboStep = comboStep
  c.attackDuration = def.duration
  c.attackTimer = def.duration
  // short global GCD so openers don't spam; chaining uses buffer instead
  c.attack = comboStep === 0 ? 0.12 : 0.05
  c.comboTimer = def.duration + COMBO_RESET
  c.hitDealt = false
  c.bufferChain = false
  audio.play('sword-swing', {
    volume: 0.55 + comboStep * 0.08,
    rate: 0.92 + comboStep * 0.04 + Math.random() * 0.08,
  })
}

function updateSlashArc(
  mesh: THREE.Mesh | null,
  mat: THREE.MeshBasicMaterial | null,
  def: AttackDef,
  phase: number,
  active: boolean,
  comboStep: number,
) {
  if (!mesh || !mat) return
  const show = active && phase > def.hitAt - 0.12 && phase < def.hitAt + 0.28
  mesh.visible = show
  if (!show) return

  const a = def.arc
  // local space in front of player
  mesh.position.set(0, a.y, 0.25)
  mesh.rotation.set(-Math.PI / 2 + a.pitch, a.yaw, 0)

  // rebuild geometry if theta differs (cheap enough)
  const geo = mesh.geometry as THREE.RingGeometry
  const params = geo.parameters
  if (
    Math.abs(params.thetaStart - a.thetaStart) > 0.01 ||
    Math.abs(params.thetaLength - a.thetaLength) > 0.01
  ) {
    mesh.geometry.dispose()
    mesh.geometry = new THREE.RingGeometry(0.5, 1.9, 32, 1, a.thetaStart, a.thetaLength)
  }

  const flash = Math.sin(((phase - (def.hitAt - 0.12)) / 0.4) * Math.PI)
  mat.color.set(a.color)
  mat.opacity = Math.max(0, flash) * (0.55 + comboStep * 0.1)
  const s = 1 + comboStep * 0.08 + Math.max(0, flash) * 0.15
  mesh.scale.setScalar(s)
}

function performMeleeAttack(
  px: number,
  pz: number,
  facing: number,
  level: number,
  def: AttackDef,
  comboStep: number,
) {
  const store = useGameStore.getState()
  const base = PLAYER.attackDamage + (level - 1) * 3 + Math.floor(Math.random() * 5)
  const damage = Math.round(base * def.damageMul * (1 + comboStep * 0.08))

  // swing spark
  const reach = def.id === 'slash_thrust' ? 1.4 : 1.15
  pushVfx({
    id: uid('vfx'),
    position: [px + Math.sin(facing) * reach, 0.85, pz + Math.cos(facing) * reach],
    color: def.arc.color,
    life: 0.22 + comboStep * 0.04,
    maxLife: 0.22 + comboStep * 0.04,
    scale: 1.2 + comboStep * 0.25,
    kind: 'slash',
  })

  // finisher ring
  if (comboStep >= 3) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      pushVfx({
        id: uid('vfx'),
        position: [px + Math.cos(a) * 1.2, 0.5, pz + Math.sin(a) * 1.2],
        color: '#ffb060',
        life: 0.35,
        maxLife: 0.35,
        scale: 0.7,
        kind: 'slash',
      })
    }
  }

  const arc =
    def.id === 'slash_spin'
      ? Math.PI * 1.9
      : def.id === 'slash_thrust'
        ? PLAYER.attackArc * 0.45
        : PLAYER.attackArc

  for (const mob of runtime.mobs) {
    if (!mob.alive) continue
    const dx = mob.position[0] - px
    const dz = mob.position[2] - pz
    const dist = Math.hypot(dx, dz)
    const range =
      PLAYER.attackRange +
      mob.radius +
      (def.id === 'slash_thrust' ? 0.35 : 0) +
      (def.id === 'slash_spin' ? 0.45 : 0)
    if (dist > range) continue

    if (def.id !== 'slash_spin') {
      const angle = Math.atan2(dx, dz)
      let diff = angle - facing
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      if (Math.abs(diff) > arc * 0.5) continue
    }

    mob.hp = Math.max(0, mob.hp - damage)
    mob.hitFlash = 0.22
    const kb = (0.5 + (mob.isBoss ? 0.12 : 0.32)) * def.knockbackMul
    mob.position[0] += Math.sin(facing) * kb
    mob.position[2] += Math.cos(facing) * kb
    // Keep knockback from burying mobs inside props
    const solids = getWorldSolids(store.seed)
    const fixed = resolveAgainstSolids(
      mob.position[0],
      mob.position[2],
      mob.radius,
      solids,
      1,
    )
    const arena = clampToArena(fixed.x, fixed.z, 1.4)
    mob.position[0] = arena.x
    mob.position[2] = arena.z

    audio.play('sword-hit', {
      volume: 0.7 + comboStep * 0.05,
      rate: 0.95 + Math.random() * 0.12,
    })

    pushVfx({
      id: uid('vfx'),
      position: [mob.position[0], 1, mob.position[2]],
      color: '#fff4d0',
      life: 0.28,
      maxLife: 0.28,
      scale: 0.95 + comboStep * 0.1,
      kind: 'hit',
    })

    if (mob.hp <= 0) {
      mob.alive = false
      audio.play(mob.isBoss ? 'boss-roar' : 'mob-death', {
        volume: mob.isBoss ? 0.9 : 0.65,
        rate: 0.95 + Math.random() * 0.1,
      })
      pushVfx({
        id: uid('vfx'),
        position: [...mob.position] as [number, number, number],
        color: mob.isBoss ? '#d080ff' : '#f0c27a',
        life: 0.55,
        maxLife: 0.55,
        scale: mob.isBoss ? 2.5 : 1.1,
        kind: 'death',
      })
      store.grantXp(mob.xp)
      store.patchPlayer({ kills: store.player.kills + 1 })
      store.addToast(mob.isBoss ? 'Boss defeated!' : `+${mob.xp} XP`, mob.isBoss ? 'loot' : 'info')

      if (mob.isBoss) {
        store.healPlayer(30)
        audio.play('heal', { volume: 0.7 })
        if (store.wave >= 15) {
          store.setPhase('victory')
          store.setBanner('MINEBREAK is safe')
          audio.play('victory', { volume: 0.95 })
        }
      }

      store.setMobs(runtime.mobs.map((m) => ({ ...m, position: [...m.position] as [number, number, number] })))
      store.checkWaveClear()
    } else if (mob.isBoss) {
      store.setMobs(runtime.mobs.map((m) => ({ ...m, position: [...m.position] as [number, number, number] })))
    }
  }
}
