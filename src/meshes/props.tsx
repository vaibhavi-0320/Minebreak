import { useMemo } from 'react'
import { RigidBody, CylinderCollider, CuboidCollider } from '@react-three/rapier'
import { COLORS } from '../game/constants'
import { InstancedVoxels, mulberry32, type Voxel } from './voxel'

export function buildTree(seed: number, tall = false): Voxel[] {
  const rng = mulberry32(seed)
  const voxels: Voxel[] = []
  const trunkH = tall ? 4 : 3
  for (let y = 0; y < trunkH; y++) {
    voxels.push({ x: 0, y: y * 0.45 + 0.25, z: 0, color: COLORS.wood, s: 0.45 })
  }
  const crownY = trunkH * 0.45
  const layers = tall ? 4 : 3
  for (let i = 0; i < layers; i++) {
    const r = (layers - i) * 0.55 + 0.2
    const y = crownY + i * 0.45
    const count = 6 + Math.floor(rng() * 4)
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + rng() * 0.3
      const d = r * (0.4 + rng() * 0.6)
      voxels.push({
        x: Math.cos(a) * d,
        y,
        z: Math.sin(a) * d,
        color: rng() > 0.3 ? COLORS.leaf : '#5f9a58',
        s: 0.55 + rng() * 0.25,
      })
    }
    voxels.push({ x: 0, y: y + 0.15, z: 0, color: '#7cb87a', s: 0.7 })
  }
  return voxels
}

export function buildRock(seed: number): Voxel[] {
  const rng = mulberry32(seed)
  const voxels: Voxel[] = []
  const n = 4 + Math.floor(rng() * 4)
  for (let i = 0; i < n; i++) {
    voxels.push({
      x: (rng() - 0.5) * 0.8,
      y: 0.2 + rng() * 0.35,
      z: (rng() - 0.5) * 0.8,
      color: rng() > 0.5 ? COLORS.stone : '#7a8078',
      s: 0.35 + rng() * 0.4,
    })
  }
  return voxels
}

export function buildFlower(seed: number): Voxel[] {
  const rng = mulberry32(seed)
  const petal = rng() > 0.5 ? COLORS.flowerPink : COLORS.flowerYellow
  return [
    { x: 0, y: 0.15, z: 0, color: COLORS.leaf, s: 0.12 },
    { x: 0, y: 0.32, z: 0, color: COLORS.leaf, s: 0.1 },
    { x: 0, y: 0.45, z: 0, color: petal, s: 0.22 },
    { x: 0.12, y: 0.45, z: 0, color: petal, s: 0.14 },
    { x: -0.12, y: 0.45, z: 0, color: petal, s: 0.14 },
    { x: 0, y: 0.45, z: 0.12, color: petal, s: 0.14 },
    { x: 0, y: 0.52, z: 0, color: '#f4c56d', s: 0.1 },
  ]
}

export function buildCottage(): Voxel[] {
  const voxels: Voxel[] = []
  // walls
  for (let x = -2; x <= 2; x++) {
    for (let y = 0; y <= 2; y++) {
      for (let z = -2; z <= 2; z++) {
        const edge = x === -2 || x === 2 || z === -2 || z === 2 || y === 0
        if (!edge) continue
        // door hole
        if (z === 2 && x === 0 && (y === 0 || y === 1)) continue
        voxels.push({
          x: x * 0.55,
          y: y * 0.55 + 0.3,
          z: z * 0.55,
          color: y === 0 ? COLORS.stone : COLORS.plaster,
          s: 0.55,
        })
      }
    }
  }
  // roof
  for (let x = -2.5; x <= 2.5; x += 0.5) {
    for (let z = -2.5; z <= 2.5; z += 0.5) {
      const h = 1.7 - Math.abs(x) * 0.35
      voxels.push({ x: x * 0.55, y: h + 1.1, z: z * 0.55, color: COLORS.roof, s: 0.5 })
    }
  }
  // chimney
  for (let y = 0; y < 3; y++) {
    voxels.push({ x: 0.9, y: 2.2 + y * 0.4, z: -0.6, color: COLORS.stone, s: 0.4 })
  }
  // window glow
  voxels.push({ x: -0.9, y: 1.0, z: 1.15, color: '#f4c56d', s: 0.35 })
  voxels.push({ x: 0.9, y: 1.0, z: 1.15, color: '#f4c56d', s: 0.35 })
  return voxels
}

export function buildLantern(): Voxel[] {
  return [
    { x: 0, y: 0.2, z: 0, color: COLORS.wood, s: 0.2 },
    { x: 0, y: 0.55, z: 0, color: COLORS.wood, s: 0.16 },
    { x: 0, y: 0.95, z: 0, color: COLORS.stone, s: 0.35 },
    { x: 0, y: 0.95, z: 0, color: '#f4c56d', s: 0.22 },
    { x: 0, y: 1.2, z: 0, color: COLORS.wood, s: 0.28 },
  ]
}

export function buildFenceSegment(): Voxel[] {
  return [
    { x: -0.4, y: 0.25, z: 0, color: COLORS.wood, s: 0.18 },
    { x: 0.4, y: 0.25, z: 0, color: COLORS.wood, s: 0.18 },
    { x: 0, y: 0.45, z: 0, color: '#8a5a3a', s: 0.7 },
    { x: 0, y: 0.75, z: 0, color: '#8a5a3a', s: 0.7 },
  ]
}

export function buildMushroomProp(seed: number): Voxel[] {
  const rng = mulberry32(seed)
  const cap = rng() > 0.5 ? COLORS.mushroom : '#e8a05a'
  return [
    { x: 0, y: 0.2, z: 0, color: COLORS.plaster, s: 0.22 },
    { x: 0, y: 0.4, z: 0, color: cap, s: 0.45 },
    { x: 0.12, y: 0.42, z: 0.08, color: '#f5ddd4', s: 0.1 },
  ]
}

export function buildShrine(): Voxel[] {
  const voxels: Voxel[] = []
  for (let y = 0; y < 4; y++) {
    voxels.push({ x: 0, y: 0.3 + y * 0.45, z: 0, color: COLORS.stone, s: 0.55 })
  }
  voxels.push({ x: 0, y: 2.1, z: 0, color: COLORS.gold, s: 0.5 })
  voxels.push({ x: 0, y: 2.45, z: 0, color: COLORS.ember, s: 0.28 })
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    voxels.push({
      x: Math.cos(a) * 1.1,
      y: 0.2,
      z: Math.sin(a) * 1.1,
      color: '#7a8078',
      s: 0.35,
    })
  }
  return voxels
}

type PropInstance = {
  kind: 'tree' | 'rock' | 'flower' | 'lantern' | 'fence' | 'mushroom' | 'cottage' | 'shrine'
  position: [number, number, number]
  rotation?: number
  seed: number
  tall?: boolean
}

export function buildHandcraftedLayout(seed: number): PropInstance[] {
  const rng = mulberry32(seed)
  const props: PropInstance[] = []

  // hero landmarks
  props.push({ kind: 'shrine', position: [0, 0, -8], seed: 1 })
  props.push({ kind: 'cottage', position: [-12, 0, -10], seed: 2 })

  // ring of trees
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    const r = 16 + rng() * 3
    props.push({
      kind: 'tree',
      position: [Math.cos(a) * r, 0, Math.sin(a) * r],
      seed: 100 + i,
      tall: rng() > 0.6,
    })
  }

  // grove clusters
  const clusters = [
    [8, 6],
    [-9, 8],
    [11, -4],
    [-7, -14],
    [4, 12],
  ] as const
  clusters.forEach(([cx, cz], ci) => {
    for (let i = 0; i < 4; i++) {
      props.push({
        kind: 'tree',
        position: [cx + (rng() - 0.5) * 4, 0, cz + (rng() - 0.5) * 4],
        seed: 200 + ci * 10 + i,
        tall: i % 2 === 0,
      })
    }
  })

  // rocks
  for (let i = 0; i < 20; i++) {
    const a = rng() * Math.PI * 2
    const r = 4 + rng() * 14
    props.push({
      kind: 'rock',
      position: [Math.cos(a) * r, 0, Math.sin(a) * r],
      seed: 300 + i,
    })
  }

  // flowers near path
  for (let i = 0; i < 40; i++) {
    const a = rng() * Math.PI * 2
    const r = 2 + rng() * 10
    props.push({
      kind: 'flower',
      position: [Math.cos(a) * r, 0, Math.sin(a) * r],
      seed: 400 + i,
    })
  }

  // lanterns
  const lanternSpots = [
    [4, 4],
    [-4, 4],
    [4, -4],
    [-4, -4],
    [0, 10],
    [-10, 0],
    [10, 0],
  ] as const
  lanternSpots.forEach(([x, z], i) => {
    props.push({ kind: 'lantern', position: [x, 0, z], seed: 500 + i })
  })

  // fence arc near cottage
  for (let i = 0; i < 8; i++) {
    props.push({
      kind: 'fence',
      position: [-12 + i * 0.9, 0, -6.5],
      seed: 600 + i,
      rotation: 0,
    })
  }

  // mushrooms
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2
    const r = 6 + rng() * 10
    props.push({
      kind: 'mushroom',
      position: [Math.cos(a) * r, 0, Math.sin(a) * r],
      seed: 700 + i,
    })
  }

  return props
}

export function WorldProps({ seed }: { seed: number }) {
  const layout = useMemo(() => buildHandcraftedLayout(seed), [seed])

  return (
    <group>
      {layout.map((p, i) => (
        <PropMesh key={i} prop={p} />
      ))}
    </group>
  )
}

/** Rapier fixed colliders for major solids (kinematic player still uses soft resolve). */
function PropCollider({ kind }: { kind: PropInstance['kind'] }) {
  switch (kind) {
    case 'tree':
      return <CylinderCollider args={[1.2, 0.55]} position={[0, 1.2, 0]} />
    case 'rock':
      return <CylinderCollider args={[0.35, 0.45]} position={[0, 0.35, 0]} />
    case 'lantern':
      return <CylinderCollider args={[0.55, 0.25]} position={[0, 0.55, 0]} />
    case 'fence':
      return <CuboidCollider args={[0.55, 0.45, 0.18]} position={[0, 0.45, 0]} />
    case 'mushroom':
      return <CylinderCollider args={[0.25, 0.26]} position={[0, 0.25, 0]} />
    case 'shrine':
      return <CylinderCollider args={[1.1, 0.8]} position={[0, 1.1, 0]} />
    case 'cottage':
      return <CuboidCollider args={[1.5, 1.2, 1.5]} position={[0, 1.2, 0]} />
    default:
      return null
  }
}

function PropMesh({ prop }: { prop: PropInstance }) {
  const voxels = useMemo(() => {
    switch (prop.kind) {
      case 'tree':
        return buildTree(prop.seed, prop.tall)
      case 'rock':
        return buildRock(prop.seed)
      case 'flower':
        return buildFlower(prop.seed)
      case 'lantern':
        return buildLantern()
      case 'fence':
        return buildFenceSegment()
      case 'mushroom':
        return buildMushroomProp(prop.seed)
      case 'cottage':
        return buildCottage()
      case 'shrine':
        return buildShrine()
    }
  }, [prop])

  const solid = prop.kind !== 'flower'

  return (
    <group position={prop.position} rotation={[0, prop.rotation ?? 0, 0]}>
      {solid ? (
        <RigidBody type="fixed" colliders={false}>
          <PropCollider kind={prop.kind} />
        </RigidBody>
      ) : null}
      <InstancedVoxels voxels={voxels} castShadow={prop.kind !== 'flower'} />
      {prop.kind === 'lantern' && (
        <pointLight
          position={[0, 1.1, 0]}
          intensity={0.55}
          distance={5}
          color="#f4c56d"
          castShadow={false}
        />
      )}
      {prop.kind === 'shrine' && (
        <pointLight
          position={[0, 2.3, 0]}
          intensity={1.1}
          distance={8}
          color="#f0a05a"
        />
      )}
      {prop.kind === 'cottage' && (
        <pointLight position={[0, 1.2, 1.4]} intensity={0.4} distance={4} color="#f4c56d" />
      )}
    </group>
  )
}
