import { Model } from "@/lib/fold/ops"
import type { GroupSpec } from "@/lib/fold/engine"
import { bisector, centroid2, easeInOut, sideOf, type V2 } from "@/lib/fold/math"

const PI = Math.PI

/** Traditional jumping frog from a half sheet (2:1). Press its back and it hops. */
export function frog() {
  const m = new Model(
    {
      slug: "jumping-frog",
      title: "Jumping frog",
      level: "Beginner",
      difficulty: 2,
      minutes: 8,
      paper: "7.5 × 15 cm (half a square), colour side down",
      technique: "Pleats, folding through layers",
      blurb: "A waterbomb collapse, two legs and a spring-loaded pleat. Press its back and it jumps.",
      next: "square-base",
    },
    { w: 0.5, h: 1 }
  )
  const e = m.e
  // paper spans x ∈ [-.25, .25], y ∈ [-.5, .5]; the top square is y ∈ [0, .5]
  const A: V2 = [-0.25, 0]
  const B: V2 = [0.25, 0]
  const TL: V2 = [-0.25, 0.5]
  const TR: V2 = [0.25, 0.5]
  m.fold(
    {
      title: "Crease a diagonal",
      text: "Fold the top right corner down to the left edge, then unfold.",
      fold: "Valley fold",
      tip: "fold toward you, crease firmly, then unfold",
      camera: { elevation: 60 },
    },
    { p: TL, d: [B[0] - TL[0], B[1] - TL[1]] },
    { all: true, sign: 1 },
    "valley",
    true
  )
  m.fold(
    {
      title: "Crease the other diagonal",
      text: "Fold the top left corner down to the right edge, then unfold.",
      fold: "Valley fold",
      tip: "fold toward you, crease firmly, then unfold",
    },
    { p: A, d: [TR[0] - A[0], TR[1] - A[1]] },
    { all: true, sign: 1 },
    "valley",
    true
  )
  m.turnOver()
  m.fold(
    {
      title: "Crease across",
      text: "Fold the top edge down to where the diagonals end, then unfold.",
      fold: "Valley fold",
      tip: "fold toward you, crease firmly, then unfold",
    },
    { p: [0, 0.25], d: [1, 0] },
    { all: true, sign: 1 },
    "valley",
    true
  )
  // the turn-over flipped x; the crease points are symmetric so the geometry holds
  m.turnOver({ text: "Turn the paper back over." })

  // collapse the top square into a waterbomb (triangle) on its creases
  const c: V2 = [0, 0.25]
  const angOf = (p: V2) => Math.atan2(p[1] - c[1], p[0] - c[0])
  const pieceAt = (lo: number, hi: number) =>
    e.byWorld((q) => {
      if (q[1] < 0) return false
      const a = angOf(q)
      return a > lo && a < hi
    })
  // rays from c (radians): to B (-45°), right mid (0°), TR (45°), TL (135°), left mid (180°), A (-135°)
  const rays: Record<string, V2> = {
    B: [B[0] - c[0], B[1] - c[1]],
    R: [1, 0],
    TR: [TR[0] - c[0], TR[1] - c[1]],
    TL: [TL[0] - c[0], TL[1] - c[1]],
    L: [-1, 0],
    A: [A[0] - c[0], A[1] - c[1]],
  }
  const d = PI / 180
  const pieces = {
    LL: pieceAt(-180 * d, -135 * d),
    LU: pieceAt(135 * d, 180 * d),
    T: pieceAt(45 * d, 135 * d),
    RU: pieceAt(0, 45 * d),
    RL: pieceAt(-45 * d, 0),
  }
  const chain: [keyof typeof pieces, V2, "valley" | "mountain"][] = [
    ["LL", rays.A, "valley"],
    ["LU", rays.L, "mountain"],
    ["T", rays.TL, "valley"],
    ["RU", rays.TR, "valley"],
    ["RL", rays.R, "mountain"],
  ]
  const groups: GroupSpec[] = chain.map(([k, ray, kind], i) => {
    const faces = pieces[k]
    const s = Math.sign(sideOf({ p: c, d: ray }, centroid2(e.worldPoly(faces[0])))) || 1
    return {
      faces,
      parent: i - 1,
      p: c,
      d: ray,
      end: (kind === "valley" ? 1 : -1) * s * PI,
      free: i > 0,
      ref: (t: number) => easeInOut(t),
    }
  })
  m.step(
    {
      title: "Collapse the top",
      text: "Push the sides of the top square in so it flattens into a triangle.",
      fold: "Waterbomb collapse",
      tip: "let the paper fold along creases you already made",
      duration: 3,
      camera: { elevation: 42 },
    },
    { groups, flatEnd: true, reg: 0.002 }
  )

  // front legs: the triangle's bottom corners of the top layer up to its point
  const apex: V2 = [0, 0.25]
  const legs: GroupSpec[] = []
  for (const s of [-1, 1]) {
    const corner: V2 = [s * 0.25, 0]
    const L = bisector(corner, apex)
    const faces = e.flap([s * 0.2, 0.02], 0, L, 1)
    legs.push(m.hinge(L, faces, "valley", { bend: 0.1 }))
  }
  m.step(
    {
      title: "Fold the front legs",
      text: "Fold the bottom corners of the top layer up to the triangle’s point.",
      fold: "Valley fold",
      tip: "fold toward you so the corner meets the point",
      camera: { elevation: 56 },
    },
    { groups: legs, flatEnd: true }
  )

  // sides to the centre, through the body below the triangle
  const sides: GroupSpec[] = []
  for (const s of [-1, 1]) {
    const L = { p: [s * 0.125, 0] as V2, d: [0, s] as V2 }
    const faces = e.flap([s * 0.2, -0.3], 0, L, -1)
    sides.push(m.hinge(L, faces, "valley", { bend: 0.1 }))
  }
  m.step(
    {
      title: "Fold the sides in",
      text: "Fold the long edges of the body in to the centre line.",
      fold: "Valley fold",
      tip: "fold toward you so the edges meet in the middle",
    },
    { groups: sides, flatEnd: true }
  )
  // spring: fold the bottom up, then half of it back down (a pleat)
  const up = { p: [0, -0.25] as V2, d: [-1, 0] as V2 }
  m.fold(
    {
      title: "Fold the bottom up",
      text: "Fold the bottom edge up to the base of the triangle.",
      fold: "Valley fold",
      tip: "fold toward you, through all the layers",
    },
    up,
    { all: true, sign: 1 }
  )
  const down = { p: [0, -0.125] as V2, d: [1, 0] as V2 }
  const pleatRec = m.fold(
    {
      title: "Fold it back down",
      text: "Fold the same flap back down in half. This pleat is the frog’s spring.",
      fold: "Pleat",
      tip: "a valley and a mountain side by side make a pleat",
    },
    down,
    { seed: [0.05, -0.05], depth: 0, sign: 1 }
  )
  m.turnOver({ title: "Turn it over", text: "Turn the frog over so the triangle head is on top." })
  // the spring: let the pleat open a little so the frog sits up on it
  // opening reverses the pleat fold; the turn-over mirrored its axis, so the sign stays positive
  const sg = 1
  m.step(
    {
      title: "Ready to jump",
      text: "Let the pleat spring open. Press the back of the frog and slide your finger off: it jumps.",
      fold: "Shaping",
      tip: "the last touch: bend flaps to give the model its form",
      duration: 2,
      camera: { elevation: 18, azimuth: 60, zoom: 1.1 },
    },
    {
      groups: [{ faces: e.descendants(pleatRec.groups[0].faces), p: [0, -0.125], d: [1, 0], end: sg * 0.75 }],
      flatEnd: false,
    }
  )
  return m
}
