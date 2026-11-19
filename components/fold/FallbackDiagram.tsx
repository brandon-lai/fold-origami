"use client"
// No WebGL: the same baked geometry drawn as a flat diagram per step (before
// and after), so every lesson still works on any device.
import { useMemo } from "react"
import { stepSVG } from "@/lib/fold/svg"
import type { BakedModel } from "@/lib/fold/types"
import { BACK, PAPERS } from "./paper-material"

export function FallbackDiagram({ model, step, paper }: { model: BakedModel; step: number; paper: string }) {
  const front = (PAPERS.find((p) => p.id === paper) ?? PAPERS[0]).front
  const [before, after] = useMemo(
    () => [
      stepSVG(model, step, { t: 0, size: 320, front, back: BACK, guide: true }),
      stepSVG(model, step, { t: 1, size: 320, front, back: BACK }),
    ],
    [model, step, front]
  )
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-6 px-6 pb-56 pt-20" role="img" aria-label={`Diagram of step ${step + 1}: before and after`}>
      <div className="w-[min(40vw,320px)] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: before }} />
      <span aria-hidden className="text-3xl text-muted-foreground">→</span>
      <div className="w-[min(40vw,320px)] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: after }} />
    </div>
  )
}
