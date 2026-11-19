// Runtime playback of a baked model. The bake pipeline validates frames using
// this exact function, so what the browser draws is what was checked.

import {
  type Mat,
  type V2,
  type V3,
  IDENT,
  apply,
  applyR,
  easeInOut,
  mul,
  rotAxis,
  smoothstep,
  sub3,
  dot3,
  add3,
  scale3,
  cross3,
} from "./math"
import { SAMPLES, type BakedFlex, type BakedStep } from "./types"

export function sampleAngle(a: number[], t: number) {
  const x = Math.min(Math.max(t, 0), 1) * (a.length - 1)
  const i = Math.min(Math.floor(x), a.length - 2)
  const f = x - i
  return a[i] * (1 - f) + a[i + 1] * f
}

export interface StepRuntime {
  faceGroup: Int16Array
  flexSign: Int8Array
  curlOf: Int16Array
  /** per face: vertical correction so the pivoted stack lands on its end level */
  delta: Float64Array
}

export function prepareStep(step: BakedStep, faceCount: number): StepRuntime {
  const faceGroup = new Int16Array(faceCount).fill(-1)
  step.groups.forEach((g, gi) => g.faces.forEach((f) => (faceGroup[f] = gi)))
  const flexSign = new Int8Array(faceCount)
  if (step.flex) {
    step.flex.front.forEach((f) => (flexSign[f] = 1))
    step.flex.back.forEach((f) => (flexSign[f] = -1))
  }
  const curlOf = new Int16Array(faceCount).fill(-1)
  step.curl?.forEach((c, ci) => c.faces.forEach((f) => (curlOf[f] = ci)))
  const delta = new Float64Array(faceCount * 3)
  const mats = groupMatrices(step, 1)
  for (let f = 0; f < faceCount; f++) {
    const g = faceGroup[f]
    if (g < 0) continue
    const end = pivotOffset(mats[g], step.o0[f], step.groups[g].h ?? 0)
    delta[f * 3] = step.o1[f][0] - end[0]
    delta[f * 3 + 1] = step.o1[f][1] - end[1]
    delta[f * 3 + 2] = step.o1[f][2] - end[2]
  }
  return { faceGroup, flexSign, curlOf, delta }
}

/** Offset of a layer at height o0 turned by R about a pivot at height h. */
export function pivotOffset(R: Mat, o0: V3, h: number): V3 {
  const r = applyR(R, [o0[0], o0[1], o0[2] - h])
  return [r[0], r[1], r[2] + h]
}

export function groupMatrices(step: BakedStep, t: number): Mat[] {
  const out: Mat[] = []
  step.groups.forEach((g, i) => {
    const R = rotAxis(g.p, g.d, sampleAngle(g.a, t))
    out[i] = g.parent >= 0 ? mul(out[g.parent], R) : R
  })
  return out
}

export function flexWeight(f: BakedFlex, x: number, y: number) {
  const dx = x - f.v[0]
  const dy = y - f.v[1]
  if (f.kind === "band") {
    const dist = Math.abs(Math.cos(f.th0) * dy - Math.sin(f.th0) * dx)
    return smoothstep(f.r1, f.r2, dist)
  }
  const r = Math.hypot(dx, dy)
  if (r < 1e-9) return 1
  let rel = Math.atan2(dy, dx) - f.th0
  while (rel <= -Math.PI) rel += 2 * Math.PI
  while (rel > Math.PI) rel -= 2 * Math.PI
  const span = f.th1 - f.th0
  const aw = smoothstep(-f.margin, 0, rel) * (1 - smoothstep(span, span + f.margin, rel))
  const rw = 1 - smoothstep(f.r1, f.r2, r)
  return aw * rw
}

/**
 * Position of CP point (u, v) on face `face` at time t of `step`.
 * `withOffset` adds layer separation (render), false gives pure geometry (validation).
 */
export function pointAt(
  step: BakedStep,
  rt: StepRuntime,
  mats: Mat[],
  face: number,
  u: number,
  v: number,
  t: number,
  withOffset = true
): V3 {
  const T = step.T[face]
  const x0 = apply(T, [u, v, 0])
  const g = rt.faceGroup[face]
  let x: V3 = x0
  let R: Mat = IDENT
  if (g >= 0) {
    const grp = step.groups[g]
    if (grp.bend && grp.r) {
      const rel = sub3(x0, grp.p)
      const along = scale3(grp.d, dot3(rel, grp.d))
      const r = Math.hypot(...sub3(rel, along))
      // the far edge trails the hinge mid-fold: a fraction of the angle, never past zero
      const a = sampleAngle(grp.a, t)
      const lag = grp.bend * Math.sin(Math.PI * t) * Math.pow(r / grp.r, 1.5)
      const M = rotAxis(grp.p, grp.d, a * (1 - lag))
      const Mp = grp.parent >= 0 ? mul(mats[grp.parent], M) : M
      x = apply(Mp, x0)
      R = Mp
    } else {
      x = apply(mats[g], x0)
      R = mats[g]
    }
  }
  const fs = rt.flexSign[face]
  if (fs && step.flex) {
    const f = step.flex
    const alpha = sampleAngle(step.groups[f.alphaGroup].a, t)
    const w = flexWeight(f, x0[0], x0[1])
    if (w > 0) {
      R = rotAxis(f.p, f.d, fs * alpha * w)
      x = apply(R, x)
    }
  }
  const ci = rt.curlOf[face]
  if (ci >= 0 && step.curl) {
    x = curlPoint(step.curl[ci], x, t)
  }
  if (!withOffset) return x
  const s = easeInOut(t)
  const o0 = step.o0[face]
  if (g >= 0) {
    const grp = step.groups[g]
    const o = pivotOffset(R, o0, grp.h ?? 0)
    // land in step with the hinge: correction follows the angle's progress
    const aEnd = grp.a[grp.a.length - 1]
    const prog = Math.abs(aEnd) > 1e-6 ? Math.min(Math.max(sampleAngle(grp.a, t) / aEnd, 0), 1) : easeInOut(t)
    // vertical landing correction only as the flap settles, so layers in a
    // tilted stack never slide past each other mid-flight
    const s = prog * prog * prog
    return [
      x[0] + o[0] + rt.delta[face * 3] * s,
      x[1] + o[1] + rt.delta[face * 3 + 1] * s,
      x[2] + o[2] + rt.delta[face * 3 + 2] * s,
    ]
  }
  const o1 = step.o1[face]
  const ro = o0
  return [
    x[0] + ro[0] * (1 - s) + o1[0] * s,
    x[1] + ro[1] * (1 - s) + o1[1] * s,
    x[2] + ro[2] * (1 - s) + o1[2] * s,
  ]
}

function curlPoint(c: NonNullable<BakedStep["curl"]>[number], x: V3, t: number): V3 {
  // distance past the curl line, measured along `out`
  const rel = sub3(x, c.p)
  const s = dot3(rel, c.out)
  if (s <= 0) return x
  const total = c.angle * easeInOut(t)
  if (total < 1e-6) return x
  // roll onto a cylinder of radius R tangent at the line; arc length s
  const R = c.radius
  const phi = Math.min(s / R, total)
  const extra = s - phi * R
  const base = sub3(x, scale3(c.out, s))
  const p = add3(base, add3(scale3(c.out, R * Math.sin(phi)), scale3(c.n, R * (1 - Math.cos(phi)))))
  if (extra <= 0) return p
  const tangent = add3(scale3(c.out, Math.cos(phi)), scale3(c.n, Math.sin(phi)))
  return add3(p, scale3(tangent, extra))
}

export { cross3 }

export interface RenderMesh {
  /** per vertex: face index and CP coords */
  face: Uint16Array
  uv: Float32Array
  index: Uint32Array
}

/** Fill `out` (xyz per vertex) with the frame at time t. */
export function evaluateInto(
  step: BakedStep,
  rt: StepRuntime,
  mesh: RenderMesh,
  t: number,
  out: Float32Array,
  withOffset = true
) {
  const mats = groupMatrices(step, t)
  const n = mesh.face.length
  for (let i = 0; i < n; i++) {
    const p = pointAt(step, rt, mats, mesh.face[i], mesh.uv[i * 2], mesh.uv[i * 2 + 1], t, withOffset)
    out[i * 3] = p[0]
    out[i * 3 + 1] = p[1]
    out[i * 3 + 2] = p[2]
  }
}

export const sampleTimes = () => Array.from({ length: SAMPLES + 1 }, (_, i) => i / SAMPLES)
export type { V2 }
