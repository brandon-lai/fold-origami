import { Model, thereAndBack } from "@/lib/fold/ops"
import type { GroupSpec } from "@/lib/fold/engine"
import { centroid2, easeInOut, sideOf, type V2, type V3 } from "@/lib/fold/math"

const PI = Math.PI
const R = Math.SQRT1_2 / 2 // 0.3536: half-width of the blintzed square
const Q = R / 2 // 0.1768: wall height and half the floor

/**
 * Masu box. Blintz, crease the walls, open two flaps, raise the walls (the
 * corners fold in as gussets) and lock each end by folding its flap over the
 * wall into the box.
 */
export function masu() {
  const m = new Model(
    {
      slug: "masu-box",
      title: "Masu box",
      level: "Beginner",
      difficulty: 2,
      minutes: 8,
      paper: "15 cm square, colour side down",
      technique: "Blintz fold, opening flat paper into 3D",
      blurb: "A square measuring box with no glue. The first model that stands up off the table.",
      next: "jumping-frog",
    },
    { rotate: PI / 4 }
  )
  const e = m.e
  // 1–2 crease the diagonals of the diamond (the paper's book folds) to find the centre
  m.fold(
    {
      title: "Fold in half and unfold",
      text: "Fold the paper in half edge to edge, then open it again.",
      fold: "Valley fold",
      tip: "fold toward you, crease firmly, then unfold",
      camera: { elevation: 62 },
    },
    { p: [0, 0], d: [Math.SQRT1_2, Math.SQRT1_2] },
    { all: true },
    "valley",
    true
  )
  m.fold(
    {
      title: "Fold in half the other way",
      text: "Fold in half the other way and unfold. The creases cross at the centre.",
      fold: "Valley fold",
      tip: "fold toward you, crease firmly, then unfold",
    },
    { p: [0, 0], d: [-Math.SQRT1_2, Math.SQRT1_2] },
    { all: true },
    "valley",
    true
  )
  // 3 blintz: all four corners to the centre
  const D = Math.SQRT1_2
  const corners: { L: { p: V2; d: V2 }; seed: V2 }[] = [
    { L: { p: [0, R], d: [-1, 0] }, seed: [0, D - 0.05] },
    { L: { p: [0, -R], d: [1, 0] }, seed: [0, -D + 0.05] },
    { L: { p: [R, 0], d: [0, 1] }, seed: [D - 0.05, 0] },
    { L: { p: [-R, 0], d: [0, -1] }, seed: [-D + 0.05, 0] },
  ]
  corners.forEach(({ L }) => e.side(L, -1))
  const blintz = corners.map(({ L }) => {
    const faces = e.byWorld((c) => sideOf(L, c) < -1e-9)
    return m.hinge(L, faces, "valley", { bend: 0.12 })
  })
  const blintzRec = m.step(
    {
      title: "Fold the corners to the centre",
      text: "Fold all four corners in so their points meet at the centre.",
      fold: "Blintz fold",
      tip: "fold every corner to the centre, making a smaller square",
      duration: 2,
    },
    { groups: blintz, flatEnd: true }
  )
  // 4–5 crease the walls: each edge to the centre and back, through all layers
  const edgeFold = (title: string, text: string, lines: { p: V2; d: V2 }[]) => {
    lines.forEach((L) => e.side(L, -1))
    const groups: GroupSpec[] = lines.map((L) => ({
      ...m.hinge(L, e.byWorld((c) => sideOf(L, c) < -1e-9), "valley"),
      profile: thereAndBack,
      bend: 0.08,
    }))
    m.step({ title, text, fold: "Valley fold", tip: "fold toward you, crease firmly, then unfold", duration: 2.6 }, { groups, flatEnd: true })
  }
  edgeFold("Crease the top and bottom", "Fold the top and bottom edges to the centre line, then unfold.", [
    { p: [0, Q], d: [-1, 0] },
    { p: [0, -Q], d: [1, 0] },
  ])
  edgeFold("Crease the sides", "Fold the left and right edges to the centre line, then unfold.", [
    { p: [Q, 0], d: [0, 1] },
    { p: [-Q, 0], d: [0, -1] },
  ])
  // 6 open the top and bottom corners again
  const [gTop, gBot] = blintzRec.groups
  m.step(
    {
      title: "Open two corners",
      text: "Unfold the top and bottom corners so their points stick out again.",
      fold: "Unfold",
      tip: "open a fold you made earlier; the crease stays",
      duration: 1.8,
      camera: { elevation: 64 },
    },
    {
      groups: [
        { faces: e.descendants(gTop.faces), p: [0, R], d: [-1, 0], end: -gTop.a[gTop.a.length - 1] },
        { faces: e.descendants(gBot.faces), p: [0, -R], d: [1, 0], end: -gBot.a[gBot.a.length - 1] },
      ],
      flatEnd: true,
    }
  )

  // 7 raise the walls. Pieces by where their material sits now (flat).
  const at = (pred: (c: V2) => boolean) => e.byWorld((c) => pred(c))
  const inSide = (c: V2, s: number) => s * c[0] > Q && Math.abs(c[1]) < Q
  const inEnd = (c: V2, s: number) => Math.abs(c[0]) < Q && s * c[1] > Q
  // corner cell halves: B touches the end wall, A (with the side flap on it) the side wall
  const inCorner = (c: V2, sx: number, sy: number) => sx * c[0] > Q && sy * c[1] > Q && sx * c[0] < R + 1e-9 && sy * c[1] < R + 1e-9
  const isA = (c: V2, sx: number, sy: number) => inCorner(c, sx, sy) && sx * c[0] - Q > sy * c[1] - Q
  const isB = (c: V2, sx: number, sy: number) => inCorner(c, sx, sy) && sx * c[0] - Q < sy * c[1] - Q
  // end flaps beyond the wall top, split into the middle and the corners (which ride with B)
  const flapMid = (c: V2, s: number) => s * c[1] > R && Math.abs(c[0]) < Q
  const flapCorner = (c: V2, sx: number, sy: number) => sy * c[1] > R && sx * c[0] > Q

  const sideGroup = (s: number): GroupSpec => {
    const faces = at((c) => inSide(c, s))
    const L = { p: [s * Q, 0] as V2, d: [0, s] as V2 }
    return { faces, p: L.p, d: L.d, end: (-PI / 2) * 1, profile: easeInOut }
  }
  const endGroup = (s: number): GroupSpec => {
    const faces = at((c) => inEnd(c, s) || flapMid(c, s))
    const L = { p: [0, s * Q] as V2, d: [s, 0] as V2 }
    return { faces, p: L.p, d: L.d, end: PI / 2 }
  }
  const groups: GroupSpec[] = [sideGroup(1), sideGroup(-1), endGroup(1), endGroup(-1)]
  // gussets
  for (const sx of [1, -1])
    for (const sy of [1, -1]) {
      const sideIdx = sx === 1 ? 0 : 1
      const endIdx = sy === 1 ? 2 : 3
      const Bf = at((c) => isB(c, sx, sy) || flapCorner(c, sx, sy))
      const Af = at((c) => isA(c, sx, sy))
      // B folds 180° in against the inside of the end wall, about the corner line x = ±Q
      const Lb = { p: [sx * Q, 0] as V2, d: [0, sx] as V2 }
      groups.push({ faces: Bf, parent: endIdx, p: Lb.p, d: Lb.d, end: -PI, free: true })
      // A follows, hinged to the side wall along y = ±Q
      const La = { p: [0, sy * Q] as V2, d: [sy, 0] as V2 }
      groups.push({
        faces: Af,
        parent: sideIdx,
        p: La.p,
        d: La.d,
        end: Number.NaN,
        free: true,
        ref: (t: number) => (PI / 2) * easeInOut(t),
      })
    }
  void centroid2
  // where the end-flap creases are, in paper coordinates, while still flat
  const cpTopWall = [e.cpAt(-Q * 0.5, R, 0), e.cpAt(Q * 0.5, R, 0)]
  const cpTopFloor = [e.cpAt(-Q * 0.5, R + Q, 0), e.cpAt(Q * 0.5, R + Q, 0)]
  const cpBotWall = [e.cpAt(-Q * 0.5, -R, 0), e.cpAt(Q * 0.5, -R, 0)]
  const cpBotFloor = [e.cpAt(-Q * 0.5, -R - Q, 0), e.cpAt(Q * 0.5, -R - Q, 0)]
  const topFlap = at((c) => c[1] > R)
  const bottomFlap = at((c) => c[1] < -R)
  const topTip = at((c) => c[1] > R + Q)
  const bottomTip = at((c) => c[1] < -R - Q)

  m.step(
    {
      title: "Raise the walls",
      text: "Lift the sides and ends up straight; the corners fold in on their creases.",
      fold: "Collapse",
      tip: "let the paper fold along creases you already made",
      duration: 3.2,
      camera: { elevation: 34, azimuth: 24, zoom: 1.05 },
    },
    { groups, flatEnd: false, reg: 0.002 }
  )

  // 8–9 lock each end: the flap folds over the wall top, down the inside, onto the floor
  const lock = (title: string, text: string, flap: number[], tip: number[], wall: V2[], floor: V2[]) => {
    const w0 = e.cp3(...wall[0])
    const w1 = e.cp3(...wall[1])
    const f0 = e.cp3(...floor[0])
    const f1 = e.cp3(...floor[1])
    const dw: V3 = [w1[0] - w0[0], w1[1] - w0[1], w1[2] - w0[2]]
    const df: V3 = [f1[0] - f0[0], f1[1] - f0[1], f1[2] - f0[2]]
    // fold inward: test which sign brings the flap's far point toward the box centre
    const probe = tip[0]
    void probe
    const upper = flap.filter((f) => !tip.includes(f))
    const signs = [1, -1]
    const box = e.bbox()
    let best = 1
    let bestD = Infinity
    for (const sg of signs) {
      const c = centroid2(e.face(upper[0]).poly)
      const p = e.faces[upper[0]].T
      const x = [p[0] * c[0] + p[1] * c[1] + p[9], p[3] * c[0] + p[4] * c[1] + p[10], p[6] * c[0] + p[7] * c[1] + p[11]]
      // rotate a little and see whether it moves toward the box centre
      const ang = sg * 0.3
      const n = Math.hypot(...dw)
      const u = [dw[0] / n, dw[1] / n, dw[2] / n]
      const r = [x[0] - w0[0], x[1] - w0[1], x[2] - w0[2]]
      const cr = [u[1] * r[2] - u[2] * r[1], u[2] * r[0] - u[0] * r[2], u[0] * r[1] - u[1] * r[0]]
      const dot = u[0] * r[0] + u[1] * r[1] + u[2] * r[2]
      const rr = r.map((v, i) => v * Math.cos(ang) + cr[i] * Math.sin(ang) + u[i] * dot * (1 - Math.cos(ang)))
      const q = [w0[0] + rr[0], w0[1] + rr[1], w0[2] + rr[2]]
      const d = Math.hypot(q[0] - box.cx, q[1] - box.cy)
      if (d < bestD) {
        bestD = d
        best = sg
      }
    }
    m.step(
      { title, text, fold: "Lock fold", tip: "fold a flap over a wall so it holds the box together", duration: 2.6, camera: { elevation: 42, azimuth: 20 } },
      {
        groups: [
          { faces: upper, p: w0, d: dw, end: best * PI },
          { faces: tip, parent: 0, p: f0, d: df, end: -best * (PI / 2) },
        ],
        flatEnd: false,
        reg: 0.01,
      }
    )
  }
  lock("Lock the top end", "Fold the top flap over the wall and down inside, so its point lies on the floor.", topFlap, topTip, cpTopWall, cpTopFloor)
  lock("Lock the bottom end", "Do the same at the other end. The box holds itself together.", bottomFlap, bottomTip, cpBotWall, cpBotFloor)
  return m
}
