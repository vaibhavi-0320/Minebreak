import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RiggedPlayer } from '../../meshes/riggedPlayer'
import { createAnimDriver } from '../../animation/types'
import { updateAnimDriver } from '../../animation/locomotion'
import type { Phase } from '../types'

interface DuelArena3DProps {
  phase: Phase
  infiltratorCommitted: boolean
  defenderCommitted: boolean
  lastResult: number // 1: inf won, 2: def won, 3: draw
  infiltratorScore: number
  defenderScore: number
}

function VoxelArenaFloor() {
  return (
    <group position={[0, -0.2, 0]}>
      {/* Stone platform */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[5.5, 6.0, 0.4, 16]} />
        <meshStandardMaterial color="#2d3748" roughness={0.9} flatShading />
      </mesh>
      {/* Outer border ring */}
      <mesh receiveShadow position={[0, 0.05, 0]}>
        <ringGeometry args={[5.0, 5.5, 16]} />
        <meshStandardMaterial color="#4a5568" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* Central duel rune */}
      <mesh receiveShadow position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.8, 8]} />
        <meshStandardMaterial color="#d69e2e" emissive="#d69e2e" emissiveIntensity={0.2} />
      </mesh>
      {/* Pillars / Lanterns at 4 points */}
      {[
        [-4.5, 0.6, -2.5],
        [4.5, 0.6, -2.5],
        [-4.5, 0.6, 2.5],
        [4.5, 0.6, 2.5],
      ].map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh castShadow position={[0, 0, 0]}>
            <boxGeometry args={[0.5, 1.2, 0.5]} />
            <meshStandardMaterial color="#1a202c" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.7, 0]}>
            <boxGeometry args={[0.3, 0.3, 0.3]} />
            <meshStandardMaterial color="#f6ad55" emissive="#dd6b20" emissiveIntensity={1.2} />
          </mesh>
          <pointLight position={[0, 0.8, 0]} intensity={1.5} distance={6} color="#ed8936" />
        </group>
      ))}
    </group>
  )
}

function CommitmentAura({ active, color }: { active: boolean; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 1.5
    }
  })

  if (!active) return null

  return (
    <mesh ref={meshRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.1, 1.3, 16]} />
      <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.6} />
    </mesh>
  )
}

function InfiltratorFighter({
  committed,
  lastResult,
}: {
  committed: boolean
  lastResult: number
}) {
  const driver = useMemo(() => {
    const d = createAnimDriver()
    d.facing = Math.PI / 2
    return d
  }, [])

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime()
    const attacking = lastResult === 1
    const attackPhase = attacking ? (time % 1.0) : 0
    const hitFlash = lastResult === 2 ? 0.3 : 0

    updateAnimDriver(driver, delta, {
      speed: 0,
      localMoveX: 0,
      localMoveZ: 0,
      dashing: false,
      attacking,
      attackPhase,
      hitFlash,
    })
    driver.facing = Math.PI / 2
  })

  return (
    <group position={[-2.4, 0, 0]}>
      <CommitmentAura active={committed} color="#f0883e" />
      <RiggedPlayer driver={driver} />
    </group>
  )
}

function DefenderFighter({
  committed,
  lastResult,
}: {
  committed: boolean
  lastResult: number
}) {
  const driver = useMemo(() => {
    const d = createAnimDriver()
    d.facing = -Math.PI / 2
    return d
  }, [])

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime()
    const attacking = lastResult === 2
    const attackPhase = attacking ? (time % 1.0) : 0
    const hitFlash = lastResult === 1 ? 0.3 : 0

    updateAnimDriver(driver, delta, {
      speed: 0,
      localMoveX: 0,
      localMoveZ: 0,
      dashing: false,
      attacking,
      attackPhase,
      hitFlash,
    })
    driver.facing = -Math.PI / 2
  })

  return (
    <group position={[2.4, 0, 0]}>
      <CommitmentAura active={committed} color="#58a6ff" />
      <RiggedPlayer driver={driver} />
    </group>
  )
}

export function DuelArena3D(props: DuelArena3DProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '280px',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 50%, #1a2233 0%, #0d121d 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '16px',
          zIndex: 10,
          fontSize: '11px',
          color: '#f0883e',
          fontWeight: 700,
          background: 'rgba(0,0,0,0.5)',
          padding: '4px 8px',
          borderRadius: '4px',
        }}
      >
        ⚔️ INFILTRATOR ({props.infiltratorScore} PTS)
      </div>

      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '16px',
          zIndex: 10,
          fontSize: '11px',
          color: '#58a6ff',
          fontWeight: 700,
          background: 'rgba(0,0,0,0.5)',
          padding: '4px 8px',
          borderRadius: '4px',
        }}
      >
        🛡️ DEFENDER ({props.defenderScore} PTS)
      </div>

      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 5, 8], fov: 38 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[6, 12, 6]} intensity={1.2} castShadow />
        <pointLight position={[0, 4, 0]} intensity={0.8} color="#e2e8f0" />

        <Suspense fallback={null}>
          <VoxelArenaFloor />
          <InfiltratorFighter
            committed={props.infiltratorCommitted}
            lastResult={props.lastResult}
          />
          <DefenderFighter
            committed={props.defenderCommitted}
            lastResult={props.lastResult}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
