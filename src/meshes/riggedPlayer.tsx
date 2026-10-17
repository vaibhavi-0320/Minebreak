import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Group, Mesh } from 'three'
import { applyPlayerPose, type PlayerBones } from '../animation/playerPose'
import type { AnimDriver } from '../animation/types'
import { COLORS } from '../game/constants'

function Box({
  args,
  color,
  position,
  castShadow = true,
  metalness = 0.05,
  roughness = 0.85,
}: {
  args: [number, number, number]
  color: string
  position?: [number, number, number]
  castShadow?: boolean
  metalness?: number
  roughness?: number
}) {
  return (
    <mesh position={position} castShadow={castShadow} receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        flatShading
      />
    </mesh>
  )
}

const TRAIL_LEN = 12
const _world = new THREE.Vector3()

/**
 * Two-handed greatsword rig.
 * Weapon is body-centered; both arms are posed onto the shared hilt.
 */
export function RiggedPlayer({ driver }: { driver: AnimDriver }) {
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const head = useRef<Group>(null)
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)
  const leftLeg = useRef<Group>(null)
  const rightLeg = useRef<Group>(null)
  const weapon = useRef<Group>(null)
  const scarf = useRef<Group>(null)
  const bladeTip = useRef<Group>(null)
  const trailRef = useRef<Group>(null)
  const glowRef = useRef<Mesh>(null)

  const bones = useMemo(() => ({}) as PlayerBones, [])
  const trailHistory = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < TRAIL_LEN; i++) pts.push(new THREE.Vector3())
    return pts
  }, [])

  useFrame((_, dt) => {
    if (!root.current || !body.current) return
    bones.root = root.current
    bones.body = body.current
    bones.head = head.current!
    bones.leftArm = leftArm.current!
    bones.rightArm = rightArm.current!
    bones.leftLeg = leftLeg.current!
    bones.rightLeg = rightLeg.current!
    bones.sword = weapon.current!
    bones.scarf = scarf.current!
    bones.bladeTip = bladeTip.current
    applyPlayerPose(bones, driver, dt)

    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      const g = driver.state === 'attack' ? driver.swordTrail : 0
      mat.opacity = g * 0.5
      glowRef.current.visible = g > 0.05
      glowRef.current.scale.setScalar(1 + g * 0.4)
    }

    if (bladeTip.current && trailRef.current) {
      bladeTip.current.getWorldPosition(_world)
      const parent = trailRef.current.parent
      if (parent) parent.worldToLocal(_world)

      if (driver.swordTrail > 0.08) {
        for (let i = TRAIL_LEN - 1; i > 0; i--) trailHistory[i]!.copy(trailHistory[i - 1]!)
        trailHistory[0]!.copy(_world)
      } else {
        for (let i = 0; i < TRAIL_LEN; i++) {
          trailHistory[i]!.lerp(_world, 1 - Math.exp(-8 * dt))
        }
      }

      for (let i = 0; i < TRAIL_LEN; i++) {
        const m = trailRef.current.children[i] as Mesh | undefined
        if (!m) continue
        const t = i / (TRAIL_LEN - 1)
        const strength = driver.swordTrail * (1 - t)
        m.visible = strength > 0.04
        m.position.copy(trailHistory[i]!)
        m.scale.setScalar(0.14 + (1 - t) * 0.28 * driver.swordTrail)
        const mat = m.material as THREE.MeshBasicMaterial
        mat.opacity = strength * 0.78
      }
    }
  })

  const c = COLORS

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.48, 16]} />
        <meshBasicMaterial color="#1c241c" transparent opacity={0.28} depthWrite={false} />
      </mesh>

      <group ref={trailRef}>
        {Array.from({ length: TRAIL_LEN }).map((_, i) => (
          <mesh key={i} visible={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color={i < 3 ? '#fff4d0' : '#f0a05a'}
              transparent
              opacity={0.5}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      <group ref={root}>
        <group ref={leftLeg} position={[-0.16, 0.28, 0]}>
          <Box args={[0.22, 0.38, 0.24]} color={c.playerCloak} position={[0, 0.12, 0]} />
          <Box args={[0.24, 0.14, 0.28]} color={c.wood} position={[0, -0.1, 0.04]} />
        </group>
        <group ref={rightLeg} position={[0.16, 0.28, 0]}>
          <Box args={[0.22, 0.38, 0.24]} color={c.playerCloak} position={[0, 0.12, 0]} />
          <Box args={[0.24, 0.14, 0.28]} color={c.wood} position={[0, -0.1, 0.04]} />
        </group>

        <group ref={body} position={[0, 0.72, 0]}>
          <Box args={[0.52, 0.55, 0.38]} color={c.playerCloak} />
          <Box args={[0.28, 0.28, 0.12]} color={c.plaster} position={[0, 0.02, 0.2]} />

          <group ref={scarf} position={[0.08, 0.22, 0.18]}>
            <Box args={[0.18, 0.14, 0.2]} color={c.ember} />
            <Box args={[0.12, 0.22, 0.1]} color={c.ember} position={[0.06, -0.12, 0.02]} />
          </group>

          <group ref={head} position={[0, 0.42, 0]}>
            <Box args={[0.4, 0.4, 0.4]} color={c.playerBody} />
            <Box args={[0.08, 0.08, 0.06]} color="#1c241c" position={[-0.1, 0.04, 0.2]} castShadow={false} />
            <Box args={[0.08, 0.08, 0.06]} color="#1c241c" position={[0.1, 0.04, 0.2]} castShadow={false} />
            <Box args={[0.44, 0.16, 0.44]} color={c.playerHat} position={[0, 0.24, 0]} />
            <Box args={[0.22, 0.22, 0.22]} color={c.playerHat} position={[0, 0.4, 0]} />
          </group>

          {/* Left arm — upper hand on greatsword */}
          <group ref={leftArm} position={[-0.32, 0.1, 0.02]}>
            <Box args={[0.17, 0.34, 0.17]} color={c.playerBody} position={[0, -0.14, 0]} />
            <Box args={[0.15, 0.13, 0.15]} color={c.plaster} position={[0.02, -0.34, 0.04]} />
          </group>

          {/* Right arm — lower hand on greatsword */}
          <group ref={rightArm} position={[0.32, 0.1, 0.02]}>
            <Box args={[0.17, 0.34, 0.17]} color={c.playerBody} position={[0, -0.14, 0]} />
            <Box args={[0.15, 0.13, 0.15]} color={c.plaster} position={[-0.02, -0.34, 0.04]} />
          </group>

          {/*
            Two-handed weapon root — centered on the torso.
            Both hands are posed toward this hilt; swings rotate the whole weapon.
          */}
          <group ref={weapon} position={[0.02, -0.05, 0.22]}>
            {/* long two-hand grip */}
            <Box args={[0.1, 0.42, 0.1]} color={c.wood} position={[0, 0.05, 0]} />
            {/* grip wrap bands */}
            <Box args={[0.11, 0.08, 0.11]} color="#6a4a2a" position={[0, -0.05, 0]} castShadow={false} />
            <Box args={[0.11, 0.08, 0.11]} color="#6a4a2a" position={[0, 0.14, 0]} castShadow={false} />
            {/* pommel */}
            <Box
              args={[0.16, 0.14, 0.16]}
              color="#7a5a32"
              position={[0, -0.2, 0]}
              metalness={0.35}
              roughness={0.45}
            />
            {/* wide crossguard */}
            <Box
              args={[0.48, 0.09, 0.12]}
              color="#d4b888"
              position={[0, 0.28, 0]}
              metalness={0.5}
              roughness={0.32}
            />
            <Box
              args={[0.12, 0.12, 0.18]}
              color="#c4a878"
              position={[0, 0.28, 0]}
              metalness={0.45}
              roughness={0.35}
            />
            {/* long greatsword blade */}
            <Box
              args={[0.11, 1.15, 0.07]}
              color="#e8eef8"
              position={[0, 0.9, 0]}
              metalness={0.62}
              roughness={0.22}
            />
            {/* fuller */}
            <Box
              args={[0.04, 0.85, 0.085]}
              color="#b0bcd4"
              position={[0, 0.88, 0]}
              metalness={0.5}
              roughness={0.28}
              castShadow={false}
            />
            {/* tip */}
            <Box
              args={[0.08, 0.16, 0.05]}
              color="#f8fbff"
              position={[0, 1.52, 0]}
              metalness={0.68}
              roughness={0.18}
            />
            <group ref={bladeTip} position={[0, 1.62, 0]} />
            <mesh ref={glowRef} position={[0, 0.95, 0]} visible={false}>
              <boxGeometry args={[0.22, 1.25, 0.18]} />
              <meshBasicMaterial color="#ffe0a0" transparent opacity={0.35} depthWrite={false} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
