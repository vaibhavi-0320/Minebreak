import { useMemo } from 'react'
import { COLORS } from '../game/constants'
import type { MobKind } from '../game/types'
import { VoxelMesh, type Voxel } from './voxel'

export function buildPlayerVoxels(): Voxel[] {
  const c = COLORS
  return [
    // boots
    { x: -0.25, y: 0.15, z: 0.05, color: c.wood, s: 0.28 },
    { x: 0.25, y: 0.15, z: 0.05, color: c.wood, s: 0.28 },
    // legs
    { x: -0.22, y: 0.4, z: 0, color: c.playerCloak, s: 0.28 },
    { x: 0.22, y: 0.4, z: 0, color: c.playerCloak, s: 0.28 },
    // body
    { x: 0, y: 0.75, z: 0, color: c.playerCloak, s: 0.55 },
    { x: 0, y: 0.75, z: 0.22, color: c.plaster, s: 0.28 },
    // arms
    { x: -0.45, y: 0.72, z: 0.05, color: c.playerBody, s: 0.24 },
    { x: 0.45, y: 0.72, z: 0.05, color: c.playerBody, s: 0.24 },
    // head
    { x: 0, y: 1.2, z: 0, color: c.playerBody, s: 0.42 },
    // hat
    { x: 0, y: 1.48, z: 0, color: c.playerHat, s: 0.38 },
    { x: 0, y: 1.65, z: 0, color: c.playerHat, s: 0.22 },
    // scarf
    { x: 0.1, y: 1.0, z: 0.2, color: c.ember, s: 0.18 },
  ]
}

export function buildMobVoxels(kind: MobKind): Voxel[] {
  switch (kind) {
    case 'slime':
      return [
        { x: 0, y: 0.25, z: 0, color: COLORS.slime, s: 0.7 },
        { x: 0, y: 0.55, z: 0, color: '#9ae0a4', s: 0.55 },
        { x: -0.15, y: 0.62, z: 0.22, color: '#1c241c', s: 0.12 },
        { x: 0.15, y: 0.62, z: 0.22, color: '#1c241c', s: 0.12 },
        { x: 0, y: 0.35, z: 0.28, color: '#e8f8ea', s: 0.16 },
      ]
    case 'mushroom':
      return [
        { x: 0, y: 0.35, z: 0, color: COLORS.plaster, s: 0.4 },
        { x: 0, y: 0.7, z: 0, color: COLORS.mushroom, s: 0.75 },
        { x: 0.2, y: 0.75, z: 0.15, color: '#f0d0c8', s: 0.16 },
        { x: -0.18, y: 0.78, z: -0.1, color: '#f0d0c8', s: 0.14 },
        { x: -0.12, y: 0.45, z: 0.18, color: '#1c241c', s: 0.1 },
        { x: 0.12, y: 0.45, z: 0.18, color: '#1c241c', s: 0.1 },
      ]
    case 'imp':
      return [
        { x: 0, y: 0.35, z: 0, color: COLORS.imp, s: 0.4 },
        { x: 0, y: 0.7, z: 0, color: '#b48ad0', s: 0.42 },
        { x: -0.28, y: 0.95, z: 0, color: COLORS.imp, s: 0.16 },
        { x: 0.28, y: 0.95, z: 0, color: COLORS.imp, s: 0.16 },
        { x: -0.1, y: 0.78, z: 0.18, color: '#f4c56d', s: 0.1 },
        { x: 0.1, y: 0.78, z: 0.18, color: '#f4c56d', s: 0.1 },
        { x: 0, y: 0.2, z: 0, color: '#6b4a8a', s: 0.28 },
      ]
    case 'beetle':
      return [
        { x: 0, y: 0.28, z: 0, color: COLORS.beetle, s: 0.7 },
        { x: 0, y: 0.45, z: 0.15, color: '#7a9aaa', s: 0.45 },
        { x: -0.35, y: 0.2, z: 0.2, color: '#3a4a52', s: 0.14 },
        { x: 0.35, y: 0.2, z: 0.2, color: '#3a4a52', s: 0.14 },
        { x: -0.35, y: 0.2, z: -0.2, color: '#3a4a52', s: 0.14 },
        { x: 0.35, y: 0.2, z: -0.2, color: '#3a4a52', s: 0.14 },
        { x: -0.12, y: 0.48, z: 0.35, color: '#f4c56d', s: 0.1 },
        { x: 0.12, y: 0.48, z: 0.35, color: '#f4c56d', s: 0.1 },
      ]
    case 'boss':
      return [
        // body
        { x: 0, y: 0.7, z: 0, color: COLORS.boss, s: 1.4 },
        { x: 0, y: 1.4, z: 0, color: '#8a4aa0', s: 1.1 },
        // crown
        { x: 0, y: 2.05, z: 0, color: COLORS.bossAccent, s: 0.7 },
        { x: -0.45, y: 2.25, z: 0, color: COLORS.ember, s: 0.28 },
        { x: 0.45, y: 2.25, z: 0, color: COLORS.ember, s: 0.28 },
        { x: 0, y: 2.4, z: 0, color: '#f4c56d', s: 0.32 },
        // arms
        { x: -1.0, y: 1.1, z: 0.2, color: '#5a2a6a', s: 0.55 },
        { x: 1.0, y: 1.1, z: 0.2, color: '#5a2a6a', s: 0.55 },
        // eyes
        { x: -0.28, y: 1.55, z: 0.5, color: '#ff6a4a', s: 0.22 },
        { x: 0.28, y: 1.55, z: 0.5, color: '#ff6a4a', s: 0.22 },
        // shoulders
        { x: -0.7, y: 1.65, z: 0, color: COLORS.stone, s: 0.4 },
        { x: 0.7, y: 1.65, z: 0, color: COLORS.stone, s: 0.4 },
      ]
  }
}

export function PlayerMesh({ attackSwing = 0 }: { attackSwing?: number }) {
  const voxels = useMemo(() => buildPlayerVoxels(), [])
  return (
    <group>
      <VoxelMesh voxels={voxels} />
      {/* sword */}
      <group
        position={[0.55, 0.85, 0.15]}
        rotation={[0, 0, -0.4 - attackSwing * 1.6]}
      >
        <mesh castShadow position={[0, 0.35, 0]}>
          <boxGeometry args={[0.12, 0.85, 0.12]} />
          <meshStandardMaterial color="#d8dde8" roughness={0.35} metalness={0.55} flatShading />
        </mesh>
        <mesh castShadow position={[0, -0.05, 0]}>
          <boxGeometry args={[0.28, 0.12, 0.12]} />
          <meshStandardMaterial color="#a0674a" roughness={0.8} flatShading />
        </mesh>
      </group>
    </group>
  )
}

export function MobMesh({ kind, flash = 0 }: { kind: MobKind; flash?: number }) {
  const voxels = useMemo(() => buildMobVoxels(kind), [kind])
  const scale = kind === 'boss' ? 1 : 1
  return (
    <group scale={scale}>
      <VoxelMesh voxels={voxels} />
      {flash > 0 && (
        <mesh position={[0, kind === 'boss' ? 1.2 : 0.5, 0]}>
          <sphereGeometry args={[kind === 'boss' ? 1.4 : 0.7, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={flash * 2} />
        </mesh>
      )}
    </group>
  )
}
