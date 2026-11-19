// Authoring vocabulary: the folds a lesson is written in. Each returns the
// MotionSpec groups for one step; Model.step runs it through the engine.

import { Engine, type GroupSpec, type MotionSpec, type StepMeta } from "./engine"
import {
  type Line2,
  type V2,
  centroid2,
  lineThrough,
  sideOf,
  easeInOut,
  IDENT,
  rotAxis,
  mul,
  type Mat,
} from "./math"
import type { ModelMeta } from "./types"

const PI = Math.PI

/** fold to `end` and back again in one motion (pre-creasing) */
export const thereAndBack = (u: number) => (u < 0.5 ? easeInOut(u * 2) : easeInOut((1 - u) * 2))

export class Model {
  e: Engine
  constructor(
    public meta: ModelMeta,
    opts: { w?: number; h?: number; rotate?: number; colorUp?: boolean } = {}
  ) {
    const w = opts.w ?? 1
    const h = opts.h ?? 1
    // centre the paper on the origin; colour side down by default (the usual start)
    let T: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1, -w / 2, -h / 2, 0]
    if (!opts.colorUp) T = mul(rotAxis([0, 0, 0], [0, 1, 0], PI), T)
    if (opts.rotate) T = mul(rotAxis([0, 0, 0], [0, 0, 1], opts.rotate), T)
    this.e = new Engine(w, h, T)
  }

  step(meta: StepMeta, spec: MotionSpec) {
    const r = this.e.motion(meta, spec)
    if (r.maxTear > 2e-3 && !process.env.FOLD_TEAR_OK) {
      throw new Error(`step "${meta.title}" tears the paper by ${r.maxTear.toFixed(4)}`)
    }
    return r
  }

  /** world point of a CP corner/point */
  p(u: number, v: number): V2 {
    return this.e.cp(u, v)
  }

  // ---------------------------------------------------------------- simple folds
  /**
   * Valley (toward the viewer) or mountain (away) fold of `faces` about line L.
   * `faces` should already lie entirely on one side of L (use e.side / e.flap).
   */
  hinge(L: Line2, faces: number[], kind: "valley" | "mountain", extra: Partial<GroupSpec> = {}): GroupSpec {
    const s = this.e.hingeSign(L, faces)
    const end = (kind === "valley" ? 1 : -1) * s * PI
    return { faces, p: L.p, d: L.d, end, bend: 0.22, ...extra }
  }

  fold(
    meta: StepMeta,
    L: Line2,
    select: { all?: boolean; seed?: V2; depth?: number; sign?: 1 | -1 },
    kind: "valley" | "mountain" = "valley",
    unfold = false
  ) {
    const sign = select.sign ?? 1
    const faces =
      select.seed !== undefined
        ? this.e.flap(select.seed, select.depth ?? 0, L, sign)
        : this.e.side(L, sign)
    const g = this.hinge(L, faces, kind, unfold ? { profile: thereAndBack, bend: 0.15 } : {})
    if (unfold) g.end = Math.abs(g.end) * Math.sign(g.end)
    return this.step({ duration: unfold ? 2.4 : 1.5, ...meta }, { groups: [g], flatEnd: true })
  }

  turnOver(meta: Partial<StepMeta> = {}, axis: "vertical" | "horizontal" = "vertical") {
    const b = this.e.bbox()
    const d: V2 = axis === "vertical" ? [0, 1] : [1, 0]
    return this.step(
      {
        title: "Turn over",
        text: axis === "vertical" ? "Turn the paper over from side to side." : "Turn the paper over from top to bottom.",
        fold: "Turn over",
        tip: "flip the whole model so the back faces you",
        duration: 1.6,
        camera: { elevation: 62 },
        ...meta,
      },
      { groups: [{ faces: [...this.e.alive], p: [b.cx, b.cy], d, end: PI }], flatEnd: true }
    )
  }

  rotate(deg: number, meta: Partial<StepMeta> = {}) {
    const b = this.e.bbox()
    return this.step(
      {
        title: "Rotate",
        text: `Rotate the paper ${Math.abs(deg)}° so it matches the picture.`,
        fold: "Rotate",
        tip: "turn the paper on the table without flipping it",
        duration: 1.2,
        ...meta,
      },
      {
        groups: [{ faces: [...this.e.alive], p: [b.cx, b.cy, 0], d: [0, 0, 1], end: (deg * PI) / 180 }],
        flatEnd: true,
      }
    )
  }

  /** The world centroid of a list of faces. */
  centre(faces: number[]): V2 {
    const cs = faces.map((f) => centroid2(this.e.worldPoly(f)))
    return [cs.reduce((s, c) => s + c[0], 0) / cs.length, cs.reduce((s, c) => s + c[1], 0) / cs.length]
  }
}

export { lineThrough, sideOf, IDENT }
export type { Line2, V2 }
