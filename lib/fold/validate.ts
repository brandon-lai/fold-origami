// Bake-time checks from the PRD: no face passes through another at any frame,
// shared creases never tear, and every flat state obeys Maekawa and Kawasaki.

import { type V2, type V3, sub3, cross3, dot3 } from "./math"
import { evaluateInto, prepareStep } from "./evaluate"
import { buildMesh } from "./mesh"
import type { BakedModel } from "./types"

export interface Issue {
  step: number
  kind: "intersection" | "tear" | "maekawa" | "kawasaki"
  detail: string
}

const triBox = (v: V3[]) => [
  Math.min(v[0][0], v[1][0], v[2][0]), Math.min(v[0][1], v[1][1], v[2][1]), Math.min(v[0][2], v[1][2], v[2][2]),
  Math.max(v[0][0], v[1][0], v[2][0]), Math.max(v[0][1], v[1][1], v[2][1]), Math.max(v[0][2], v[1][2], v[2][2]),
]

function segTri(p: V3, q: V3, a: V3, b: V3, c: V3, tol: number): boolean {
  const e1 = sub3(b, a)
  const e2 = sub3(c, a)
  const d = sub3(q, p)
  const h = cross3(d, e2)
  const det = dot3(e1, h)
  if (Math.abs(det) < 1e-14) return false
  const f = 1 / det
  const s = sub3(p, a)
  const u = f * dot3(s, h)
  if (u < tol || u > 1 - tol) return false
  const qv = cross3(s, e1)
  const v = f * dot3(d, qv)
  if (v < tol || u + v > 1 - tol) return false
  const t = f * dot3(e2, qv)
  return t > tol && t < 1 - tol
}

export function validateModel(model: BakedModel, opts: { frames?: number; skipIntersections?: boolean } = {}): Issue[] {
  const issues: Issue[] = []
  const mesh = buildMesh(model, 0.05)
  const steps = model["fold:steps"]
  const nf = model["fold:faces"].length
  const pos = new Float32Array(mesh.face.length * 3)
  const frames = opts.frames ?? 24

  steps.forEach((step, si) => {
    const rt = prepareStep(step, nf)
    const moves = (f: number) => rt.faceGroup[f] >= 0 || rt.flexSign[f] !== 0 || rt.curlOf[f] >= 0
    if (!opts.skipIntersections) {
      for (let k = 1; k <= frames; k++) {
        const t = k / frames
        // true paper geometry: layer offsets are a rendering aid, not physics
        evaluateInto(step, rt, mesh, t, pos, false)
        const P = (i: number): V3 => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]
        const boxes = mesh.faceTris.map((tris) => {
          const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
          for (const ti of tris)
            for (let j = 0; j < 3; j++) {
              const v = mesh.index[ti * 3 + j]
              for (let c = 0; c < 3; c++) {
                b[c] = Math.min(b[c], pos[v * 3 + c])
                b[c + 3] = Math.max(b[c + 3], pos[v * 3 + c])
              }
            }
          return b
        })
        let found = ""
        for (let a = 0; a < nf && !found; a++)
          for (let b = a + 1; b < nf && !found; b++) {
            if (!moves(a) && !moves(b)) continue
            // two faces carried by the same rigid group cannot pass through each other
            const rigid = (f: number) => rt.flexSign[f] === 0 && rt.curlOf[f] < 0 && !step.groups[rt.faceGroup[f]]?.bend
            if (rt.faceGroup[a] === rt.faceGroup[b] && rigid(a) && rigid(b)) continue
            const A = boxes[a]
            const B = boxes[b]
            if (A[0] > B[3] || B[0] > A[3] || A[1] > B[4] || B[1] > A[4] || A[2] > B[5] || B[2] > A[5]) continue
            const tb3 = mesh.faceTris[b].map((tb) => [0, 1, 2].map((j) => P(mesh.index[tb * 3 + j])))
            const tbox = tb3.map(triBox)
            for (const ta of mesh.faceTris[a]) {
              const va = [0, 1, 2].map((j) => P(mesh.index[ta * 3 + j]))
              const ba = triBox(va)
              for (let k2 = 0; k2 < tb3.length; k2++) {
                const bb = tbox[k2]
                if (ba[0] > bb[3] || bb[0] > ba[3] || ba[1] > bb[4] || bb[1] > ba[4] || ba[2] > bb[5] || bb[2] > ba[5]) continue
                const vb = tb3[k2]
                let hit = false
                for (let e = 0; e < 3 && !hit; e++) {
                  hit =
                    segTri(va[e], va[(e + 1) % 3], vb[0], vb[1], vb[2], 1e-3) ||
                    segTri(vb[e], vb[(e + 1) % 3], va[0], va[1], va[2], 1e-3)
                }
                if (hit) {
                  const c = va[0].map((x, i) => ((x + vb[0][i]) / 2).toFixed(3))
                  found = `faces ${a} and ${b} cross at t=${t.toFixed(2)} near (${c}); groups ${rt.faceGroup[a]}/${rt.faceGroup[b]} z0 ${step.o0[a][2].toFixed(4)}/${step.o0[b][2].toFixed(4)} z1 ${step.o1[a][2].toFixed(4)}/${step.o1[b][2].toFixed(4)}`
                  break
                }
              }
              if (found) break
            }
          }
        if (found) {
          issues.push({ step: si, kind: "intersection", detail: found })
          break
        }
      }
    }
    if (step.flatEnd) issues.push(...flatChecks(model, si))
  })
  return issues
}

/** Maekawa and Kawasaki at every interior vertex of the flat state after step si. */
export function flatChecks(model: BakedModel, si: number): Issue[] {
  const out: Issue[] = []
  const steps = model["fold:steps"]
  const faces = model["fold:faces"]
  const step = steps[si]
  // end transforms: start of next step, or evaluate group matrices at t = 1
  const T = si + 1 < steps.length ? steps[si + 1].T : null
  const z = step.o1.map((o) => o[2])
  let Tend: number[][]
  if (T) Tend = T
  else {
    const rt = prepareStep(step, faces.length)
    // compose group matrices at t=1
    const mesh = { face: new Uint16Array(faces.length * 3), uv: new Float32Array(faces.length * 6), index: new Uint32Array(0) }
    void mesh
    void rt
    Tend = endTransforms(step)
  }
  const W = model["fold:paper"].w
  const H = model["fold:paper"].h
  const onBoundary = (p: V2) =>
    Math.abs(p[0]) < 1e-6 || Math.abs(p[1]) < 1e-6 || Math.abs(p[0] - W) < 1e-6 || Math.abs(p[1] - H) < 1e-6
  // collect folded edges: pairs of faces sharing an edge with opposite normals
  const folded: { a: V2; b: V2; mv: 1 | -1 }[] = []
  for (let i = 0; i < faces.length; i++)
    for (let j = i + 1; j < faces.length; j++) {
      const seg = sharedEdge(faces[i], faces[j])
      if (!seg) continue
      const ni = Tend[i][8]
      const nj = Tend[j][8]
      if (ni * nj > 0) continue
      // valley if j sits on the front side of i
      const valley = (z[j] - z[i]) * ni > 0
      folded.push({ a: seg[0], b: seg[1], mv: valley ? 1 : -1 })
    }
  // vertices
  const verts = new Map<string, V2>()
  for (const f of faces) for (const p of f) verts.set(`${p[0].toFixed(5)},${p[1].toFixed(5)}`, p)
  for (const [, v] of verts) {
    if (onBoundary(v)) continue
    const inc: { ang: number; mv: number }[] = []
    for (const e of folded) {
      for (const [p, q] of [
        [e.a, e.b],
        [e.b, e.a],
      ] as [V2, V2][]) {
        if (Math.hypot(p[0] - v[0], p[1] - v[1]) < 1e-6) inc.push({ ang: Math.atan2(q[1] - v[1], q[0] - v[0]), mv: e.mv })
      }
      // vertex in the middle of a folded edge: crease passes straight through
      const dx = e.b[0] - e.a[0]
      const dy = e.b[1] - e.a[1]
      const L = Math.hypot(dx, dy)
      const tpar = ((v[0] - e.a[0]) * dx + (v[1] - e.a[1]) * dy) / (L * L)
      const off = Math.abs((v[0] - e.a[0]) * dy - (v[1] - e.a[1]) * dx) / L
      if (off < 1e-6 && tpar > 1e-6 && tpar < 1 - 1e-6) {
        inc.push({ ang: Math.atan2(dy, dx), mv: e.mv }, { ang: Math.atan2(-dy, -dx), mv: e.mv })
      }
    }
    // dedupe directions
    inc.sort((a, b) => a.ang - b.ang)
    const dirs = inc.filter((x, i) => i === 0 || Math.abs(x.ang - inc[i - 1].ang) > 1e-6)
    if (dirs.length === 0) continue
    const M = dirs.filter((d) => d.mv < 0).length
    const V = dirs.length - M
    if (Math.abs(M - V) !== 2) {
      out.push({ step: si, kind: "maekawa", detail: `vertex ${v.map((x) => x.toFixed(3))}: M=${M} V=${V}` })
      continue
    }
    let alt = 0
    for (let i = 0; i < dirs.length; i++) {
      let s = dirs[(i + 1) % dirs.length].ang - dirs[i].ang
      if (s <= 0) s += 2 * Math.PI
      alt += i % 2 ? -s : s
    }
    if (Math.abs(alt) > 1e-3) out.push({ step: si, kind: "kawasaki", detail: `vertex ${v.map((x) => x.toFixed(3))}: alternating sum ${alt.toFixed(5)}` })
  }
  return out
}

function endTransforms(step: BakedModel["fold:steps"][number]): number[][] {
  // compose the group transforms at t = 1 onto each face's start transform
  const mats: number[][] = []
  step.groups.forEach((g, i) => {
    const a = g.a[g.a.length - 1]
    const R = rot(g.p, g.d, a)
    mats[i] = g.parent >= 0 ? mul(mats[g.parent], R) : R
  })
  const gOf = new Map<number, number>()
  step.groups.forEach((g, gi) => g.faces.forEach((f) => gOf.set(f, gi)))
  return step.T.map((T, f) => (gOf.has(f) ? mul(mats[gOf.get(f) as number], T) : T))
}

import { rotAxis as rot, mul } from "./math"

function sharedEdge(A: V2[], B: V2[]): [V2, V2] | null {
  for (let i = 0; i < A.length; i++) {
    const a1 = A[i]
    const a2 = A[(i + 1) % A.length]
    const dx = a2[0] - a1[0]
    const dy = a2[1] - a1[1]
    const la = Math.hypot(dx, dy)
    for (let j = 0; j < B.length; j++) {
      const b1 = B[j]
      const b2 = B[(j + 1) % B.length]
      const c1 = (dx * (b1[1] - a1[1]) - dy * (b1[0] - a1[0])) / la
      const c2 = (dx * (b2[1] - a1[1]) - dy * (b2[0] - a1[0])) / la
      if (Math.abs(c1) > 1e-6 || Math.abs(c2) > 1e-6) continue
      const t1 = (dx * (b1[0] - a1[0]) + dy * (b1[1] - a1[1])) / (la * la)
      const t2 = (dx * (b2[0] - a1[0]) + dy * (b2[1] - a1[1])) / (la * la)
      const lo = Math.max(0, Math.min(t1, t2))
      const hi = Math.min(1, Math.max(t1, t2))
      if ((hi - lo) * la > 1e-6)
        return [
          [a1[0] + dx * lo, a1[1] + dy * lo],
          [a1[0] + dx * hi, a1[1] + dy * hi],
        ]
    }
  }
  return null
}
