import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { CAMERA } from '../game/constants'
import { runtime } from '../game/runtime'

export function CameraRig() {
  const { camera } = useThree()
  const initialized = useRef(false)
  const currentLook = useRef(new THREE.Vector3(0, 0.6, 0))

  useFrame((_, dt) => {
    const [px, , pz] = runtime.playerPos

    // Angled top-down (isometric-ish) follow
    const desired = new THREE.Vector3(px + 11, CAMERA.height, pz + 13)
    const look = new THREE.Vector3(px, 0.5, pz)

    if (!initialized.current) {
      camera.position.copy(desired)
      currentLook.current.copy(look)
      camera.lookAt(currentLook.current)
      initialized.current = true
      return
    }

    const lerp = 1 - Math.exp(-CAMERA.lerp * dt)
    camera.position.lerp(desired, lerp)
    currentLook.current.lerp(look, lerp)
    camera.lookAt(currentLook.current)
  })

  return null
}
