"use client"
// A finished model turning slowly in soft light (model intro, library hover).
import { useCallback } from "react"
import type { BakedModel } from "@/lib/fold/types"
import { PaperScene, type Frame } from "./PaperScene"

export function Showcase({
  model,
  paper = "red",
  spin = 0.35,
  className,
  framing,
}: {
  model: BakedModel
  paper?: string
  spin?: number
  className?: string
  framing?: number
}) {
  const last = model["fold:steps"].length - 1
  const driver = useCallback(
    (): Frame => ({
      step: last,
      t: 1,
      guide: -1,
      glow: 0,
      paper,
      guided: true,
      checkView: false,
      flipped: false,
      spin,
      snapNonce: 0,
      reduced: false,
      view: { elevation: 46 },
      endFrame: true,
    }),
    [last, paper, spin]
  )
  return <PaperScene model={model} driver={driver} interactive={false} className={className} framing={framing} quality="low" />
}
