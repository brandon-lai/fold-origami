// The PRD's bake gate, as tests: every model bakes, never tears, never passes
// a face through another, every flat state obeys Maekawa and Kawasaki, and
// each baked file stays under the 300 KB budget.
import { describe, expect, it } from "vitest"
import { gzipSync } from "node:zlib"
import { bake } from "../lib/fold/bake"
import { validateModel } from "../lib/fold/validate"
import { MODELS, ORDER } from "../models"

describe.each(ORDER)("%s", (slug) => {
  const model = MODELS[slug]()
  const baked = bake(model)
  it("keeps every shared crease joined", () => {
    for (const r of model.e.records) expect(r.maxTear, r.meta.title).toBeLessThan(2.5e-3)
  })
  it("passes the validation gate (no crossings, Maekawa, Kawasaki)", () => {
    expect(validateModel(baked)).toEqual([])
  })
  it("is under 300 KB gzipped", () => {
    expect(gzipSync(JSON.stringify(baked)).length).toBeLessThan(300 * 1024)
  })
  it("has one sentence per step", () => {
    for (const s of baked["fold:steps"]) {
      expect(s.text.length, s.title).toBeLessThan(110)
      expect(s.text.trim().endsWith("."), s.title).toBe(true)
    }
  })
})

describe("crane", () => {
  it("ends standing, wings out (a 3D state)", () => {
    const b = bake(MODELS.crane())
    expect(b["fold:steps"].at(-1)!.flatEnd).toBe(false)
  })
})
