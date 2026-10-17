import * as THREE from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'

export type Voxel = {
  x: number
  y: number
  z: number
  color: string
  s?: number
}

/** Declarative voxel mesh — materials are owned by R3F (no shared dispose bugs). */
export function VoxelMesh({
  voxels,
  castShadow = true,
  receiveShadow = true,
  scale = 1,
}: {
  voxels: Voxel[]
  castShadow?: boolean
  receiveShadow?: boolean
  scale?: number
}) {
  return (
    <group scale={scale}>
      {voxels.map((v, i) => {
        const s = (v.s ?? 1) * 0.98
        return (
          <mesh
            key={i}
            position={[v.x, v.y, v.z]}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          >
            <boxGeometry args={[s, s, s]} />
            <meshStandardMaterial
              color={v.color}
              roughness={0.82}
              metalness={0.04}
              flatShading
            />
          </mesh>
        )
      })}
    </group>
  )
}

/** Instanced voxels for denser props (trees, cottages). */
export function InstancedVoxels({
  voxels,
  castShadow = true,
}: {
  voxels: Voxel[]
  castShadow?: boolean
}) {
  const byColor = useMemo(() => {
    const map = new Map<string, Voxel[]>()
    for (const v of voxels) {
      const list = map.get(v.color) ?? []
      list.push(v)
      map.set(v.color, list)
    }
    return [...map.entries()]
  }, [voxels])

  return (
    <group>
      {byColor.map(([color, list]) => (
        <InstancedColorVoxels key={color} color={color} voxels={list} castShadow={castShadow} />
      ))}
    </group>
  )
}

function InstancedColorVoxels({
  color,
  voxels,
  castShadow,
}: {
  color: string
  voxels: Voxel[]
  castShadow: boolean
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0.04,
        flatShading: true,
      }),
    [color],
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i]!
      const s = (v.s ?? 1) * 0.98
      dummy.position.set(v.x, v.y, v.z)
      dummy.scale.set(s, s, s)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [voxels])

  useLayoutEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, voxels.length]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
    />
  )
}

export function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
