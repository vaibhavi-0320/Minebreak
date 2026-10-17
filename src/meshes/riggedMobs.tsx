import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import type { Group } from 'three'
import { applyMobPose, type MobBones } from '../animation/mobPose'
import type { AnimDriver } from '../animation/types'
import { COLORS } from '../game/constants'
import type { MobKind } from '../game/types'

function Box({
  args,
  color,
  position,
  castShadow = true,
}: {
  args: [number, number, number]
  color: string
  position?: [number, number, number]
  castShadow?: boolean
}) {
  return (
    <mesh position={position} castShadow={castShadow} receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} flatShading />
    </mesh>
  )
}

export function RiggedMob({
  kind,
  driver,
  radius = 0.5,
}: {
  kind: MobKind
  driver: AnimDriver
  radius?: number
}) {
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const head = useRef<Group>(null)
  const leftLimb = useRef<Group>(null)
  const rightLimb = useRef<Group>(null)
  const extra = useRef<Group>(null)
  const flash = useRef<Group>(null)

  const bones = useMemo(() => ({}) as MobBones, [])

  useFrame(() => {
    if (!root.current || !body.current) return
    bones.root = root.current
    bones.body = body.current
    bones.head = head.current
    bones.leftLimb = leftLimb.current
    bones.rightLimb = rightLimb.current
    bones.extra = extra.current
    applyMobPose(kind, bones, driver)

    if (flash.current) {
      flash.current.visible = driver.hitFlash > 0
      flash.current.traverse((obj) => {
        const mesh = obj as unknown as {
          isMesh?: boolean
          material?: { opacity: number; transparent?: boolean }
        }
        if (mesh.isMesh && mesh.material) {
          mesh.material.transparent = true
          mesh.material.opacity = Math.min(0.7, driver.hitFlash * 4)
        }
      })
    }
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[radius * 0.95, 14]} />
        <meshBasicMaterial color="#1c241c" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      <group ref={root}>
        <group ref={body}>{renderKind(kind, head, leftLimb, rightLimb, extra)}</group>
      </group>

      <group ref={flash} visible={false}>
        <mesh position={[0, kind === 'boss' ? 1.2 : 0.5, 0]}>
          <sphereGeometry args={[kind === 'boss' ? 1.35 : 0.65, 10, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      </group>

      {/* Boss crown ring removed — HP/nameplate handles status now */}
    </group>
  )
}

function renderKind(
  kind: MobKind,
  head: RefObject<Group | null>,
  leftLimb: RefObject<Group | null>,
  rightLimb: RefObject<Group | null>,
  extra: RefObject<Group | null>,
) {
  switch (kind) {
    case 'slime':
      return (
        <>
          <Box args={[0.7, 0.45, 0.7]} color={COLORS.slime} position={[0, 0.28, 0]} />
          <group ref={head} position={[0, 0.55, 0]}>
            <Box args={[0.55, 0.4, 0.55]} color="#9ae0a4" />
            <Box args={[0.1, 0.1, 0.08]} color="#1c241c" position={[-0.14, 0.08, 0.24]} castShadow={false} />
            <Box args={[0.1, 0.1, 0.08]} color="#1c241c" position={[0.14, 0.08, 0.24]} castShadow={false} />
            <Box args={[0.14, 0.1, 0.1]} color="#e8f8ea" position={[0, -0.05, 0.26]} castShadow={false} />
          </group>
          {/* unused limbs as squash helpers */}
          <group ref={leftLimb} />
          <group ref={rightLimb} />
          <group ref={extra} />
        </>
      )
    case 'mushroom':
      return (
        <>
          <group ref={leftLimb} position={[-0.12, 0.15, 0]}>
            <Box args={[0.12, 0.28, 0.12]} color={COLORS.plaster} position={[0, 0.05, 0]} />
          </group>
          <group ref={rightLimb} position={[0.12, 0.15, 0]}>
            <Box args={[0.12, 0.28, 0.12]} color={COLORS.plaster} position={[0, 0.05, 0]} />
          </group>
          <Box args={[0.36, 0.4, 0.36]} color={COLORS.plaster} position={[0, 0.4, 0]} />
          <group ref={head} position={[0, 0.72, 0]}>
            <Box args={[0.78, 0.38, 0.78]} color={COLORS.mushroom} />
            <Box args={[0.14, 0.1, 0.1]} color="#f0d0c8" position={[0.2, 0.08, 0.15]} castShadow={false} />
            <Box args={[0.12, 0.08, 0.1]} color="#f0d0c8" position={[-0.18, 0.1, -0.1]} castShadow={false} />
          </group>
          <Box args={[0.08, 0.08, 0.06]} color="#1c241c" position={[-0.1, 0.48, 0.18]} castShadow={false} />
          <Box args={[0.08, 0.08, 0.06]} color="#1c241c" position={[0.1, 0.48, 0.18]} castShadow={false} />
          <group ref={extra} />
        </>
      )
    case 'imp':
      return (
        <>
          <Box args={[0.38, 0.42, 0.32]} color={COLORS.imp} position={[0, 0.45, 0]} />
          <group ref={head} position={[0, 0.78, 0]}>
            <Box args={[0.4, 0.36, 0.36]} color="#b48ad0" />
            <Box args={[0.08, 0.08, 0.06]} color="#f4c56d" position={[-0.1, 0.04, 0.18]} castShadow={false} />
            <Box args={[0.08, 0.08, 0.06]} color="#f4c56d" position={[0.1, 0.04, 0.18]} castShadow={false} />
            {/* horns */}
            <Box args={[0.1, 0.2, 0.1]} color={COLORS.imp} position={[-0.16, 0.22, 0]} />
            <Box args={[0.1, 0.2, 0.1]} color={COLORS.imp} position={[0.16, 0.22, 0]} />
          </group>
          <group ref={leftLimb} position={[-0.22, 0.55, -0.05]}>
            <Box args={[0.14, 0.08, 0.36]} color={COLORS.imp} position={[-0.12, 0, -0.1]} />
          </group>
          <group ref={rightLimb} position={[0.22, 0.55, -0.05]}>
            <Box args={[0.14, 0.08, 0.36]} color="#b48ad0" position={[0.12, 0, -0.1]} />
          </group>
          <Box args={[0.22, 0.18, 0.22]} color="#6b4a8a" position={[0, 0.18, 0]} />
          <group ref={extra} />
        </>
      )
    case 'beetle':
      return (
        <>
          <Box args={[0.72, 0.32, 0.55]} color={COLORS.beetle} position={[0, 0.28, 0]} />
          <group ref={head} position={[0, 0.38, 0.28]}>
            <Box args={[0.4, 0.28, 0.32]} color="#7a9aaa" />
            <Box args={[0.08, 0.08, 0.06]} color="#f4c56d" position={[-0.1, 0.06, 0.14]} castShadow={false} />
            <Box args={[0.08, 0.08, 0.06]} color="#f4c56d" position={[0.1, 0.06, 0.14]} castShadow={false} />
          </group>
          <group ref={leftLimb} position={[-0.32, 0.18, 0]}>
            <Box args={[0.12, 0.1, 0.12]} color="#3a4a52" position={[0, 0, 0.18]} />
            <Box args={[0.12, 0.1, 0.12]} color="#3a4a52" position={[0, 0, -0.18]} />
          </group>
          <group ref={rightLimb} position={[0.32, 0.18, 0]}>
            <Box args={[0.12, 0.1, 0.12]} color="#3a4a52" position={[0, 0, 0.18]} />
            <Box args={[0.12, 0.1, 0.12]} color="#3a4a52" position={[0, 0, -0.18]} />
          </group>
          <group ref={extra} position={[0, 0.42, -0.05]}>
            <Box args={[0.5, 0.12, 0.4]} color="#5a7a8a" />
          </group>
        </>
      )
    case 'boss':
      return (
        <>
          <Box args={[1.35, 1.1, 1.0]} color={COLORS.boss} position={[0, 0.75, 0]} />
          <Box args={[1.1, 0.9, 0.9]} color="#8a4aa0" position={[0, 1.45, 0]} />
          <group ref={head} position={[0, 2.0, 0.1]}>
            <Box args={[0.85, 0.7, 0.75]} color="#8a4aa0" />
            <Box args={[0.18, 0.14, 0.1]} color="#ff6a4a" position={[-0.22, 0.08, 0.38]} castShadow={false} />
            <Box args={[0.18, 0.14, 0.1]} color="#ff6a4a" position={[0.22, 0.08, 0.38]} castShadow={false} />
          </group>
          <group ref={extra} position={[0, 2.35, 0]}>
            <Box args={[0.7, 0.35, 0.7]} color={COLORS.bossAccent} />
            <Box args={[0.22, 0.28, 0.22]} color={COLORS.ember} position={[-0.35, 0.25, 0]} />
            <Box args={[0.22, 0.28, 0.22]} color={COLORS.ember} position={[0.35, 0.25, 0]} />
            <Box args={[0.28, 0.28, 0.28]} color={COLORS.gold} position={[0, 0.35, 0]} />
          </group>
          <group ref={leftLimb} position={[-0.85, 1.15, 0.15]}>
            <Box args={[0.5, 0.9, 0.45]} color="#5a2a6a" position={[0, -0.2, 0]} />
            <Box args={[0.35, 0.35, 0.35]} color={COLORS.stone} position={[0, 0.35, 0]} />
          </group>
          <group ref={rightLimb} position={[0.85, 1.15, 0.15]}>
            <Box args={[0.5, 0.9, 0.45]} color="#5a2a6a" position={[0, -0.2, 0]} />
            <Box args={[0.35, 0.35, 0.35]} color={COLORS.stone} position={[0, 0.35, 0]} />
          </group>
        </>
      )
  }
}
