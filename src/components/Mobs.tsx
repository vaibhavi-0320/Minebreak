import { useFrame } from '@react-three/fiber'
import { useRef, useLayoutEffect, useMemo, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { createAnimDriver, type AnimDriver } from '../animation/types'
import { updateAnimDriver, worldToLocalMove } from '../animation/locomotion'
import { ARENA_HALF, PLAYER } from '../game/constants'
import { useGameStore, uid } from '../game/store'
import { runtime, pushVfx } from '../game/runtime'
import {
  getWorldSolids,
  resolveAgainstSolids,
  separateCircles,
  clampToArena,
} from '../game/collision'
import { createSteerState, steerMob, type SteerState } from '../game/navigation'
import { RiggedMob } from '../meshes/riggedMobs'
import type { MobState, Projectile } from '../game/types'
import { EnemyNameplate } from './EnemyNameplate'

type MobRuntimeFx = {
  anim: AnimDriver
  attackTimer: number
  attackDuration: number
  prevX: number
  prevZ: number
  windup: boolean
  /** Melee/special damage applied once per attack animation */
  hitDealt: boolean
  /** Obstacle-aware chase state */
  steer: SteerState
}

const mobFx = new Map<string, MobRuntimeFx>()

function getMobFx(id: string): MobRuntimeFx {
  let fx = mobFx.get(id)
  if (!fx) {
    fx = {
      anim: createAnimDriver(),
      attackTimer: 0,
      attackDuration: 0.55,
      prevX: 0,
      prevZ: 0,
      windup: false,
      hitDealt: false,
      steer: createSteerState(),
    }
    mobFx.set(id, fx)
  }
  return fx
}

export function Mobs() {
  const storeMobs = useGameStore((s) => s.mobs)
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map())

  useLayoutEffect(() => {
    const prev = new Map(runtime.mobs.map((m) => [m.id, m]))
    runtime.mobs = storeMobs.map((m) => {
      const old = prev.get(m.id)
      if (old && old.alive) {
        return {
          ...m,
          position: [...old.position] as [number, number, number],
          attackCd: old.attackCd,
          hitFlash: old.hitFlash,
          hp: old.hp,
          alive: old.alive,
        }
      }
      return { ...m, position: [...m.position] as [number, number, number] }
    })
    // prune fx for dead ids
    const live = new Set(storeMobs.map((m) => m.id))
    for (const id of mobFx.keys()) {
      if (!live.has(id)) mobFx.delete(id)
    }
  }, [storeMobs])

  useFrame((_, dt) => {
    const store = useGameStore.getState()
    if (store.phase !== 'playing' && store.phase !== 'bossIntro') {
      store.tickMeta(dt)
      return
    }

    const [px, , pz] = runtime.playerPos
    // Prefer runtime, fall back to store (damage sets both)
    const playerInvuln = Math.max(runtime.playerInvuln, store.player.invuln)
    const solids = getWorldSolids(store.seed)
    let playerHit = 0
    for (const mob of runtime.mobs) {
      if (!mob.alive) {
        const fx = getMobFx(mob.id)
        const deathPhase = Math.min(1, fx.anim.deathPhase + dt * 1.8)
        updateAnimDriver(fx.anim, dt, {
          speed: 0,
          localMoveX: 0,
          localMoveZ: 0,
          dashing: false,
          attacking: false,
          attackPhase: 0,
          hitFlash: 0,
          dead: true,
          deathPhase,
        })
        const g = groupRefs.current.get(mob.id)
        if (g) {
          g.position.set(mob.position[0], 0, mob.position[2])
        }
        continue
      }

      const fx = getMobFx(mob.id)
      mob.hitFlash = Math.max(0, mob.hitFlash - dt)
      mob.attackCd = Math.max(0, mob.attackCd - dt)
      fx.attackTimer = Math.max(0, fx.attackTimer - dt)

      const dx = px - mob.position[0]
      const dz = pz - mob.position[2]
      const dist = Math.hypot(dx, dz) || 0.0001
      const dirX = dx / dist
      const dirZ = dz / dist

      let speed = mob.speed
      if (mob.isBoss) {
        const hpRatio = mob.hp / mob.maxHp
        speed *= hpRatio < 0.35 ? 1.35 : hpRatio < 0.65 ? 1.15 : 1
      }

      let x = mob.position[0]
      let z = mob.position[2]
      const stopDist = mob.radius + PLAYER.radius + (mob.isBoss ? 0.4 : 0.2)
      let moving = false
      // Facing defaults toward player; steering may re-aim while detouring
      let faceX = dirX
      let faceZ = dirZ

      // hold still during attack windup/strike
      const attacking = fx.attackTimer > 0
      if (!attacking && dist > stopDist) {
        // Obstacle-aware chase: re-route around trees/rocks/cottage/pond
        const stepped = steerMob(
          x,
          z,
          px,
          pz,
          mob.radius,
          speed,
          dt,
          solids,
          fx.steer,
        )
        x = stepped.x
        z = stepped.z
        faceX = stepped.faceX
        faceZ = stepped.faceZ
        moving = stepped.moving
      } else if (!attacking) {
        // In melee range — clear stuck/detour so next chase is fresh
        fx.steer.stuck = 0
        fx.steer.wLife = 0
      }

      // occasional side-step strafe for imps/beetles (only if not deep in a detour)
      if (
        !attacking &&
        fx.steer.wLife <= 0 &&
        (mob.kind === 'imp' || mob.kind === 'beetle') &&
        dist < 8 &&
        Math.random() < 0.01
      ) {
        const side = Math.random() > 0.5 ? 1 : -1
        x += -dirZ * side * speed * 1.4 * dt * 8
        z += dirX * side * speed * 1.4 * dt * 8
        moving = true
      }

      // Mob ↔ mob separation (soft)
      for (const other of runtime.mobs) {
        if (!other.alive || other.id === mob.id) continue
        const sep = separateCircles(
          x,
          z,
          mob.radius,
          other.position[0],
          other.position[2],
          other.radius * 0.9,
          0.55,
        )
        x += sep.dax
        z += sep.daz
      }

      // Soft body-block vs player (player dash is handled on player side)
      {
        const sep = separateCircles(
          x,
          z,
          mob.radius,
          px,
          pz,
          PLAYER.radius,
          0.35,
        )
        x += sep.dax
        z += sep.daz
      }

      // Final resolve so separation doesn't bury them in props
      const against = resolveAgainstSolids(x, z, mob.radius, solids, 1)
      x = against.x
      z = against.z

      const clamped = clampToArena(x, z, 1.4)
      x = clamped.x
      z = clamped.z

      const vx = (x - mob.position[0]) / Math.max(dt, 1e-4)
      const vz = (z - mob.position[2]) / Math.max(dt, 1e-4)
      mob.position[0] = x
      mob.position[1] = 0
      mob.position[2] = z

      // Face movement when detouring; face player when in range / attacking
      const facing =
        attacking || dist <= stopDist + 0.4
          ? Math.atan2(dirX, dirZ)
          : Math.atan2(faceX, faceZ)

      const g = groupRefs.current.get(mob.id)
      if (g) {
        g.position.set(x, 0, z)
        // smooth yaw
        const targetYaw = facing
        let yaw = g.rotation.y
        let diff = targetYaw - yaw
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        g.rotation.y = yaw + diff * Math.min(1, 10 * dt)
      }

      const contact = Math.hypot(px - x, pz - z)

      // melee windup → strike (one hit per attack animation)
      if (!attacking && contact < stopDist + 0.35 && mob.attackCd <= 0 && mob.kind !== 'imp') {
        fx.attackDuration = mob.isBoss ? 0.75 : mob.kind === 'slime' ? 0.45 : 0.55
        fx.attackTimer = fx.attackDuration
        fx.hitDealt = false
        mob.attackCd = mob.isBoss ? 1.4 : 1.0
      }

      if (attacking) {
        const phase = 1 - fx.attackTimer / fx.attackDuration
        // Single strike frame window — never multi-tick damage
        if (
          !fx.hitDealt &&
          phase >= 0.38 &&
          phase <= 0.48 &&
          playerInvuln <= 0 &&
          playerHit === 0 &&
          contact < stopDist + 0.55
        ) {
          fx.hitDealt = true
          playerHit += mob.damage
        }
      }

      // boss specials when not mid-melee
      if (mob.isBoss && !attacking && mob.attackCd <= 0.01) {
        const roll = Math.random()
        if (roll < 0.4) {
          fx.attackDuration = 0.85
          fx.attackTimer = 0.85
          fx.hitDealt = true // projectiles handle damage, not melee window
          const count = mob.hp / mob.maxHp < 0.4 ? 10 : 6
          const bx = x
          const bz = z
          const dmg = Math.round(mob.damage * 0.7)
          window.setTimeout(() => {
            for (let i = 0; i < count; i++) {
              const a = (i / count) * Math.PI * 2
              runtime.projectiles.push({
                id: uid('proj'),
                position: [bx, 0.9, bz],
                velocity: [Math.cos(a) * 5.5, 0, Math.sin(a) * 5.5],
                damage: dmg,
                life: 3.2,
                fromBoss: true,
                radius: 0.28,
              })
            }
          }, 350)
          mob.attackCd = 2.4
        } else if (roll < 0.7) {
          fx.attackDuration = 0.7
          fx.attackTimer = 0.7
          fx.hitDealt = true
          const base = facing
          const dmg = mob.damage
          const bx = x
          const bz = z
          window.setTimeout(() => {
            for (let i = -1; i <= 1; i++) {
              const a = base + i * 0.22
              runtime.projectiles.push({
                id: uid('proj'),
                position: [bx, 0.95, bz],
                velocity: [Math.sin(a) * 7.5, 0, Math.cos(a) * 7.5],
                damage: dmg,
                life: 2.8,
                fromBoss: true,
                radius: 0.32,
              })
            }
          }, 280)
          mob.attackCd = 1.8
        } else {
          fx.attackDuration = 0.9
          fx.attackTimer = 0.9
          fx.hitDealt = true
          pushVfx({
            id: uid('vfx'),
            position: [x, 0.2, z],
            color: '#c080e0',
            life: 0.5,
            maxLife: 0.5,
            scale: 3.8,
            kind: 'spawn',
          })
          if (contact < 4.5 && playerInvuln <= 0 && playerHit === 0) {
            playerHit += Math.round(mob.damage * 1.2)
          }
          mob.attackCd = 2.6
        }
      }

      // imp ranged
      if (mob.kind === 'imp' && !attacking && mob.attackCd <= 0 && dist < 8 && dist > 2.2 && Math.random() < 0.025) {
        fx.attackDuration = 0.5
        fx.attackTimer = 0.5
        fx.hitDealt = true
        const bx = x
        const bz = z
        const dmg = mob.damage
        window.setTimeout(() => {
          runtime.projectiles.push({
            id: uid('proj'),
            position: [bx, 0.75, bz],
            velocity: [dirX * 6.2, 0, dirZ * 6.2],
            damage: dmg,
            life: 2.2,
            fromBoss: false,
            radius: 0.22,
          })
        }, 220)
        mob.attackCd = 1.9
      }

      // anim
      const local = worldToLocalMove(vx, vz, facing)
      const attackPhase =
        fx.attackTimer > 0 ? 1 - fx.attackTimer / fx.attackDuration : 0
      updateAnimDriver(fx.anim, dt, {
        speed: moving ? Math.hypot(vx, vz) : 0,
        localMoveX: local.x,
        localMoveZ: local.z,
        dashing: false,
        attacking: fx.attackTimer > 0,
        attackPhase,
        hitFlash: mob.hitFlash,
        casting: mob.isBoss && attackPhase > 0 && attackPhase < 0.45,
      })
      fx.anim.facing = facing
      void speed
    }

    // projectiles (runtime list may receive delayed boss/imp shots)
    const aliveProjectiles: Projectile[] = []
    for (const p of runtime.projectiles) {
      const life = p.life - dt
      if (life <= 0) continue
      const nx = p.position[0] + p.velocity[0] * dt
      const nz = p.position[2] + p.velocity[2] * dt
      if (Math.abs(nx) > ARENA_HALF || Math.abs(nz) > ARENA_HALF) continue

      if (Math.hypot(nx - px, nz - pz) < PLAYER.radius + p.radius) {
        if (playerInvuln <= 0) playerHit += p.damage
        pushVfx({
          id: uid('vfx'),
          position: [nx, 0.8, nz],
          color: '#e0a0ff',
          life: 0.2,
          maxLife: 0.2,
          scale: 0.7,
          kind: 'hit',
        })
        continue
      }

      // Projectiles die on solid props (trees/rocks/cottage)
      const hitSolid = solids.some((s) => Math.hypot(nx - s.x, nz - s.z) < s.r + p.radius * 0.6)
      if (hitSolid) {
        pushVfx({
          id: uid('vfx'),
          position: [nx, 0.7, nz],
          color: '#d0a0e8',
          life: 0.18,
          maxLife: 0.18,
          scale: 0.5,
          kind: 'hit',
        })
        continue
      }

      p.position[0] = nx
      p.position[2] = nz
      p.life = life
      aliveProjectiles.push(p)
    }
    runtime.projectiles = aliveProjectiles

    if (playerHit > 0) store.damagePlayer(playerHit)

    const aliveCount = runtime.mobs.filter((m) => m.alive).length
    const storeAlive = store.mobs.filter((m) => m.alive).length
    if (aliveCount !== storeAlive) {
      store.setMobs(runtime.mobs.map((m) => ({ ...m, position: [...m.position] as [number, number, number] })))
    }

    const boss = runtime.mobs.find((m) => m.isBoss && m.alive)
    if (boss) {
      const storeBoss = store.mobs.find((m) => m.id === boss.id)
      if (storeBoss && storeBoss.hp !== boss.hp) {
        store.setMobs(runtime.mobs.map((m) => ({ ...m, position: [...m.position] as [number, number, number] })))
      }
    }

    store.tickMeta(dt)
  })

  // Keep corpses briefly so death squash anim can play
  const visible = storeMobs.filter((m) => {
    if (m.alive) return true
    const fx = mobFx.get(m.id)
    return !!fx && fx.anim.deathPhase < 0.98
  })

  return (
    <group>
      {visible.map((m) => (
        <MobEntity key={m.id} mob={m} groupRefs={groupRefs} />
      ))}
      <ProjectileMeshes />
    </group>
  )
}

function MobEntity({
  mob,
  groupRefs,
}: {
  mob: MobState
  groupRefs: MutableRefObject<Map<string, THREE.Group>>
}) {
  const fx = useMemo(() => getMobFx(mob.id), [mob.id])

  return (
    <group
      ref={(g) => {
        if (g) groupRefs.current.set(mob.id, g)
        else groupRefs.current.delete(mob.id)
      }}
      position={mob.position}
    >
      <RiggedMob kind={mob.kind} driver={fx.anim} radius={mob.radius} />
      {mob.alive && (
        <EnemyNameplate
          mobId={mob.id}
          kind={mob.kind}
          maxHp={mob.maxHp}
          isBoss={mob.isBoss}
        />
      )}
    </group>
  )
}

function ProjectileMeshes() {
  const meshRef = useRef<THREE.Group>(null)
  const spin = useRef(0)

  useFrame((_, dt) => {
    const g = meshRef.current
    if (!g) return
    spin.current += dt * 8
    const projs = runtime.projectiles
    while (g.children.length < projs.length) {
      const m = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({
          color: '#d484f0',
          emissive: '#a040d0',
          emissiveIntensity: 0.9,
          roughness: 0.35,
        }),
      )
      g.add(m)
    }
    while (g.children.length > projs.length) {
      const c = g.children[g.children.length - 1]!
      g.remove(c)
      ;(c as THREE.Mesh).geometry?.dispose()
      const mat = (c as THREE.Mesh).material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    }
    for (let i = 0; i < projs.length; i++) {
      const p = projs[i]!
      const m = g.children[i]!
      m.position.set(p.position[0], p.position[1], p.position[2])
      m.scale.setScalar(p.radius / 0.28)
      m.rotation.x = spin.current
      m.rotation.y = spin.current * 1.3 + i
    }
  })

  return <group ref={meshRef} />
}
