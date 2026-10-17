import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { DirectionalLight } from 'three'
import { COLORS } from '../game/constants'

export function Lighting() {
  const sun = useRef<DirectionalLight>(null)

  useFrame(({ clock }) => {
    if (!sun.current) return
    const t = clock.elapsedTime * 0.05
    // gentle sun sway for living light
    sun.current.position.x = 12 + Math.sin(t) * 2
    sun.current.position.z = 8 + Math.cos(t * 0.7) * 2
  })

  return (
    <>
      <color attach="background" args={[COLORS.sky]} />
      <fog attach="fog" args={[COLORS.fog, 28, 58]} />

      <ambientLight intensity={0.42} color="#e8f0e4" />
      <hemisphereLight args={['#dfeef8', '#6a8a5a', 0.55]} />

      <directionalLight
        ref={sun}
        castShadow
        intensity={1.35}
        color={COLORS.sun}
        position={[14, 22, 10]}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
      />

      <directionalLight intensity={0.25} color="#a8c4e0" position={[-10, 8, -12]} />
    </>
  )
}
