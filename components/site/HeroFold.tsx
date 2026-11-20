"use client"
// The landing signature: one sheet folds into a crane as you scroll, then opens
// back out. Scroll position maps straight onto the baked lesson frames.
import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"
import type { Frame } from "@/components/fold/PaperScene"
import { useModel, hasWebGL2 } from "@/lib/use-model"

const PaperScene = dynamic(() => import("@/components/fold/PaperScene").then((m) => m.PaperScene), { ssr: false })

/** fold over the first 78% of the story, hold, then unfold in the last stretch */
function storyToFrame(p: number, n: number): { step: number; t: number } {
  const FOLD_END = 0.78
  const HOLD_END = 0.86
  let g: number
  if (p <= FOLD_END) g = (p / FOLD_END) * n
  else if (p <= HOLD_END) g = n
  else g = n * (1 - (p - HOLD_END) / (1 - HOLD_END))
  g = Math.min(Math.max(g, 0), n - 1e-6)
  const step = Math.floor(g)
  return { step, t: g - step }
}

export function HeroFold({ storyRef }: { storyRef: React.RefObject<HTMLElement | null> }) {
  const { model } = useModel("crane")
  const progress = useRef(0)
  const [reduced, setReduced] = useState(false)
  const [webgl, setWebgl] = useState(true)
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)")
    const onMq = () => setWide(mq.matches)
    onMq()
    mq.addEventListener("change", onMq)
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    setWebgl(hasWebGL2())
    const onScroll = () => {
      const el = storyRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight
      progress.current = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      mq.removeEventListener("change", onMq)
    }
  }, [storyRef])

  const shown = useRef(0)
  const driver = useCallback(
    (dt: number): Frame => {
      const n = model ? model["fold:steps"].length : 1
      // ease toward the scroll position so a flick reads as a fold, not a jump
      shown.current = reduced ? progress.current : shown.current + (progress.current - shown.current) * Math.min(1, dt * 7)
      const { step, t } = reduced ? { step: n - 1, t: 1 } : storyToFrame(shown.current, n)
      return {
        step,
        t,
        guide: -1,
        glow: 0,
        paper: "red",
        guided: true,
        checkView: false,
        flipped: false,
        spin: 0,
        snapNonce: 0,
        reduced,
        view: { elevation: 50, zoom: 0.92 },
      }
    },
    [model, reduced]
  )
  if (!model || !webgl) return null
  // desktop: paper on the right, words on the left; phone: paper above, words below
  return (
    <PaperScene
      model={model}
      driver={driver}
      interactive={false}
      className="!absolute inset-0"
      framing={wide ? 0.66 : 0.5}
      shiftX={wide ? 0.2 : 0}
      lift={wide ? 0 : 0.17}
    />
  )
}
