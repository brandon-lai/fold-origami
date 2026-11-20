import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

// Satori cannot read CSS variables; these mirror the light tokens in globals.css.
const TOKENS = { paper: "#f5f5f7", ink: "#1d1d1f", muted: "#6e6e73" } as const

export const alt = "A red paper crane, folded from one sheet, with the words: See exactly where the paper goes."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  const crane = await readFile(join(process.cwd(), "public/thumbs/crane.png"))
  const src = `data:image/png;base64,${crane.toString("base64")}`
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: TOKENS.paper, alignItems: "center", padding: "0 72px" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 600 }}>
          <div style={{ fontSize: 30, color: TOKENS.muted, fontWeight: 600 }}>Fold</div>
          <div style={{ fontSize: 76, lineHeight: 1.02, color: TOKENS.ink, fontWeight: 600, letterSpacing: -2.5, marginTop: 16 }}>
            See exactly where the paper goes.
          </div>
          <div style={{ fontSize: 28, color: TOKENS.muted, marginTop: 24 }}>One sheet folds itself, one crease at a time.</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={560} height={560} alt="" style={{ marginLeft: -20 }} />
      </div>
    ),
    size
  )
}
