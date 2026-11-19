// Shared sequences: the square (preliminary) base and the bird base.
// The paper starts as a diamond, colour side down, so the finished models are
// colour side out.

import type { Model } from "@/lib/fold/ops"
import type { GroupSpec } from "@/lib/fold/engine"
import { type V2, centroid2, easeInOut, norm2, sideOf, sub2 } from "@/lib/fold/math"
export { D }

const PI = Math.PI
const D = Math.SQRT1_2 // half-diagonal of the unit square
const H = D / 2 // midpoint offset along each axis

/** angle of a world point about the origin, in [0, 2π) */
const angOf = (p: V2) => {
  const a = Math.atan2(p[1], p[0])
  return a < 0 ? a + 2 * PI : a
}

export function squareBase(m: Model, opts: { prefix?: boolean } = {}) {
  const e = m.e
  void opts
  // book folds lie on the diagonals of the diamond; diagonals of the square are the axes
  const book1 = { p: [0, 0] as V2, d: norm2([1, 1]) as V2 }
  const book2 = { p: [0, 0] as V2, d: norm2([-1, 1]) as V2 }
  m.fold(
    {
      title: "Fold in half and unfold",
      text: "Fold the paper in half edge to edge, then open it again.",
      fold: "Valley fold",
      tip: "fold toward you, crease firmly, then unfold",
      camera: { elevation: 60 },
    },
    book1,
    { all: true },
    "valley",
    true
  )
  m.fold(
    {
      title: "Fold in half the other way",
      text: "Fold in half the other way, edge to edge, and unfold.",
      fold: "Valley fold",
      tip: "fold toward you, crease firmly, then unfold",
    },
    book2,
    { all: true },
    "valley",
    true
  )
  m.turnOver({ text: "Turn the paper over so the colour faces up." })
  m.fold(
    {
      title: "Fold corner to corner",
      text: "Fold the bottom corner up to the top corner, then unfold.",
      fold: "Valley fold",
      tip: "fold toward you, crease firmly, then unfold",
    },
    { p: [0, 0], d: [-1, 0] },
    { all: true },
    "valley",
    true
  )
  m.fold(
    {
      title: "Fold the other diagonal",
      text: "Fold the left corner to the right corner, then unfold.",
      fold: "Valley fold",
      tip: "fold toward you, crease firmly, then unfold",
    },
    { p: [0, 0], d: [0, 1] },
    { all: true },
    "valley",
    true
  )

  // Collapse. Eight triangles around the centre; T1 (bottom-right of the bottom
  // quadrant) stays on the table, the rest turn about the creases in a chain
  // around the centre and the solver keeps the last crease joined.
  const tri = (a0: number) =>
    e.byWorld((c) => {
      const a = angOf(c)
      const d = a - a0
      return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < PI / 8
    })
  // triangle centred at angle k·45° + 22.5° (k = 0..7), going counter-clockwise from +x
  const T = (k: number) => tri(((((k % 8) + 8) % 8) * PI) / 4 + PI / 8)
  // creases from the centre: k·45°; even k are diamond corners? (diamond: corners on axes)
  const ray = (k: number): V2 => [Math.cos((k * PI) / 4), Math.sin((k * PI) / 4)]
  // In the diamond, the axes (k even) run to corners: those are the diagonals (valley).
  // The 45° rays (k odd) run to edge midpoints: the book folds (mountain from this side).
  // Bottom corner is at k = 6 (−90°). Root: triangle between rays 6 and 7 (T(6)).
  const order = [7, 0, 1, 2, 3, 4, 5] // children going counter-clockwise from the root
  const groups: GroupSpec[] = []
  let parentFaces = T(6)
  order.forEach((k, i) => {
    const faces = T(k)
    // hinge between triangle k-1 and k is ray k
    const d = ray(k)
    const childC = centroid2(e.worldPoly(faces[0]))
    const left = sideOf({ p: [0, 0], d }, childC) > 0 ? 1 : -1
    const valley = k % 2 === 0
    // the two diagonals that end flat: the bottom (k=6, closure) and the top (k=2)
    const end = k === 2 ? 0 : (valley ? 1 : -1) * left * PI
    groups.push({
      faces,
      parent: i === 0 ? -1 : i - 1,
      p: [0, 0],
      d,
      end,
      free: i !== 0,
      ref:
        k === 2
          ? undefined
          : (t: number) => easeInOut(t),
    })
    parentFaces = faces
  })
  void parentFaces
  void sub2
  void H
  void D
  m.step(
    {
      title: "Collapse into a square base",
      text: "Bring the side corners down to the bottom corner and flatten into a small square.",
      fold: "Collapse",
      tip: "let the paper fold along creases you already made",
      duration: 3,
      camera: { elevation: 40, zoom: 1.1 },
    },
    { groups, flatEnd: true, reg: 0.002 }
  )
}

// ------------------------------------------------------------------ bird base
// Square base geometry: closed point O at (0,0), open point C at (0,-D),
// side points at (±H,-H). Kite creases run from C to K = (±k, -k).
const KK = D - 0.5 // = 0.2071: where an edge folded to the centre line meets the side
export const K_R: V2 = [KK, -KK]
export const K_L: V2 = [-KK, -KK]
export const C_PT: V2 = [0, -D]
export const kiteR = (): { p: V2; d: V2 } => ({ p: C_PT, d: norm2(sub2(K_R, C_PT)) })
export const kiteL = (): { p: V2; d: V2 } => ({ p: C_PT, d: norm2(sub2(K_L, C_PT)) })
export const hLine = (): { p: V2; d: V2 } => ({ p: [0, -KK], d: [1, 0] })

/** Split the faces stacked at `pts` (top `depth` layers) by each line. */
export function splitAt(m: Model, pts: V2[], depth: number, lines: { p: V2; d: V2 }[]) {
  const e = m.e
  for (const L of lines) {
    const ids = new Set<number>()
    for (const p of pts) e.facesAt(p[0], p[1]).slice(0, depth).forEach((id) => ids.add(id))
    for (const id of ids) e.split(id, L)
  }
}

/** a free hinge group whose sign comes from the child's side of the line */
export function hingeOf(
  m: Model,
  L: { p: V2; d: V2 },
  faces: number[],
  kind: "valley" | "mountain",
  extra: Partial<GroupSpec> = {}
): GroupSpec {
  const s = m.e.hingeSign(L, faces)
  return { faces, p: L.p, d: L.d, end: (kind === "valley" ? 1 : -1) * s * PI, ...extra }
}

export function kiteFolds(m: Model) {
  const e = m.e
  m.fold(
    {
      title: "Fold the right edge to the centre",
      text: "Fold the lower right edge of the top layer to the centre line.",
      fold: "Valley fold",
      tip: "fold toward you so the edge lies on the centre line",
      camera: { elevation: 64 },
    },
    kiteR(),
    { seed: [0.25, -0.4], depth: 0, sign: -1 }
  )
  void e
  m.fold(
    {
      title: "Fold the left edge to the centre",
      text: "Fold the lower left edge of the top layer to the centre line.",
      fold: "Valley fold",
      tip: "fold toward you so the edge lies on the centre line",
    },
    kiteL(),
    { seed: [-0.25, -0.4], depth: 0, sign: 1 }
  )
}

/**
 * Petal fold on the current front: the top layer below the kite line lifts
 * up while its sides fold in along the kite creases. One driven hinge, four
 * free ones held together by the solver.
 */
export function petalFold(m: Model, meta: { title: string; text: string }) {
  const e = m.e
  const sideR: V2 = [0.187, -0.423]
  const sideL: V2 = [-0.187, -0.423]
  const mid: V2[] = [
    [0.05, -0.35],
    [-0.05, -0.35],
  ]
  // crease the top two layers where needed (no-op if pre-creased)
  splitAt(m, [sideR, sideL, ...mid, [0.03, -0.1]], 2, [kiteR(), kiteL(), hLine()])
  const top = (p: V2, d = 0) => e.facesAt(p[0], p[1])[d]
  const centre = [...new Set(mid.map((p) => top(p)))]
  const h = hLine()
  // Driving the flap directly hits a singular point near flat (the rigid sides
  // snap in); driving the sides instead gives a smooth path the flap follows.
  const gC = hingeOf(m, h, centre, "valley", { free: true })
  const groups: GroupSpec[] = [gC]
  for (const [p, L] of [
    [sideR, kiteR()],
    [sideL, kiteL()],
  ] as const) {
    const outer = top(p, 0)
    const inner = top(p, 1)
    groups.push(hingeOf(m, L, [outer], "mountain", { parent: 0, free: true }))
    groups.push(hingeOf(m, L, [inner], "valley"))
  }
  m.step(
    {
      title: meta.title,
      text: meta.text,
      fold: "Petal fold",
      tip: "lift one layer and let its sides fold in along creases",
      duration: 3,
      camera: { elevation: 38, zoom: 1.05 },
    },
    { groups, flatEnd: true, reg: 0.002 }
  )
}

/** Kite folds, top fold, unfold, petal fold: one side of the bird base. */
export function birdBaseFront(m: Model) {
  const e = m.e
  kiteFolds(m)
  const h = hLine()
  m.fold(
    {
      title: "Fold the top down",
      text: "Fold the top triangle down over the flaps and crease firmly.",
      fold: "Valley fold",
      tip: "fold toward you along the top of the side flaps",
    },
    h,
    { seed: [0.03, -0.1], depth: 0, sign: 1 }
  )
  // unfold the three folds: the top first, then both side flaps
  const lastTop = e.records[e.records.length - 1]
  const kR = e.records[e.records.length - 3]
  const kL = e.records[e.records.length - 2]
  const groups: GroupSpec[] = [
    { faces: lastTop.groups[0].faces, p: h.p, d: h.d, end: -lastTop.groups[0].a.at(-1)!, window: [0, 0.5] },
    { faces: kR.groups[0].faces, p: kiteR().p, d: kiteR().d, end: -kR.groups[0].a.at(-1)!, window: [0.5, 1] },
    { faces: kL.groups[0].faces, p: kiteL().p, d: kiteL().d, end: -kL.groups[0].a.at(-1)!, window: [0.5, 1] },
  ]
  m.step(
    {
      title: "Unfold the three folds",
      text: "Unfold the top triangle and the two side flaps.",
      fold: "Unfold",
      tip: "open the last three folds; the creases stay",
      duration: 2.4,
    },
    { groups, flatEnd: true }
  )
  petalFold(m, {
    title: "Petal fold",
    text: "Lift the bottom corner of the top layer up and let the sides fold in to the centre.",
  })
}
