// Small, dependency-free geometry kit shared by the bake pipeline (Node) and the
// runtime evaluator (browser). Everything here is plain arrays so the same code
// runs in both places and the baked numbers are reproduced bit-for-bit.

export type V2 = [number, number]
export type V3 = [number, number, number]
/** 3x4 affine transform: rotation row-major in [0..8], translation in [9..11]. */
export type Mat = number[]

export const EPS = 1e-9

// ---------------------------------------------------------------- 2D vectors
export const add2 = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]]
export const sub2 = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]]
export const scale2 = (a: V2, s: number): V2 => [a[0] * s, a[1] * s]
export const dot2 = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1]
export const cross2 = (a: V2, b: V2) => a[0] * b[1] - a[1] * b[0]
export const len2 = (a: V2) => Math.hypot(a[0], a[1])
export const norm2 = (a: V2): V2 => {
  const l = len2(a)
  return [a[0] / l, a[1] / l]
}
export const lerp2 = (a: V2, b: V2, t: number): V2 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
]
export const dist2 = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1])
export const rot2 = (a: V2, th: number): V2 => {
  const c = Math.cos(th)
  const s = Math.sin(th)
  return [a[0] * c - a[1] * s, a[0] * s + a[1] * c]
}

/** An oriented line: point p, unit direction d. "Left" is cross(d, x - p) > 0. */
export interface Line2 {
  p: V2
  d: V2
}
export const lineThrough = (a: V2, b: V2): Line2 => ({ p: a, d: norm2(sub2(b, a)) })
export const sideOf = (l: Line2, x: V2) => cross2(l.d, sub2(x, l.p))
export const reflect2 = (l: Line2, x: V2): V2 => {
  const v = sub2(x, l.p)
  const along = dot2(v, l.d)
  const foot = add2(l.p, scale2(l.d, along))
  return sub2(scale2(foot, 2), x)
}
/** Perpendicular bisector of a->b, oriented so that `a` is on the left. */
export const bisector = (a: V2, b: V2): Line2 => {
  const m = lerp2(a, b, 0.5)
  const ab = norm2(sub2(b, a))
  // d such that cross(d, a - m) > 0 ; a - m is along -ab
  const d: V2 = [-ab[1], ab[0]]
  return { p: m, d }
}
export const intersectLines = (a: Line2, b: Line2): V2 | null => {
  const den = cross2(a.d, b.d)
  if (Math.abs(den) < 1e-12) return null
  const t = cross2(sub2(b.p, a.p), b.d) / den
  return add2(a.p, scale2(a.d, t))
}
export const flip = (l: Line2): Line2 => ({ p: l.p, d: [-l.d[0], -l.d[1]] })

// ---------------------------------------------------------------- polygons
export const area2 = (poly: V2[]) => {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    s += a[0] * b[1] - a[1] * b[0]
  }
  return s / 2
}
export const centroid2 = (poly: V2[]): V2 => {
  let cx = 0
  let cy = 0
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const c = p[0] * q[1] - q[0] * p[1]
    a += c
    cx += (p[0] + q[0]) * c
    cy += (p[1] + q[1]) * c
  }
  if (Math.abs(a) < 1e-14) {
    const n = poly.length
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n]
  }
  return [cx / (3 * a), cy / (3 * a)]
}

/** Split a convex polygon by a line. Returns [left, right]; either may be empty. */
export function splitPoly(poly: V2[], l: Line2, tol = 1e-9): [V2[], V2[]] {
  const left: V2[] = []
  const right: V2[] = []
  const n = poly.length
  const s = poly.map((p) => sideOf(l, p))
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    const sa = Math.abs(s[i]) < tol ? 0 : s[i]
    const sb = Math.abs(s[(i + 1) % n]) < tol ? 0 : s[(i + 1) % n]
    if (sa >= 0) left.push(a)
    if (sa <= 0) right.push(a)
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) {
      const t = sa / (sa - sb)
      const x = lerp2(a, b, t)
      left.push(x)
      right.push(x)
    }
  }
  return [clean(left), clean(right)]
}

/** Drop duplicate and collinear vertices. */
export function clean(poly: V2[], tol = 1e-10): V2[] {
  let out = poly.filter((p, i) => dist2(p, poly[(i + 1) % poly.length]) > 1e-9)
  let changed = true
  while (changed && out.length > 3) {
    changed = false
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length]
      const b = out[i]
      const c = out[(i + 1) % out.length]
      if (Math.abs(cross2(sub2(b, a), sub2(c, b))) < tol) {
        out = out.filter((_, j) => j !== i)
        changed = true
        break
      }
    }
  }
  return out.length >= 3 && Math.abs(area2(out)) > 1e-12 ? out : []
}

/** Convex ∩ convex (Sutherland–Hodgman). Both CCW. */
export function clipPoly(subject: V2[], clip: V2[]): V2[] {
  let out = subject
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i]
    const b = clip[(i + 1) % clip.length]
    out = splitPoly(out, lineThrough(a, b))[0]
  }
  return out
}
export const ccw = (poly: V2[]) => (area2(poly) < 0 ? [...poly].reverse() : poly)

export function pointInPoly(poly: V2[], x: V2, tol = 1e-9) {
  // convex, CCW
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    if (cross2(sub2(b, a), sub2(x, a)) < -tol) return false
  }
  return true
}

/** Fan + subdivision triangulation of a convex polygon, max edge ~h. */
export function triangulate(poly: V2[], h: number): { pts: V2[]; tris: number[] } {
  const pts: V2[] = []
  const tris: number[] = []
  const c = centroid2(poly)
  const key = new Map<string, number>()
  const id = (p: V2) => {
    const k = `${p[0].toFixed(9)},${p[1].toFixed(9)}`
    let i = key.get(k)
    if (i === undefined) {
      i = pts.length
      pts.push(p)
      key.set(k, i)
    }
    return i
  }
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const size = Math.max(dist2(a, b), dist2(a, c), dist2(b, c))
    const n = Math.max(1, Math.ceil(size / h))
    // barycentric subdivision of triangle (c, a, b)
    const P = (r: number, s: number): V2 => [
      c[0] + (a[0] - c[0]) * (r / n) + (b[0] - c[0]) * (s / n),
      c[1] + (a[1] - c[1]) * (r / n) + (b[1] - c[1]) * (s / n),
    ]
    for (let r = 0; r < n; r++) {
      for (let s = 0; s < n - r; s++) {
        tris.push(id(P(r, s)), id(P(r + 1, s)), id(P(r, s + 1)))
        if (s < n - r - 1) tris.push(id(P(r + 1, s)), id(P(r + 1, s + 1)), id(P(r, s + 1)))
      }
    }
  }
  return { pts, tris }
}

// ---------------------------------------------------------------- 3D
export const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale3 = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross3 = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2])
export const norm3 = (a: V3): V3 => {
  const l = len3(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
export const dist3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

export const IDENT: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]

export function apply(m: Mat, p: V3): V3 {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[9],
    m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + m[10],
    m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + m[11],
  ]
}
export function applyR(m: Mat, p: V3): V3 {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
    m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
    m[6] * p[0] + m[7] * p[1] + m[8] * p[2],
  ]
}
/** a ∘ b */
export function mul(a: Mat, b: Mat): Mat {
  const r: Mat = new Array(12)
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]
  const t = applyR(a, [b[9], b[10], b[11]])
  r[9] = t[0] + a[9]
  r[10] = t[1] + a[10]
  r[11] = t[2] + a[11]
  return r
}
export function inverse(m: Mat): Mat {
  // rigid: R^T, -R^T t
  const r: Mat = [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8], 0, 0, 0]
  const t = applyR(r, [m[9], m[10], m[11]])
  r[9] = -t[0]
  r[10] = -t[1]
  r[11] = -t[2]
  return r
}
/** Rotation by angle th about the axis through p with unit direction d. */
export function rotAxis(p: V3, d: V3, th: number): Mat {
  const c = Math.cos(th)
  const s = Math.sin(th)
  const C = 1 - c
  const [x, y, z] = d
  const R = [
    c + x * x * C, x * y * C - z * s, x * z * C + y * s,
    y * x * C + z * s, c + y * y * C, y * z * C - x * s,
    z * x * C - y * s, z * y * C + x * s, c + z * z * C,
  ]
  const m: Mat = [...R, 0, 0, 0]
  const rp = applyR(m, p)
  m[9] = p[0] - rp[0]
  m[10] = p[1] - rp[1]
  m[11] = p[2] - rp[2]
  return m
}
export const normalOf = (m: Mat): V3 => [m[2], m[5], m[8]]

/** Snap a transform that should be flat (normal ±z, z = 0) to exact values. */
export function snapFlat(m: Mat): Mat {
  const r = [...m]
  const s = m[8] >= 0 ? 1 : -1
  r[2] = 0
  r[5] = 0
  r[6] = 0
  r[7] = 0
  r[8] = s
  r[11] = 0
  // re-orthonormalise the in-plane 2x2 block
  const a = Math.atan2(m[3], m[0])
  r[0] = Math.cos(a)
  r[3] = Math.sin(a)
  r[1] = -s * Math.sin(a)
  r[4] = s * Math.cos(a)
  return r
}

// ---------------------------------------------------------------- easing
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
/** Symmetric ease-in-out (sine), the PRD's fold timing curve. */
export const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t))
export const window01 = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
