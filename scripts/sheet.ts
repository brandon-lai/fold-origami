// Dev helper: bake one model and write an HTML contact sheet of every step.
import { writeFileSync } from "node:fs"
import { bake } from "../lib/fold/bake"
import { stepSVG } from "../lib/fold/svg"
import { MODELS } from "../models"
import { validateModel } from "../lib/fold/validate"

async function main() {
  const slug = process.argv[2]
  const out = process.argv[3] ?? "/tmp/sheet.html"
  const build = MODELS[slug]
  if (!build) throw new Error(`unknown model ${slug}`)
  const t0 = Date.now()
  const m = build()
  const baked = bake(m)
  const ms = Date.now() - t0
  const t1 = Date.now()
  const issues = validateModel(baked)
  console.log(`validate ${Date.now() - t1}ms`, issues.length ? issues : "clean")
  const from = Number(process.argv[4] ?? 0)
  const cells = baked["fold:steps"]
    .map((s, i) => i < from ? "" : (() => {
      const mid = stepSVG(baked, i, { t: 0.5, size: 220 })
      const end = stepSVG(baked, i, { t: 1, size: 220, guide: false })
      const start = stepSVG(baked, i, { t: 0, size: 220, guide: true })
      return `<div class=c><b>${i + 1}. ${s.title}</b><br><small>${s.text}</small><div>${start}${mid}${end}</div><small>tear ${m.e.records[i].maxTear.toExponential(1)} ${issues.filter((x) => x.step === i).map((x) => `<b style=color:red>${x.kind}: ${x.detail}</b>`).join(" ")}</small></div>`
    })())
    .join("")
  writeFileSync(
    out,
    `<!doctype html><meta charset=utf-8><style>body{font:12px system-ui;background:#eee;margin:8px}.c{background:#fff;margin:6px;padding:6px;display:inline-block;width:690px;vertical-align:top}svg{border:1px solid #ddd;margin:2px;background:#fafafa}</style><p>${slug}: ${baked["fold:steps"].length} steps, faces ${baked["fold:faces"].length}, bake ${ms}ms, json ${(JSON.stringify(baked).length / 1024).toFixed(0)} KB</p>${cells}`
  )
  console.log(`wrote ${out}: ${baked["fold:steps"].length} steps, ${baked["fold:faces"].length} faces, ${ms}ms`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
