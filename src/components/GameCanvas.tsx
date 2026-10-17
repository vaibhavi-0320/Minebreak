import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { KeyboardControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { CameraRig } from './CameraRig'
import { Lighting } from './Lighting'
import { Terrain } from './Terrain'
import { Player } from './Player'
import { Mobs } from './Mobs'
import { VFX } from './VFX'
import { WorldProps } from '../meshes/props'
import { useGameStore } from '../game/store'

const keyMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'back', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'attack', keys: ['Space'] },
  { name: 'dash', keys: ['ShiftLeft', 'ShiftRight'] },
]

function Scene() {
  const seed = useGameStore((s) => s.seed)
  const phase = useGameStore((s) => s.phase)

  return (
    <>
      <Lighting />
      <CameraRig />

      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]} timeStep="vary" paused={phase === 'title'}>
          <Terrain seed={seed} />
          {/* Props live inside Physics so fixed colliders register */}
          <WorldProps seed={seed} />
          {phase !== 'title' && (
            <>
              <Player />
              <Mobs />
            </>
          )}
        </Physics>
      </Suspense>

      <VFX />
    </>
  )
}

export function GameCanvas() {
  const map = useMemo(() => keyMap, [])

  return (
    <KeyboardControls map={map}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [12, 16, 14], fov: 40, near: 0.1, far: 140 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor('#b8d0dc', 1)
          gl.toneMappingExposure = 1.05
        }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </KeyboardControls>
  )
}
