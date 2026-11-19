// Turn an authored Model into the baked file the browser loads: a FOLD 1.1
// document with one frame per step, plus the fold:* keys the player needs.

import type { Model } from "./ops"
import { type V2, type V3, type Mat, apply, ccw } from "./math"
import { LAYER, type BakedModel, type BakedStep, type FoldFrame } from "./types"

const r5 = (x: number) => Math.round(x * 1e5) / 1e5
const r5v = <T extends number[]>(v: T) => v.map(r5) as T

export function bake(model: Model): BakedModel {
  const e = model.e
  const leaves = e.alive.slice()
  const leafIndex = new Map(leaves.map((id, i) => [id, i]))
  // ancestor chain for each leaf
  const chains = leaves.map((id) => {
    const c: number[] = []
    let x: number | null = id
    while (x !== null) {
      c.push(x)
      x = e.faces[x].parent
    }
    return c
  })

  const steps: BakedStep[] = e.records.map((rec, si) => {
    const aliveSet = new Set(rec.alive)
    const anc = chains.map((c) => {
      const a = c.find((x) => aliveSet.has(x))
      if (a === undefined) throw new Error(`leaf has no ancestor alive at step ${si}`)
      return a
    })
    const leavesOf = new Map<number, number[]>()
    anc.forEach((a, li) => leavesOf.set(a, [...(leavesOf.get(a) ?? []), li]))
    const mapFaces = (fs: number[]) => fs.flatMap((f) => leavesOf.get(f) ?? [])
    const moving = new Set<number>()
    rec.groups.forEach((g) => g.faces.length && mapFaces(g.faces).forEach((f) => moving.add(f)))
    return {
      title: rec.meta.title,
      text: rec.meta.text,
      fold: rec.meta.fold,
      tip: rec.meta.tip,
      camera: rec.meta.camera ?? {},
      duration: rec.meta.duration ?? 1.5,
      T: anc.map((a) => r5v(rec.T.get(a) as Mat)),
      o0: anc.map((a) => r5v(rec.o0.get(a) as V3)),
      o1: anc.map((a) => r5v(rec.o1.get(a) as V3)),
      groups: rec.groups.map((g) => ({
        faces: mapFaces(g.faces),
        parent: g.parent,
        p: r5v(g.p),
        d: g.d,
        a: g.a.map((x) => Math.round(x * 1e6) / 1e6),
        ...(g.bend ? { bend: g.bend, r: r5(g.r ?? 1) } : {}),
        ...(g.h ? { h: r5(g.h) } : {}),
      })),
      ...(rec.flex
        ? {
            flex: {
              ...rec.flex,
              front: mapFaces(rec.flex.front),
              back: mapFaces(rec.flex.back),
            },
          }
        : {}),
      ...(rec.curl ? { curl: rec.curl.map((c) => ({ ...c, faces: mapFaces(c.faces) })) } : {}),
      flatEnd: rec.flatEnd,
      moving: [...moving].sort((a, b) => a - b),
      guide: rec.guide.map(([a, b]) => [r5v(a), r5v(b)] as [V3, V3]),
      creases: rec.creaseCount,
    }
  })

  // FOLD crease pattern + frames (vertices deduplicated in CP space)
  const vkey = new Map<string, number>()
  const vertices: V2[] = []
  const vid = (p: V2) => {
    const k = `${p[0].toFixed(6)},${p[1].toFixed(6)}`
    let i = vkey.get(k)
    if (i === undefined) {
      i = vertices.length
      vertices.push([r5(p[0]), r5(p[1])])
      vkey.set(k, i)
    }
    return i
  }
  const facePolys = leaves.map((id) => ccw(e.faces[id].poly))
  const faces_vertices = facePolys.map((poly) => poly.map(vid))
  const frames: FoldFrame[] = steps.map((s, si) => {
    // folded vertex positions at the end of this step, from each leaf face's end transform
    const endT = si + 1 < steps.length ? steps[si + 1].T : finalT(e, leaves)
    const coords: V3[] = vertices.map(() => [0, 0, 0])
    faces_vertices.forEach((fv, fi) =>
      fv.forEach((v) => {
        const p = apply(endT[fi], [vertices[v][0], vertices[v][1], 0])
        coords[v] = r5v(p)
      })
    )
    return {
      frame_title: s.title,
      frame_inherit: true,
      frame_parent: 0,
      vertices_coords: coords,
      faces_vertices,
      "fold:step": { type: s.fold, text: s.text, angle: s.flatEnd ? 180 : 0 },
    }
  })

  return {
    file_spec: 1.1,
    file_creator: "Fold bake pipeline",
    file_title: model.meta.title,
    file_classes: ["foldingMotion"],
    "fold:meta": model.meta,
    "fold:paper": { w: e.w, h: e.h },
    "fold:faces": facePolys.map((p) => p.map((q) => r5v(q))),
    "fold:creases": e.creases.map((c) => [r5v(c.a), r5v(c.b), c.step]),
    "fold:steps": steps,
    vertices_coords: vertices,
    faces_vertices,
    file_frames: frames,
  }
  void leafIndex
  void LAYER
}

function finalT(e: Model["e"], leaves: number[]) {
  return leaves.map((id) => e.faces[id].T)
}
