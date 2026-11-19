import { ccw, triangulate } from "./math"
import type { RenderMesh } from "./evaluate"
import type { BakedModel } from "./types"

export function buildMesh(model: BakedModel, h = 0.06): RenderMesh & { faceStart: number[]; faceTris: number[][] } {
  const face: number[] = []
  const uv: number[] = []
  const index: number[] = []
  const faceStart: number[] = []
  const faceTris: number[][] = []
  model["fold:faces"].forEach((poly, fi) => {
    const base = face.length
    faceStart.push(base)
    const { pts, tris } = triangulate(ccw(poly), h)
    pts.forEach((p) => {
      face.push(fi)
      uv.push(p[0], p[1])
    })
    const ft: number[] = []
    for (let i = 0; i < tris.length; i += 3) {
      ft.push(index.length / 3)
      index.push(base + tris[i], base + tris[i + 1], base + tris[i + 2])
    }
    faceTris.push(ft)
  })
  return {
    face: new Uint16Array(face),
    uv: new Float32Array(uv),
    index: new Uint32Array(index),
    faceStart,
    faceTris,
  }
}

