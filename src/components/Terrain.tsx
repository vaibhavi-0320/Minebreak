import { useMemo } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { ARENA_HALF, ARENA_SIZE, COLORS } from '../game/constants'
import { mulberry32 } from '../meshes/voxel'

/** Chunky canvas grass — nearest filtering so it reads as voxels with the props. */
function createGrassTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = COLORS.grass
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const shade = Math.random()
    ctx.fillStyle =
      shade > 0.66 ? COLORS.grassDark : shade > 0.33 ? '#6a9a64' : '#78a872'
    ctx.fillRect(x, y, 2 + Math.random() * 2, 2 + Math.random() * 2)
  }
  // soft path ring baked into the atlas
  ctx.strokeStyle = COLORS.path
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.22, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = '#d4b888'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.22, 0, Math.PI * 2)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(6, 6)
  tex.colorSpace = THREE.SRGBColorSpace
  // Nearest = blocky tiles that match voxel props (no blurry mips)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

export function Terrain({ seed }: { seed: number }) {
  const texture = useMemo(() => createGrassTexture(), [])
  const patches = useMemo(() => {
    const rng = mulberry32(seed ^ 0xabc)
    const list: { pos: [number, number, number]; color: string; scale: number }[] = []
    for (let i = 0; i < 50; i++) {
      const x = (rng() - 0.5) * (ARENA_SIZE - 4)
      const z = (rng() - 0.5) * (ARENA_SIZE - 4)
      list.push({
        pos: [x, 0.02, z],
        color: rng() > 0.5 ? '#6fa86a' : '#5a9058',
        scale: 0.8 + rng() * 1.6,
      })
    }
    return list
  }, [seed])

  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[0, -0.25, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0.25, 0]}>
          <planeGeometry args={[ARENA_SIZE + 8, ARENA_SIZE + 8]} />
          <meshStandardMaterial
            map={texture}
            color="#ffffff"
            roughness={0.95}
            metalness={0}
          />
        </mesh>
        <CuboidCollider args={[ARENA_HALF + 4, 0.25, ARENA_HALF + 4]} />
      </RigidBody>

      {/* soft dirt ring path (on top of atlas ring) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <ringGeometry args={[5.2, 6.4, 48]} />
        <meshStandardMaterial color={COLORS.path} roughness={1} />
      </mesh>

      {/* water pond */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[9, 0.04, -11]} receiveShadow>
        <circleGeometry args={[2.4, 24]} />
        <meshStandardMaterial
          color={COLORS.water}
          roughness={0.25}
          metalness={0.15}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[9, 0.05, -11]}>
        <circleGeometry args={[1.6, 20]} />
        <meshStandardMaterial color="#8ec4d0" roughness={0.2} transparent opacity={0.55} />
      </mesh>

      {patches.map((p, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={p.pos} receiveShadow>
          <circleGeometry args={[p.scale, 8]} />
          <meshStandardMaterial color={p.color} roughness={1} />
        </mesh>
      ))}

      {/* arena soft walls (invisible colliders) */}
      <RigidBody type="fixed" colliders={false} position={[0, 1, 0]}>
        <CuboidCollider args={[0.4, 2, ARENA_HALF + 2]} position={[ARENA_HALF + 0.5, 0, 0]} />
        <CuboidCollider args={[0.4, 2, ARENA_HALF + 2]} position={[-(ARENA_HALF + 0.5), 0, 0]} />
        <CuboidCollider args={[ARENA_HALF + 2, 2, 0.4]} position={[0, 0, ARENA_HALF + 0.5]} />
        <CuboidCollider args={[ARENA_HALF + 2, 2, 0.4]} position={[0, 0, -(ARENA_HALF + 0.5)]} />
      </RigidBody>

      {/* decorative border hedges */}
      {Array.from({ length: 32 }).map((_, i) => {
        const t = (i / 32) * Math.PI * 2
        const r = ARENA_HALF + 0.2
        return (
          <mesh
            key={`hedge-${i}`}
            position={[Math.cos(t) * r, 0.45, Math.sin(t) * r]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1.1, 0.9, 1.1]} />
            <meshStandardMaterial color={COLORS.leaf} roughness={0.9} flatShading />
          </mesh>
        )
      })}
    </group>
  )
}
