import { Model, thereAndBack } from "@/lib/fold/ops"
import { bisector, ccw, centroid2, easeInOut, norm2, pointInPoly, type V2 } from "@/lib/fold/math"

/** Traditional paper cup. Paper starts as a diamond, colour side down. */
export function cup() {
  const m = new Model(
    {
      slug: "paper-cup",
      title: "Paper cup",
      level: "Beginner",
      difficulty: 1,
      minutes: 4,
      paper: "15 cm square, colour side down",
      technique: "Valley folds, tucking a flap",
      blurb: "Six folds and a pocket. The first model everyone should make.",
      next: "masu-box",
    },
    { rotate: Math.PI / 4 }
  )
  const e = m.e
  const s = Math.SQRT1_2
  // 1 — diagonal
  const half = { p: [0, 0] as V2, d: [-1, 0] as V2 }
  m.fold(
    {
      title: "Fold in half",
      text: "Fold the bottom corner up to the top corner.",
      fold: "Valley fold",
      tip: "fold the paper toward you so a valley forms",
      camera: { elevation: 58 },
    },
    half,
    { all: true }
  )
  // 2 — right corner to the left edge, top edge level
  const R: V2 = [s, 0]
  const P: V2 = [-(Math.SQRT2 - 1) * s, (2 - Math.SQRT2) * s]
  m.fold(
    {
      title: "Fold the right corner across",
      text: "Fold the right corner to the left edge so its top edge lies level.",
      fold: "Valley fold",
      tip: "fold the paper toward you so a valley forms",
    },
    bisector(R, P),
    { all: true }
  )
  // 3 — left corner to the right
  const Lc: V2 = [-s, 0]
  const P2: V2 = [(Math.SQRT2 - 1) * s, (2 - Math.SQRT2) * s]
  m.fold(
    {
      title: "Fold the left corner across",
      text: "Fold the left corner over to meet the end of the first flap.",
      fold: "Valley fold",
      tip: "fold the paper toward you so a valley forms",
    },
    bisector(Lc, P2),
    { all: true }
  )
  // 4 — tuck the front point into the pocket of the top flap
  const y = (2 - Math.SQRT2) * s
  const top = { p: [0, y] as V2, d: [1, 0] as V2 }
  const apex = e.flap([0, y + 0.1], 0, top, 1)
  const C3x = -((Math.SQRT2 - 1) ** 2) * s
  // the top flap (the left corner, both layers) lifts on its own crease while the point goes under it
  const crease3 = { p: P, d: [C3x - P[0], -P[1]] as V2 }
  const flapFaces = e.byWorld((c) => pointInPoly(ccw([[C3x, 0], P2, P]), c) && e.facesAt(c[0], c[1]).length > 0)
    .filter((id) => {
      const st = e.facesAt(...centroid2(e.worldPoly(id)))
      return st.indexOf(id) < 2
    })
  const lift = (u: number) => (u < 0.3 ? easeInOut(u / 0.3) : u < 0.72 ? 1 : 1 - easeInOut((u - 0.72) / 0.28))
  const flapSign = e.hingeSign({ p: crease3.p, d: norm2(crease3.d) }, flapFaces)
  m.step(
    {
      title: "Tuck the point in",
      text: "Lift the top flap, fold the front point down, and tuck it under the flap.",
      fold: "Tuck",
      tip: "slide a flap under another layer so it locks",
      duration: 3,
      camera: { elevation: 52 },
    },
    {
      groups: [
        { ...m.hinge(top, apex, "valley"), window: [0.24, 0.74], bend: 0.12 },
        {
          faces: flapFaces,
          p: P,
          d: norm2(crease3.d),
          end: flapSign * 2.3,
          profile: lift,
          approach: 0.12,
        },
      ],
      flatEnd: true,
    }
  )
  // 5 — turn over
  m.turnOver()
  // 6 — fold the remaining point down
  const y2 = y
  const top2 = { p: [0, y2] as V2, d: [1, 0] as V2 }
  m.fold(
    {
      title: "Fold the back point down",
      text: "Fold the last point down over the front.",
      fold: "Valley fold",
      tip: "fold the paper toward you so a valley forms",
    },
    top2,
    { seed: [0, y2 + 0.1], depth: 0 }
  )
  void thereAndBack
  return m
}
