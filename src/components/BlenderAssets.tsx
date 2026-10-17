import { useGLTF } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'

/**
 * Loads Blender-baked hero props (bpy procedural pipeline).
 * Falls back silently if a GLB is missing — WorldProps still renders runtime voxels.
 */
const HERO_ASSETS = [
  { url: '/assets/models/ember_prop_shrine_00.glb', position: [0, 0, -8] as [number, number, number], scale: 1 },
  { url: '/assets/models/ember_prop_cottage_00.glb', position: [-12, 0, -10] as [number, number, number], scale: 1 },
] as const

function GlbProp({
  url,
  position,
  scale,
}: {
  url: string
  position: [number, number, number]
  scale: number
}) {
  const { scene } = useGLTF(url)
  const clone = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const m of mats) {
            const std = m as THREE.MeshStandardMaterial
            if ('flatShading' in std) std.flatShading = true
            std.needsUpdate = true
          }
        }
      }
    })
    return c
  }, [scene])

  return <primitive object={clone} position={position} scale={scale} />
}

export function BlenderAssets() {
  return (
    <Suspense
      fallback={
        <group>
          {/* soft glow while GLBs load */}
          <pointLight position={[0, 2.3, -8]} intensity={0.8} distance={8} color="#f0a05a" />
        </group>
      }
    >
      <group>
        {HERO_ASSETS.map((a) => (
          <GlbProp key={a.url} url={a.url} position={a.position} scale={a.scale} />
        ))}
        <pointLight position={[0, 2.3, -8]} intensity={1.1} distance={8} color="#f0a05a" />
        <pointLight position={[-12, 1.2, -8.6]} intensity={0.45} distance={4} color="#f4c56d" />
      </group>
    </Suspense>
  )
}

// Preload for snappy title scene
HERO_ASSETS.forEach((a) => useGLTF.preload(a.url))
