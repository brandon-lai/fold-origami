// The bake-time fold engine. It keeps an exact flat-folded state (faces in
// crease-pattern space, a rigid transform per face, a stacking order), applies
// folds as rigid hinge groups, solves the free hinges of compound folds so the
// paper never tears, and records everything the browser needs to play it back.

import {
  type Line2,
  type Mat,
  type V2,
  type V3,
  apply,
  applyR,
  area2,
  centroid2,
  clipPoly,
  ccw,
  cross2,
  dist2,
  dot2,
  easeInOut,
  inverse,
  mul,
  normalOf,
  pointInPoly,
  rotAxis,
  sideOf,
  snapFlat,
  splitPoly,
  sub2,
  sub3,
  window01,
  norm3,
  cross3,
  dot3,
  len3,
  scale3,
  add3,
} from "./math"
import { groupMatrices, pivotOffset, pointAt, prepareStep } from "./evaluate"
import {
  LAYER,
  SAMPLES,
  type BakedCurl,
  type BakedFlex,
  type BakedStep,
  type CameraHint,
} from "./types"

export interface Face {
  id: number
  poly: V2[]
  T: Mat
  parent: number | null
}

export interface GroupSpec {
  faces: number[]
  parent?: number
  /** hinge axis (world). A V2 point/direction lies in the table plane. */
  p: V2 | V3
  d: V2 | V3
  end: number
  free?: boolean
  /** driven profile: fraction of `end` reached at local time u ∈ [0,1] */
  profile?: (u: number) => number
  window?: [number, number]
  /** reference path for a free hinge (fraction of end) */
  ref?: (t: number) => number
  bend?: number
  /** fraction of `end` used to judge stacking just before the fold lands */
  approach?: number
  /**
   * A free hinge becomes driven from this time on, easing from wherever the
   * solver left it to `end`. For folds that pass a singular point (petal folds).
   */
  handoff?: number
}

export interface FlexSpec {
  kind?: "sector" | "band"
  p: V2 | V3
  d: V2 | V3
  v: V2
  th0: number
  th1: number
  margin: number
  r1: number
  r2: number
  alphaGroup: number
  front: number[]
  back: number[]
}

export interface CurlSpec extends Omit<BakedCurl, "faces"> {
  faces: number[]
}

export interface StepMeta {
  title: string
  text: string
  fold: string
  tip: string
  camera?: CameraHint
  duration?: number
}

export interface MotionSpec {
  groups: GroupSpec[]
  flex?: FlexSpec
  curl?: CurlSpec[]
  flatEnd?: boolean
  /** regularisation weight pulling free hinges toward their reference path */
  reg?: number
  /** explicit end order override (bottom → top), used rarely */
  order?: number[]
}

export interface StepRecord {
  meta: StepMeta
  alive: number[]
  T: Map<number, Mat>
  o0: Map<number, V3>
  o1: Map<number, V3>
  groups: { faces: number[]; parent: number; p: V3; d: V3; a: number[]; bend?: number; r?: number; h?: number }[]
  flex?: FlexSpec & { p: V3; d: V3 }
  curl?: CurlSpec[]
  flatEnd: boolean
  guide: [V3, V3][]
  creaseCount: number
  maxTear: number
  tearAt?: string
}

interface Adj {
  a: number
  b: number
  q1: V2
  q2: V2
}

const to3 = (v: V2 | V3, z = 0): V3 => (v.length === 3 ? (v as V3) : [v[0], v[1], z])

export class Engine {
  faces: Face[] = []
  alive: number[] = []
  /** bottom → top */
  order: number[] = []
  off = new Map<number, V3>()
  flat = true
  records: StepRecord[] = []
  creases: { a: V2; b: V2; step: number }[] = []
  private creaseKeys = new Set<string>()

  constructor(
    public w: number,
    public h: number,
    initial: Mat
  ) {
    const f: Face = {
      id: 0,
      poly: [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ],
      T: initial,
      parent: null,
    }
    this.faces.push(f)
    this.alive = [0]
    this.order = [0]
    this.off.set(0, [0, 0, 0])
  }

  // ------------------------------------------------------------ queries
  face(id: number) {
    return this.faces[id]
  }
  worldPoly(id: number): V2[] {
    const f = this.faces[id]
    return ccw(
      f.poly.map((p) => {
        const x = apply(f.T, [p[0], p[1], 0])
        return [x[0], x[1]] as V2
      })
    )
  }
  /** world position of a crease-pattern point */
  cp(u: number, v: number): V2 {
    const x = this.cp3(u, v)
    return [x[0], x[1]]
  }
  cp3(u: number, v: number): V3 {
    for (const id of this.alive) {
      const f = this.faces[id]
      if (pointInPoly(ccw(f.poly), [u, v], 1e-7)) return apply(f.T, [u, v, 0])
    }
    throw new Error(`CP point ${u},${v} not on paper`)
  }
  /** faces covering a world point, top first */
  facesAt(x: number, y: number, tol = -1e-7): number[] {
    const hits = this.alive.filter((id) => {
      const wp = this.worldPoly(id)
      return pointInPoly(wp, [x, y], tol)
    })
    return hits.sort((a, b) => this.order.indexOf(b) - this.order.indexOf(a))
  }
  bbox(ids = this.alive) {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity
    for (const id of ids)
      for (const p of this.worldPoly(id)) {
        x0 = Math.min(x0, p[0])
        y0 = Math.min(y0, p[1])
        x1 = Math.max(x1, p[0])
        y1 = Math.max(y1, p[1])
      }
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
  }

  // ------------------------------------------------------------ splitting
  /** Split face by a world line (flat faces only). Returns the resulting ids. */
  split(id: number, L: Line2): number[] {
    const f = this.faces[id]
    if (Math.abs(f.T[8]) < 0.999) throw new Error("split needs a flat face")
    const inv = inverse(f.T)
    const a = apply(inv, [L.p[0], L.p[1], 0])
    const b = apply(inv, [L.p[0] + L.d[0], L.p[1] + L.d[1], 0])
    const cl: Line2 = { p: [a[0], a[1]], d: [b[0] - a[0], b[1] - a[1]] }
    const [l, r] = splitPoly(ccw(f.poly), cl, 1e-9)
    if (!l.length || !r.length || Math.abs(area2(l)) < 1e-9 || Math.abs(area2(r)) < 1e-9) return [id]
    const ids = [l, r].map((poly) => {
      const nf: Face = { id: this.faces.length, poly: ccw(poly), T: [...f.T], parent: id }
      this.faces.push(nf)
      this.off.set(nf.id, [...(this.off.get(id) as V3)])
      return nf.id
    })
    this.alive = this.alive.flatMap((x) => (x === id ? ids : [x]))
    this.order = this.order.flatMap((x) => (x === id ? ids : [x]))
    return ids
  }
  /** Split by a CP line (works in any state, no world mapping). */
  splitCP(id: number, L: Line2): number[] {
    const f = this.faces[id]
    const [l, r] = splitPoly(ccw(f.poly), L, 1e-9)
    if (!l.length || !r.length || Math.abs(area2(l)) < 1e-9 || Math.abs(area2(r)) < 1e-9) return [id]
    const ids = [l, r].map((poly) => {
      const nf: Face = { id: this.faces.length, poly: ccw(poly), T: [...f.T], parent: id }
      this.faces.push(nf)
      this.off.set(nf.id, [...(this.off.get(id) as V3)])
      return nf.id
    })
    this.alive = this.alive.flatMap((x) => (x === id ? ids : [x]))
    this.order = this.order.flatMap((x) => (x === id ? ids : [x]))
    return ids
  }

  /** Faces on the `sign` side of world line L, splitting any face it crosses. */
  side(L: Line2, sign: 1 | -1 = 1, among?: number[]): number[] {
    const pool = among ?? [...this.alive]
    const out: number[] = []
    for (const id of pool) {
      for (const piece of this.split(id, L)) {
        const c = centroid2(this.worldPoly(piece))
        if (sideOf(L, c) * sign > 1e-9) out.push(piece)
      }
    }
    return out
  }

  /**
   * A flap: start from the face at `seed` (world) at stacking `depth`
   * (0 = top, -1 = bottom), spread to every face connected to it on the moving
   * side of L, and split those faces along L.
   */
  flap(seed: V2, depth: number, L: Line2, sign: 1 | -1 = 1): number[] {
    const stack = this.facesAt(seed[0], seed[1])
    if (!stack.length) throw new Error(`no paper at ${seed}`)
    const start = depth >= 0 ? stack[depth] : stack[stack.length + depth]
    if (start === undefined) throw new Error(`no layer ${depth} at ${seed}`)
    const adj = this.adjacency()
    const seen = new Set([start])
    const queue = [start]
    while (queue.length) {
      const f = queue.shift() as number
      for (const e of adj) {
        if (e.a !== f && e.b !== f) continue
        const g = e.a === f ? e.b : e.a
        if (seen.has(g)) continue
        // shared edge must reach the moving side
        const fa = this.faces[f]
        const p1 = apply(fa.T, [e.q1[0], e.q1[1], 0])
        const p2 = apply(fa.T, [e.q2[0], e.q2[1], 0])
        const s = Math.max(sideOf(L, [p1[0], p1[1]]) * sign, sideOf(L, [p2[0], p2[1]]) * sign)
        if (s > 1e-7) {
          seen.add(g)
          queue.push(g)
        }
      }
    }
    return this.side(L, sign, [...seen])
  }

  /** Faces whose CP centroid satisfies pred. */
  byCP(pred: (c: V2) => boolean): number[] {
    return this.alive.filter((id) => pred(centroid2(this.faces[id].poly)))
  }

  /** Faces whose world centroid satisfies pred. */
  byWorld(pred: (c: V2, id: number) => boolean): number[] {
    return this.alive.filter((id) => pred(centroid2(this.worldPoly(id)), id))
  }

  // ------------------------------------------------------------ adjacency
  adjacency(ids = this.alive): Adj[] {
    const out: Adj[] = []
    const boxes = ids.map((id) => {
      const p = this.faces[id].poly
      return [
        Math.min(...p.map((q) => q[0])),
        Math.min(...p.map((q) => q[1])),
        Math.max(...p.map((q) => q[0])),
        Math.max(...p.map((q) => q[1])),
      ]
    })
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const A = boxes[i]
        const B = boxes[j]
        if (A[0] > B[2] + 1e-7 || B[0] > A[2] + 1e-7 || A[1] > B[3] + 1e-7 || B[1] > A[3] + 1e-7) continue
        const seg = sharedEdge(this.faces[ids[i]].poly, this.faces[ids[j]].poly)
        if (seg) out.push({ a: ids[i], b: ids[j], q1: seg[0], q2: seg[1] })
      }
    return out
  }

  // ------------------------------------------------------------ motion
  /**
   * Run one lesson step. Groups turn about hinges; free hinges are solved per
   * frame so every shared crease stays joined. Records the step for baking.
   */
  motion(meta: StepMeta, spec: MotionSpec): StepRecord {
    const alive = [...this.alive]
    const idx = new Map(alive.map((id, i) => [id, i]))
    const groups = spec.groups.map((g) => ({
      ...g,
      parent: g.parent ?? -1,
      p3: to3(g.p),
      d3: norm3(to3(g.d)),
    }))
    const flex = spec.flex
      ? { ...spec.flex, p: to3(spec.flex.p), d: norm3(to3(spec.flex.d)) }
      : undefined

    // A live BakedStep indexed by position in `alive`.
    const live: BakedStep = {
      title: "",
      text: "",
      fold: "",
      tip: "",
      camera: {},
      duration: 1,
      T: alive.map((id) => this.faces[id].T),
      o0: alive.map((id) => this.off.get(id) as V3),
      o1: alive.map((id) => this.off.get(id) as V3),
      groups: groups.map((g) => ({
        faces: g.faces.map((f) => {
          const i = idx.get(f)
          if (i === undefined) throw new Error(`group face ${f} not alive`)
          return i
        }),
        parent: g.parent,
        p: g.p3,
        d: g.d3,
        a: [0, 0],
        bend: g.bend,
      })),
      flex: flex
        ? {
            kind: flex.kind,
            p: flex.p,
            d: flex.d,
            v: flex.v,
            th0: flex.th0,
            th1: flex.th1,
            margin: flex.margin,
            r1: flex.r1,
            r2: flex.r2,
            alphaGroup: flex.alphaGroup,
            front: flex.front.map((f) => idx.get(f) as number),
            back: flex.back.map((f) => idx.get(f) as number),
          }
        : undefined,
      curl: spec.curl?.map((c) => ({ ...c, faces: c.faces.map((f) => idx.get(f) as number) })),
      flatEnd: false,
      moving: [],
      guide: [],
      creases: 0,
    }
    // bend normaliser
    live.groups.forEach((g) => {
      if (!g.bend) return
      let r = 0
      for (const fi of g.faces)
        for (const q of this.faces[alive[fi]].poly) {
          const x = apply(live.T[fi], [q[0], q[1], 0])
          const rel = sub3(x, g.p)
          r = Math.max(r, len3(sub3(rel, scale3(g.d, dot3(rel, g.d)))))
        }
      g.r = r || 1
    })
    // hinge spans: where each group meets its parent along the hinge line
    const groupOf = new Int16Array(alive.length).fill(-1)
    live.groups.forEach((g, gi) => g.faces.forEach((f) => (groupOf[f] = gi)))
    const adjStart = this.adjacency(alive)
    const spans: ([number, number] | null)[] = groups.map((g, gi) => {
      let lo = Infinity
      let hi = -Infinity
      for (const e of adjStart) {
        const ia = idx.get(e.a) as number
        const ib = idx.get(e.b) as number
        const ga = groupOf[ia]
        const gb = groupOf[ib]
        if (!((ga === gi && gb === g.parent) || (gb === gi && ga === g.parent))) continue
        const f = ga === gi ? ia : ib
        for (const q of [e.q1, e.q2]) {
          const p = apply(live.T[f], [q[0], q[1], 0])
          const rel = sub3(p, g.p3)
          const off = len3(sub3(rel, scale3(g.d3, dot3(rel, g.d3))))
          if (off > 1e-6) continue
          const sv = dot3(rel, g.d3)
          lo = Math.min(lo, sv)
          hi = Math.max(hi, sv)
        }
      }
      return hi - lo > 1e-6 ? [lo, hi] : null
    })
    // stack pivot: the inside of the crease. A flap turning up wraps around the
    // top of everything stacked along its hinge; one turning down, the bottom.
    live.groups.forEach((g, gi) => {
      if (!g.faces.length) return
      const zs = g.faces.map((fi) => live.o0[fi][2])
      const fi = g.faces[0]
      const c = centroid2(this.faces[alive[fi]].poly)
      const x0 = apply(live.T[fi], [c[0], c[1], 0])
      const up = apply(rotAxis(g.p, g.d, Math.sign(groups[gi].end) * 0.01), x0)[2] > x0[2]
      const sp = spans[gi]
      if (this.flat && sp && g.parent < 0) {
        for (let k = 0; k <= 16; k++) {
          const q = add3(groups[gi].p3, scale3(groups[gi].d3, sp[0] + ((sp[1] - sp[0]) * k) / 16))
          for (const id of this.facesAt(q[0], q[1], 1e-7)) zs.push((this.off.get(id) as V3)[2])
        }
      }
      g.h = up ? Math.max(...zs) : Math.min(...zs)
    })
    const rt = prepareStep(live, alive.length)

    // closure constraints: shared edges between faces that move differently
    const cls = (i: number) => rt.faceGroup[i]
    const deformed = (i: number) => rt.flexSign[i] !== 0 || rt.curlOf[i] >= 0
    const closures = this.adjacency(alive)
      .map((e) => ({ a: idx.get(e.a) as number, b: idx.get(e.b) as number, q1: e.q1, q2: e.q2 }))
      .filter((e) => cls(e.a) !== cls(e.b) || deformed(e.a) || deformed(e.b))

    const free = groups.map((g, i) => (g.free ? i : -1)).filter((i) => i >= 0)
    const drivenAt = (gi: number, t: number) => {
      const g = groups[gi]
      const u = g.window ? window01(t, g.window[0], g.window[1]) : t
      return g.end * (g.profile ? g.profile(u) : easeInOut(u))
    }
    const refAt = (gi: number, t: number) => {
      const g = groups[gi]
      return g.end * (g.ref ? g.ref(t) : easeInOut(t))
    }
    let reg = spec.reg ?? 0.02
    const handA = new Map<number, number>()
    const handoffAt = (gi: number, t: number) => {
      const g = groups[gi]
      const h = g.handoff as number
      const a0 = handA.get(gi) as number
      return a0 + (g.end - a0) * easeInOut((t - h) / (1 - h))
    }
    const handed = (gi: number, t: number) => groups[gi].handoff !== undefined && handA.has(gi) && t >= (groups[gi].handoff as number)

    const setAngles = (t: number, x: number[]) => {
      groups.forEach((_, gi) => {
        const fi = free.indexOf(gi)
        const a = handed(gi, t) ? handoffAt(gi, t) : fi >= 0 ? x[fi] : drivenAt(gi, t)
        live.groups[gi].a = [a, a]
      })
    }
    const residual = (t: number, x: number[]): number[] => {
      setAngles(t, x)
      const mats = groupMatrices(live, 0)
      const r: number[] = []
      for (const c of closures) {
        for (const q of [c.q1, c.q2]) {
          const pa = pointAt(live, rt, mats, c.a, q[0], q[1], t, false)
          const pb = pointAt(live, rt, mats, c.b, q[0], q[1], t, false)
          r.push(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2])
        }
      }
      const s = Math.sqrt(reg)
      free.forEach((gi, k) => r.push(s * (x[k] - refAt(gi, t))))
      return r
    }
    // regularised solve, then a polish with the pull nearly off so closure wins
    const solve = (t: number, x0: number[]) => {
      const r0 = reg
      const x1 = solveOnce(t, x0)
      reg = r0 * 1e-5
      const x2 = solveOnce(t, x1)
      reg = r0
      return x2
    }
    const solveOnce = (t: number, x0: number[]) => {
      let x = [...x0]
      if (!free.length) return x
      let mu = 1e-3
      let r = residual(t, x)
      let cost = r.reduce((s, v) => s + v * v, 0)
      for (let it = 0; it < 80; it++) {
        const J: number[][] = free.map((_, k) => {
          const xp = [...x]
          xp[k] += 1e-6
          const rp = residual(t, xp)
          return rp.map((v, i) => (v - r[i]) / 1e-6)
        })
        const n = free.length
        const A = Array.from({ length: n }, (_, i) =>
          Array.from({ length: n }, (_, j) => J[i].reduce((s, v, m) => s + v * J[j][m], 0))
        )
        const g = Array.from({ length: n }, (_, i) => J[i].reduce((s, v, m) => s + v * r[m], 0))
        let improved = false
        for (let tries = 0; tries < 8; tries++) {
          const M = A.map((row, i) => row.map((v, j) => v + (i === j ? mu * (1 + A[i][i]) : 0)))
          const dx = solveLinear(
            M,
            g.map((v) => -v)
          )
          const xn = x.map((v, i) => v + dx[i])
          const rn = residual(t, xn)
          const cn = rn.reduce((s, v) => s + v * v, 0)
          if (cn < cost) {
            x = xn
            r = rn
            mu = Math.max(mu / 3, 1e-9)
            improved = cost - cn > 1e-16
            cost = cn
            break
          }
          mu *= 4
        }
        if (!improved) break
      }
      return x
    }

    // sample the motion
    const samples: number[][] = groups.map(() => [])
    let x = free.map(() => 0)
    for (let s = 0; s <= SAMPLES; s++) {
      const t = s / SAMPLES
      free.forEach((gi, k) => {
        const g = groups[gi]
        if (g.handoff !== undefined && t >= g.handoff && !handA.has(gi)) handA.set(gi, x[k])
      })
      x = solve(t, x)
      if (s === SAMPLES) x = free.map((gi) => groups[gi].end)
      groups.forEach((_, gi) => {
        const fi = free.indexOf(gi)
        samples[gi].push(handed(gi, t) && s < SAMPLES ? handoffAt(gi, t) : fi >= 0 ? x[fi] : drivenAt(gi, t))
      })
    }
    live.groups.forEach((g, gi) => (g.a = samples[gi]))

    // measure tear (pure geometry) across the samples
    let maxTear = 0
    let tearAt = ""
    for (let s = 0; s <= SAMPLES; s++) {
      const t = s / SAMPLES
      const mats = groupMatrices(live, t)
      for (const c of closures)
        for (const q of [c.q1, c.q2]) {
          const pa = pointAt(live, rt, mats, c.a, q[0], q[1], t, false)
          const pb = pointAt(live, rt, mats, c.b, q[0], q[1], t, false)
          const tear = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2])
          if (tear > maxTear) {
            maxTear = tear
            tearAt = `faces ${alive[c.a]}/${alive[c.b]} at t=${t.toFixed(2)} q=${q.map((v) => v.toFixed(3))}`
          }
        }
    }

    // guide segments: the hinge spans, drawn on the top of the stack
    const guide: [V3, V3][] = []
    spans.forEach((sp, gi) => {
      if (!sp) return
      const g = groups[gi]
      const a = add3(g.p3, scale3(g.d3, sp[0]))
      const b = add3(g.p3, scale3(g.d3, sp[1]))
      const mid: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const top = this.flat
        ? Math.max(0, ...this.facesAt(mid[0], mid[1]).map((id) => (this.off.get(id) as V3)[2]))
        : 0
      guide.push([
        [a[0], a[1], a[2] + top + LAYER * 0.6],
        [b[0], b[1], b[2] + top + LAYER * 0.6],
      ])
    })

    // end transforms
    const matsEnd = groupMatrices(live, 1)
    const flatEnd =
      spec.flatEnd ??
      (this.flat &&
        groups.every((g) => {
          const k = g.end / Math.PI
          return Math.abs(k - Math.round(k)) < 1e-9 || isZRot(g.d3)
        }))
    const Tstart = new Map(alive.map((id) => [id, [...this.faces[id].T]]))
    const o0 = new Map(alive.map((id) => [id, [...(this.off.get(id) as V3)] as V3]))
    const newT = new Map<number, Mat>()
    alive.forEach((id, i) => {
      const g = cls(i)
      let T = g >= 0 ? mul(matsEnd[g], live.T[i]) : live.T[i]
      if (flatEnd) T = snapFlat(T)
      newT.set(id, T)
    })

    // stacking order from the direction of approach
    let order = this.order
    if (flatEnd) {
      order = spec.order ?? this.orderFromMotion(alive, idx, live, rt, newT, groups, free, x, solve)
    }

    const o1 = new Map<number, V3>()
    const oldNormals = new Map(alive.map((id) => [id, normalOf(this.faces[id].T)]))
    alive.forEach((id) => this.faces[id].T = newT.get(id) as Mat)
    this.order = order
    this.flat = flatEnd
    if (flatEnd) {
      const lv = this.levels()
      alive.forEach((id) => o1.set(id, [0, 0, (lv.get(id) as number) * LAYER]))
    } else {
      alive.forEach((id, i) => {
        const g = cls(i)
        const o = o0.get(id) as V3
        o1.set(id, g >= 0 ? pivotOffset(matsEnd[g], o, live.groups[g].h ?? 0) : o)
      })
    }
    void oldNormals
    alive.forEach((id) => this.off.set(id, o1.get(id) as V3))

    // crease memory: any shared edge that bends during the step
    const adjEnd = this.adjacency(alive)
    for (const tt of [0.5, 1]) {
      const mats = groupMatrices(live, tt)
      for (const e of adjEnd) {
        const ia = idx.get(e.a) as number
        const ib = idx.get(e.b) as number
        const Ma = cls(ia) >= 0 ? mul(mats[cls(ia)], live.T[ia]) : live.T[ia]
        const Mb = cls(ib) >= 0 ? mul(mats[cls(ib)], live.T[ib]) : live.T[ib]
        const na = normalOf(Ma)
        const nb = normalOf(Mb)
        if (dot3(na, nb) < 0.9995 || (tt === 1 && dot3(normalOf(Tstart.get(e.a) as Mat), normalOf(Tstart.get(e.b) as Mat)) < 0.9995)) {
          this.addCrease(e.q1, e.q2)
        }
      }
    }

    const rec: StepRecord = {
      meta,
      alive,
      T: Tstart,
      o0,
      o1,
      groups: groups.map((g, gi) => ({
        faces: g.faces,
        parent: g.parent,
        p: g.p3,
        d: g.d3,
        a: samples[gi],
        bend: g.bend,
        r: live.groups[gi].r,
        h: live.groups[gi].h,
      })),
      flex,
      curl: spec.curl,
      flatEnd,
      guide,
      creaseCount: this.creases.length,
      maxTear,
      tearAt,
    }
    this.records.push(rec)
    return rec
  }

  private addCrease(a: V2, b: V2) {
    const k = [a, b]
      .map((p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`)
      .sort()
      .join("|")
    if (this.creaseKeys.has(k)) return
    this.creaseKeys.add(k)
    this.creases.push({ a, b, step: this.records.length })
  }

  private orderFromMotion(
    alive: number[],
    idx: Map<number, number>,
    live: BakedStep,
    rt: ReturnType<typeof prepareStep>,
    newT: Map<number, Mat>,
    groups: { end: number; profile?: (u: number) => number; approach?: number }[],
    free: number[],
    xEnd: number[],
    solve: (t: number, x0: number[]) => number[]
  ): number[] {
    const prev = new Map(this.order.map((id, i) => [id, i]))
    // near-final configuration: every hinge a hair short of its end angle
    const DEL = 0.004
    const xs = solve(1 - DEL, xEnd)
    const saved = live.groups.map((g) => g.a)
    live.groups.forEach((g, gi) => {
      const fi = free.indexOf(gi)
      const G = groups[gi]
      const a = fi >= 0 ? xs[fi] : G.end * (G.approach ?? (G.profile ? G.profile(1 - DEL) : 1 - DEL))
      g.a = [a, a]
    })
    const mats = groupMatrices(live, 0)
    // height of the material of face i that ends up over world (x, y)
    const invEnd = alive.map((id) => inverse(newT.get(id) as Mat))
    const planeZ = (i: number, x: number, y: number) => {
      const c = apply(invEnd[i], [x, y, 0])
      return pointAt(live, rt, mats, i, c[0], c[1], 1 - DEL, false)[2]
    }

    const endPoly = new Map(
      alive.map((id) => {
        const f = this.faces[id]
        const T = newT.get(id) as Mat
        return [
          id,
          ccw(
            f.poly.map((p) => {
              const x = apply(T, [p[0], p[1], 0])
              return [x[0], x[1]] as V2
            })
          ),
        ]
      })
    )
    const cls = (id: number) => rt.faceGroup[idx.get(id) as number]
    const flips = (gi: number) => {
      const m = groupMatrices(live, 1)[gi]
      return m[8] < 0
    }
    const above = new Map<number, Set<number>>(alive.map((id) => [id, new Set()]))
    const n = alive.length
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const a = alive[i]
        const b = alive[j]
        const ov = clipPoly(endPoly.get(a) as V2[], endPoly.get(b) as V2[])
        if (ov.length < 3 || Math.abs(area2(ov)) < 1e-8) continue
        const ca = cls(a)
        const cb = cls(b)
        let aAbove: boolean
        const prevAbove = (prev.get(a) as number) > (prev.get(b) as number)
        if (ca === cb && !rt.flexSign[i] && !rt.flexSign[j]) {
          aAbove = ca >= 0 && flips(ca) ? !prevAbove : prevAbove
        } else {
          const c = centroid2(ov)
          const pts: V2[] = [c, ...ov.map((p) => [c[0] + (p[0] - c[0]) * 0.7, c[1] + (p[1] - c[1]) * 0.7] as V2)]
          let dz = 0
          for (const p of pts) {
            const za = planeZ(i, p[0], p[1])
            const zb = planeZ(j, p[0], p[1])
            if (za !== null && zb !== null) dz += za - zb
          }
          if (Math.abs(dz) < 1e-9) {
            // no separation: same rigid motion, keep previous relation (flipped if both flipped)
            const flipped = ca >= 0 && flips(ca)
            aAbove = flipped ? !prevAbove : prevAbove
          } else aAbove = dz > 0
        }
        if (aAbove) (above.get(b) as Set<number>).add(a)
        else (above.get(a) as Set<number>).add(b)
      }
    live.groups.forEach((g, gi) => (g.a = saved[gi]))
    // Kahn's algorithm, ties broken by previous order (moved faces by their new height)
    const indeg = new Map(alive.map((id) => [id, 0]))
    for (const [, s] of above) for (const x of s) indeg.set(x, (indeg.get(x) as number) + 1)
    const ready = alive.filter((id) => indeg.get(id) === 0)
    const out: number[] = []
    const key = (id: number) => prev.get(id) as number
    while (ready.length) {
      ready.sort((p, q) => key(q) - key(p))
      const id = ready.pop() as number
      out.push(id)
      for (const x of above.get(id) as Set<number>) {
        indeg.set(x, (indeg.get(x) as number) - 1)
        if (indeg.get(x) === 0) ready.push(x)
      }
    }
    if (out.length !== alive.length) throw new Error("stacking order has a cycle")
    return out
  }

  /** Height level of each face: longest chain of overlapping faces beneath it. */
  levels(): Map<number, number> {
    const polys = new Map(this.alive.map((id) => [id, this.worldPoly(id)]))
    const lv = new Map<number, number>()
    const placed: number[] = []
    for (const id of this.order) {
      let l = 0
      const p = polys.get(id) as V2[]
      for (const q of placed) {
        const ov = clipPoly(p, polys.get(q) as V2[])
        if (ov.length >= 3 && Math.abs(area2(ov)) > 1e-8) l = Math.max(l, (lv.get(q) as number) + 1)
      }
      lv.set(id, l)
      placed.push(id)
    }
    return lv
  }

  /** Simple helpers that build common steps. */
  hingeSign(L: Line2, faces: number[]) {
    const c = centroid2(this.worldPoly(faces[0]))
    return Math.sign(sideOf(L, c)) || 1
  }
}

function isZRot(d: V3) {
  return Math.abs(Math.abs(d[2]) - 1) < 1e-9
}

function sharedEdge(A: V2[], B: V2[]): [V2, V2] | null {
  for (let i = 0; i < A.length; i++) {
    const a1 = A[i]
    const a2 = A[(i + 1) % A.length]
    const da = sub2(a2, a1)
    const la = Math.hypot(da[0], da[1])
    for (let j = 0; j < B.length; j++) {
      const b1 = B[j]
      const b2 = B[(j + 1) % B.length]
      if (Math.abs(cross2(da, sub2(b1, a1))) / la > 1e-7) continue
      if (Math.abs(cross2(da, sub2(b2, a1))) / la > 1e-7) continue
      const t1 = dot2(sub2(b1, a1), da) / (la * la)
      const t2 = dot2(sub2(b2, a1), da) / (la * la)
      const lo = Math.max(0, Math.min(t1, t2))
      const hi = Math.min(1, Math.max(t1, t2))
      if ((hi - lo) * la > 1e-7) {
        return [
          [a1[0] + da[0] * lo, a1[1] + da[1] * lo],
          [a1[0] + da[0] * hi, a1[1] + da[1] * hi],
        ]
      }
    }
  }
  return null
}

function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((r, i) => [...r, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    const d = M[c][c] || 1e-12
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / d
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((r, i) => r[n] / (M[i][i] || 1e-12))
}

export { dist2, rotAxis, norm3 }
