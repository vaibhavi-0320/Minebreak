import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { runtime } from '../game/runtime'
import { mulberry32 } from '../meshes/voxel'

const _dummy = new THREE.Object3D()
const LEVEL_COLORS = [0xf4c56d, 0xffe8a8, 0xe07a3a, 0x7cb87a, 0xfff4c0]

export function VFX() {
  const burstRef = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    runtime.vfx = runtime.vfx
      .map((v) => ({ ...v, life: v.life - dt }))
      .filter((v) => v.life > 0)

    const g = burstRef.current
    if (!g) return

    while (g.children.length < runtime.vfx.length) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.35, 0.35),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      )
      g.add(m)
    }
    while (g.children.length > runtime.vfx.length) {
      const c = g.children[g.children.length - 1]!
      g.remove(c)
      const mesh = c as THREE.Mesh
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }

    for (let i = 0; i < runtime.vfx.length; i++) {
      const v = runtime.vfx[i]!
      const m = g.children[i] as THREE.Mesh
      const t = 1 - v.life / v.maxLife
      let scale = v.scale
      let y = v.position[1]
      let opacity = Math.max(0, v.life / v.maxLife)

      if (v.kind === 'spawn' || v.kind === 'death') {
        scale = v.scale * (0.4 + t * 1.4)
        opacity *= 0.55
      } else if (v.kind === 'hit') {
        scale = v.scale * (1 + t * 0.5)
        opacity *= 0.9
      } else if (v.kind === 'slash') {
        scale = v.scale * (0.8 + t * 0.6)
        opacity *= 0.7
      } else if (v.kind === 'hurt') {
        // burst outward + up when player is hit
        scale = v.scale * (0.6 + t * 1.8)
        y = v.position[1] + t * 1.1
        opacity *= 1 - t * 0.9
        m.rotation.x = t * 5
        m.rotation.z = t * 3
      } else if (v.kind === 'levelup') {
        scale = v.scale * (0.5 + t * 1.6)
        y = v.position[1] + t * 2.2
        opacity *= 1 - t * 0.85
        m.rotation.x = t * 4
        m.rotation.y = t * 6
      } else {
        opacity *= 0.55
      }

      m.position.set(v.position[0], y, v.position[2])
      m.scale.setScalar(Math.max(0.05, scale))
      const mat = m.material as THREE.MeshBasicMaterial
      mat.color.set(v.color)
      mat.opacity = opacity
    }
  })

  return (
    <group>
      <group ref={burstRef} />
      <LevelUpAura />
      <PlayerHurtAura />
      <Fireflies />
      <AmbientEmbers />
    </group>
  )
}

/** Red ring + flash that follows the player briefly after taking damage */
function PlayerHurtAura() {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const flash = useRef<THREE.Mesh>(null)

  useFrame((_, dt) => {
    if (runtime.playerHurtFx > 0) {
      runtime.playerHurtFx = Math.max(0, runtime.playerHurtFx - dt)
    }
    const active = runtime.playerHurtFx > 0
    if (!group.current) return
    group.current.visible = active
    if (!active) return

    const [px, , pz] = runtime.playerPos
    group.current.position.set(px, 0, pz)
    const p = runtime.playerHurtFx / 0.55

    if (ring.current) {
      const mat = ring.current.material as THREE.MeshBasicMaterial
      ring.current.scale.setScalar(0.8 + (1 - p) * 2.2)
      mat.opacity = Math.max(0, p * 0.65)
      ring.current.position.y = 0.1
    }
    if (flash.current) {
      const mat = flash.current.material as THREE.MeshBasicMaterial
      flash.current.position.y = 0.9
      flash.current.scale.setScalar(1.2 + (1 - p) * 0.8)
      mat.opacity = Math.max(0, p * 0.45)
    }
  })

  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.85, 28]} />
        <meshBasicMaterial
          color="#ff4a3a"
          transparent
          opacity={0.5}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={flash}>
        <sphereGeometry args={[0.55, 12, 12]} />
        <meshBasicMaterial color="#ff8068" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <pointLight color="#ff5533" intensity={1.8} distance={5} position={[0, 1, 0]} />
    </group>
  )
}

/** Orbiting golden voxel cubes around the player during level-up */
function LevelUpAura() {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const count = 24
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const geometry = useMemo(() => new THREE.BoxGeometry(0.22, 0.22, 0.22), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f4c56d',
        emissive: '#e07a3a',
        emissiveIntensity: 0.65,
        roughness: 0.45,
        flatShading: true,
        transparent: true,
        opacity: 0.95,
      }),
    [],
  )

  useFrame((_, dt) => {
    const active = runtime.levelUpFx > 0
    if (group.current) group.current.visible = active
    if (!active || !meshRef.current) return

    const t = 2.4 - runtime.levelUpFx
    const [px, py, pz] = runtime.playerPos
    group.current!.position.set(px, 0, pz)

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + t * 2.8
      const radius = 0.9 + Math.sin(t * 4 + i) * 0.25 + t * 0.35
      const y = py + 0.3 + Math.sin(t * 5 + i * 0.7) * 0.45 + (i % 3) * 0.15
      _dummy.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius)
      _dummy.rotation.set(t * 3 + i, t * 2, 0)
      const s = 0.7 + Math.sin(t * 6 + i) * 0.25
      _dummy.scale.setScalar(s)
      _dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, _dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    // pulse material color between gold / ember
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    mat.color.setHex(LEVEL_COLORS[Math.floor(t * 8) % LEVEL_COLORS.length]!)
    mat.emissiveIntensity = 0.5 + Math.sin(t * 10) * 0.35

    if (ring.current) {
      const mat = ring.current.material as THREE.MeshBasicMaterial
      const p = runtime.levelUpFx / 2.4
      ring.current.scale.setScalar(1.2 + (1 - p) * 3.5)
      mat.opacity = Math.max(0, p * 0.55)
      ring.current.position.y = 0.08
    }

    // sparkle trails while active
    if (Math.random() < 0.35) {
      const a = Math.random() * Math.PI * 2
      runtime.vfx.push({
        id: `lvl_${Math.random().toString(36).slice(2, 8)}`,
        position: [
          px + Math.cos(a) * (0.5 + Math.random()),
          py + Math.random() * 1.2,
          pz + Math.sin(a) * (0.5 + Math.random()),
        ],
        color: Math.random() > 0.5 ? '#f4c56d' : '#ffe8a8',
        life: 0.55,
        maxLife: 0.55,
        scale: 0.5 + Math.random() * 0.4,
        kind: 'levelup',
      })
    }

    void dt
  })

  return (
    <group ref={group} visible={false}>
      <instancedMesh ref={meshRef} args={[geometry, material, count]} />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 1.0, 32]} />
        <meshBasicMaterial color="#f4c56d" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color="#f4c56d" intensity={2.2} distance={10} position={[0, 1.4, 0]} />
    </group>
  )
}

function Fireflies() {
  const ref = useRef<THREE.Points>(null)
  const { positions, phases } = useMemo(() => {
    const rng = mulberry32(42)
    const count = 48
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rng() - 0.5) * 36
      positions[i * 3 + 1] = 0.6 + rng() * 3.5
      positions[i * 3 + 2] = (rng() - 0.5) * 36
      phases[i] = rng() * Math.PI * 2
    }
    return { positions, phases }
  }, [])

  useFrame(({ clock }) => {
    const pts = ref.current
    if (!pts) return
    const arr = pts.geometry.attributes.position!.array as Float32Array
    const t = clock.elapsedTime
    for (let i = 0; i < phases.length; i++) {
      const p = phases[i]!
      arr[i * 3]! += Math.sin(t * 0.7 + p) * 0.004
      arr[i * 3 + 1]! = 0.8 + Math.sin(t * 1.3 + p) * 0.35 + Math.cos(t * 0.5 + p * 2) * 0.2
      arr[i * 3 + 2]! += Math.cos(t * 0.6 + p) * 0.004
    }
    pts.geometry.attributes.position!.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#f4e0a0"
        size={0.14}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </points>
  )
}

function AmbientEmbers() {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const rng = mulberry32(99)
    const count = 24
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (rng() - 0.5) * 10
      arr[i * 3 + 1] = rng() * 2
      arr[i * 3 + 2] = -8 + (rng() - 0.5) * 4
    }
    return arr
  }, [])

  useFrame((_, dt) => {
    const pts = ref.current
    if (!pts) return
    const arr = pts.geometry.attributes.position!.array as Float32Array
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1]! += dt * 0.45
      if (arr[i + 1]! > 3.5) arr[i + 1] = 0.2
    }
    pts.geometry.attributes.position!.needsUpdate = true
  })

  return (
    <points ref={ref} position={[0, 0.5, -8]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ff8a4a" size={0.12} transparent opacity={0.7} depthWrite={false} />
    </points>
  )
}
