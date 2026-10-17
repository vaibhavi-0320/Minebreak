export function clamp01(t: number) {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function smoothstep(t: number) {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

export function easeOutCubic(t: number) {
  const x = 1 - clamp01(t)
  return 1 - x * x * x
}

export function easeInOutQuad(t: number) {
  const x = clamp01(t)
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}

export function spring(current: number, target: number, dt: number, stiffness = 18) {
  return lerp(current, target, 1 - Math.exp(-stiffness * dt))
}
