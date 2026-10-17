import type { Object3D } from 'three'

/** Safe pose helpers for bone groups */
export function setRot(obj: Object3D | null | undefined, x: number, y: number, z: number) {
  if (!obj) return
  obj.rotation.set(x, y, z)
}

export function setPos(obj: Object3D | null | undefined, x: number, y: number, z: number) {
  if (!obj) return
  obj.position.set(x, y, z)
}

export function setScale(obj: Object3D | null | undefined, x: number, y: number, z: number) {
  if (!obj) return
  obj.scale.set(x, y, z)
}

export function addRot(obj: Object3D | null | undefined, x: number, y: number, z: number) {
  if (!obj) return
  obj.rotation.x += x
  obj.rotation.y += y
  obj.rotation.z += z
}
