import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MOB_BAR_WIDTH, MOB_LABEL_HEIGHT, MOB_NAMES } from '../game/mobMeta'
import { runtime } from '../game/runtime'
import type { MobKind } from '../game/types'

/** Same typeface as the 2D HUD (Pixelify Sans) */
const HUD_FONT = '/fonts/PixelifySans.ttf'

/**
 * World-space name + HP bar that billboards toward the camera.
 * Reads live HP from runtime so it stays accurate without store thrash.
 */
export function EnemyNameplate({
  mobId,
  kind,
  maxHp,
  isBoss,
}: {
  mobId: string
  kind: MobKind
  maxHp: number
  isBoss: boolean
}) {
  const fillRef = useRef<THREE.Mesh>(null)
  const rootRef = useRef<THREE.Group>(null)
  const name = MOB_NAMES[kind]
  const height = MOB_LABEL_HEIGHT[kind]
  const barW = MOB_BAR_WIDTH[kind]
  const barH = isBoss ? 0.14 : 0.1

  const bgMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#1c241c',
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
    [],
  )
  const fillMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: isBoss ? '#c45c9a' : '#c45c4a',
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    [isBoss],
  )
  const borderMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: isBoss ? '#f4c56d' : '#3a4a3c',
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    [isBoss],
  )

  useFrame(() => {
    const mob = runtime.mobs.find((m) => m.id === mobId)
    if (!mob || !fillRef.current) {
      if (rootRef.current) rootRef.current.visible = false
      return
    }
    if (rootRef.current) rootRef.current.visible = mob.alive || mob.hp > 0

    const ratio = Math.max(0, Math.min(1, mob.hp / Math.max(1, maxHp)))
    // Scale fill from left: position so left edge stays fixed
    fillRef.current.scale.x = Math.max(0.001, ratio)
    fillRef.current.position.x = -barW * 0.5 + (barW * ratio) * 0.5

    // Tint: green-ish when healthy for normal mobs
    if (!isBoss) {
      const mat = fillRef.current.material as THREE.MeshBasicMaterial
      if (ratio > 0.5) mat.color.set('#6fbf8a')
      else if (ratio > 0.25) mat.color.set('#e07a3a')
      else mat.color.set('#c45c4a')
    }

    // Hide plate when full HP and far? Keep always on for clarity as requested.
    // Slight bob is handled by parent animation; plate is billboarded.
  })

  return (
    <group ref={rootRef} position={[0, height, 0]}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* Name */}
        <Text
          position={[0, barH * 0.5 + 0.18, 0]}
          font={HUD_FONT}
          fontSize={isBoss ? 0.2 : 0.15}
          letterSpacing={0.04}
          color={isBoss ? '#f4c56d' : '#f7f0e4'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.018}
          outlineColor="#1c241c"
          maxWidth={2.6}
        >
          {name}
        </Text>

        {/* Bar border (slightly larger) */}
        <mesh position={[0, 0, -0.01]} material={borderMat}>
          <planeGeometry args={[barW + 0.06, barH + 0.05]} />
        </mesh>
        {/* Bar background */}
        <mesh position={[0, 0, 0]} material={bgMat}>
          <planeGeometry args={[barW, barH]} />
        </mesh>
        {/* HP fill — scaled from left */}
        <mesh
          ref={fillRef}
          position={[0, 0, 0.01]}
          material={fillMat}
        >
          <planeGeometry args={[barW, barH * 0.85]} />
        </mesh>
      </Billboard>
    </group>
  )
}
