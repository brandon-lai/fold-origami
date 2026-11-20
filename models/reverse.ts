// Inside reverse fold, done the way a rigid sheet allows it: the flap opens
// along its spine (the layers either side swing apart, flexing back to flat
// away from the fold), the tip turns inside out between the layers, and the
// flap closes again. One driven hinge per phase; the solver keeps the tip's
// spine joined throughout.

import type { Model } from "@/lib/fold/ops"
import type { GroupSpec } from "@/lib/fold/engine"
import { type V2, add2, centroid2, dist2, easeInOut, norm2, scale2, sideOf } from "@/lib/fold/math"

const PI = Math.PI
const OPEN = 0.3

export interface ReverseOpts {
  title: string
  text: string
  /** where the reverse crease meets the flap's spine */
  V: V2
  /** spine direction from V toward the tip, now and after the fold */
  from: V2
  to: V2
  /** which faces belong to the flap being reversed (before splitting) */
  flap: (c: V2, id: number) => boolean
  /** length of the tip beyond V, for the opening's reach */
  reach: number
  camera?: { elevation?: number; azimuth?: number; zoom?: number }
  duration?: number
}

export function insideReverse(m: Model, o: ReverseOpts) {
  const e = m.e
  const sd = norm2(o.from)
  const fd = norm2(o.to)
  // the reverse crease bisects the old and new spine directions
  const L = { p: o.V, d: norm2(add2(sd, fd)) }
  const tipPoint = add2(o.V, scale2(sd, o.reach * 0.5))
  const tipSide = (Math.sign(sideOf(L, tipPoint)) || 1) as 1 | -1
  const candidates = e.byWorld(o.flap)
  const tips = e.side(L, tipSide, candidates)
  if (!tips.length) throw new Error(`${o.title}: no flap faces past the crease`)
  const tipSet = new Set(tips)

  // front/back halves by rank in the local stack
  const half = (id: number, pool: (x: number) => boolean) => {
    const c = centroid2(e.worldPoly(id))
    const stack = e.facesAt(c[0], c[1]).filter(pool)
    const i = stack.indexOf(id)
    return i < stack.length / 2 ? "front" : "back"
  }
  const tipF = tips.filter((id) => half(id, (x) => tipSet.has(x)) === "front")
  const tipB = tips.filter((id) => !tipF.includes(id))
  const reachR = o.reach * 1.15
  const body = e.alive.filter((id) => !tipSet.has(id) && dist2(centroid2(e.worldPoly(id)), o.V) < reachR * 1.5 + 0.2)
  const bodyF = body.filter((id) => half(id, (x) => !tipSet.has(x)) === "front")
  const bodyB = body.filter((id) => !bodyF.includes(id))

  // which way the flap material lies from the spine
  const matSide = Math.sign(sideOf({ p: o.V, d: sd }, centroid2(e.worldPoly(tips[0])))) || 1
  // sector the tip's spine sweeps (on the material side)
  const a0 = Math.atan2(sd[1], sd[0])
  const a1 = Math.atan2(fd[1], fd[0])
  let ccw = a1 - a0
  while (ccw < 0) ccw += 2 * PI
  const midCCW = a0 + ccw / 2
  const midDir: V2 = [Math.cos(midCCW), Math.sin(midCCW)]
  const ccwOnMaterial = Math.sign(sideOf({ p: o.V, d: sd }, add2(o.V, midDir))) === matSide
  const [th0, th1] = ccwOnMaterial ? [a0, a0 + ccw] : [a1, a1 + (2 * PI - ccw)]

  const sd3: [number, number, number] = [sd[0], sd[1], 0]
  const openTo = matSide * (PI / 2) * 0.999
  const groups: GroupSpec[] = [
    // the front layers swing open about the spine, then the solver closes them as the tip turns
    {
      faces: [],
      p: o.V,
      d: sd3,
      end: 0,
      free: true,
      freeFrom: OPEN,
      drive: (t) => openTo * easeInOut(Math.min(1, t / OPEN)),
      ref: () => 0,
    },
    { faces: [], p: o.V, d: sd3, end: 0, mirrorOf: 0 },
  ]
  const s = Math.sign(sideOf(L, centroid2(e.worldPoly(tips[0])))) || 1
  groups.push({
    faces: tipF,
    parent: 0,
    p: L.p,
    d: L.d,
    end: -s * PI,
    window: [OPEN, 1],
  })
  // by symmetry the back half turns exactly opposite to the front half
  groups.push({ faces: tipB, parent: 1, p: L.p, d: L.d, end: s * PI, mirrorOf: 2 })
  m.step(
    {
      title: o.title,
      text: o.text,
      fold: "Inside reverse fold",
      tip: "open the layers and push the point up between them",
      duration: o.duration ?? 3.2,
      camera: o.camera ?? { elevation: 48 },
    },
    {
      groups,
      flex: {
        p: o.V,
        d: sd3,
        v: o.V,
        th0,
        th1,
        margin: 0.4,
        r1: reachR,
        r2: reachR * 1.4,
        alphaGroup: 0,
        front: bodyF,
        back: bodyB,
      },
      flatEnd: true,
      reg: 0.002,
    }
  )
  return { tips, L }
}
