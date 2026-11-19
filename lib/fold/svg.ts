// Flat diagram of a baked step, drawn from the same geometry the 3D player uses.
// Used for the no-WebGL fallback and for eyeballing folds during authoring.

import { apply, type V2, type V3 } from "./math"
import { evaluateInto, prepareStep, sampleAngle } from "./evaluate"
import type { BakedModel } from "./types"

export function stepSVG(
  model: BakedModel,
  stepIndex: number,
  opts: { t?: number; size?: number; front?: string; back?: string; ink?: string; guide?: boolean } = {}
): string {
  const t = opts.t ?? 1
  const size = opts.size ?? 320
  const step = model["fold:steps"][stepIndex]
  const faces = model["fold:faces"]
  const rt = prepareStep(step, faces.length)
  // evaluate polygon corners
  const mesh = {
    face: new Uint16Array(faces.flatMap((p, i) => p.map(() => i))),
    uv: new Float32Array(faces.flatMap((p) => p.flatMap((q) => q))),
    index: new Uint32Array(0),
  }
  const pos = new Float32Array(mesh.face.length * 3)
  evaluateInto(step, rt, mesh, t, pos, true)
  let k = 0
  const polys = faces.map((p) => p.map(() => {
    const v: V3 = [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]]
    k++
    return v
  }))
  // face normal side
  const frontUp = faces.map((_, i) => {
    const P = polys[i]
    let s = 0
    for (let j = 0; j < P.length; j++) {
      const a = P[j]
      const b = P[(j + 1) % P.length]
      s += a[0] * b[1] - b[0] * a[1]
    }
    return s > 0
  })
  const order = faces
    .map((_, i) => i)
    .sort((a, b) => avgZ(polys[a]) - avgZ(polys[b]))
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const P of polys) for (const p of P) {
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1])
  }
  const pad = 0.08 * Math.max(x1 - x0, y1 - y0)
  const vb = [x0 - pad, -(y1 + pad), x1 - x0 + 2 * pad, y1 - y0 + 2 * pad]
  const front = opts.front ?? "#c8102e"
  const back = opts.back ?? "#fbfaf7"
  const ink = opts.ink ?? "#1d1d1f"
  const sw = Math.max(vb[2], vb[3]) * 0.004
  const paths = order
    .map((i) => {
      const d = polys[i].map((p, j) => `${j ? "L" : "M"}${p[0].toFixed(4)} ${(-p[1]).toFixed(4)}`).join("") + "Z"
      return `<path d="${d}" fill="${frontUp[i] ? front : back}" stroke="${ink}" stroke-width="${sw.toFixed(4)}" stroke-linejoin="round"/>`
    })
    .join("")
  let guide = ""
  if (opts.guide && step.guide.length) {
    guide = step.guide
      .map(([a, b]) => `<line x1="${a[0]}" y1="${-a[1]}" x2="${b[0]}" y2="${-b[1]}" stroke="${ink}" stroke-width="${sw * 1.2}" stroke-dasharray="${sw * 6} ${sw * 4}"/>`)
      .join("")
  }
  void sampleAngle
  void apply
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map((v) => v.toFixed(4)).join(" ")}" width="${size}" height="${size}">${paths}${guide}</svg>`
}

const avgZ = (P: V3[]) => P.reduce((s, p) => s + p[2], 0) / P.length
export type { V2 }
