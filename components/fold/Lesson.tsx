"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FlipHorizontal2,
  RotateCcw,
  ScanEye,
  Volume2,
  VolumeX,
  X,
  Move3d,
  Info,
} from "lucide-react"
import type { BakedModel } from "@/lib/fold/types"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Kbd } from "@/components/ui/kbd"
import { PaperScene, type Frame } from "./PaperScene"
import { GUIDE_SECONDS, Player, usePlayer } from "./player"
import { PAPERS } from "./paper-material"
import { FallbackDiagram } from "./FallbackDiagram"
import { paperSound } from "@/lib/sound"
import { track } from "@/lib/analytics"
import { loadPref, loadProgress, savePref, saveProgress } from "@/lib/progress"
import { hasWebGL2 } from "@/lib/use-model"
import { LIBRARY } from "@/lib/library"
import { cn } from "@/lib/utils"

const ICON = { strokeWidth: 1.5, className: "size-[22px]" }

export function Lesson({ model, slug, startAt }: { model: BakedModel; slug: string; startAt?: number }) {
  const steps = model["fold:steps"]
  const meta = model["fold:meta"]
  const player = useMemo(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const p = new Player({
      reduced,
      paper: loadPref("paper", "red"),
      sound: loadPref("sound", false),
    })
    p.durations = steps.map((s) => s.duration)
    return p
  }, [steps])
  const s = usePlayer(player)
  const captureRef = useRef<((size: number) => string) | null>(null)
  const [webgl] = useState(() => hasWebGL2())
  const [fade, setFade] = useState(0)

  // test hook: lets the render checks drive the player to an exact frame
  useEffect(() => {
    ;(window as unknown as { __fold?: Player }).__fold = player
  }, [player])

  // resume where the learner left off
  useEffect(() => {
    const saved = loadProgress(slug)
    const start = startAt ?? (saved && !saved.done ? saved.step : 0)
    player.goTo(Math.min(Math.max(0, start), steps.length - 1))
    player.set({ snapNonce: player.state.snapNonce + 1 })
    track("lesson_started", { model: slug, from: start })
  }, [player, slug, startAt, steps.length])

  useEffect(() => {
    player.onStepChange = (i) => {
      saveProgress(slug, i)
      track("step_reached", { model: slug, step: i + 1 })
      if (player.state.reduced) setFade((f) => f + 1)
    }
    player.onFoldStart = () => player.state.sound && paperSound.rustle()
    player.onFoldLand = () => player.state.sound && paperSound.press()
  }, [player, slug])

  useEffect(() => {
    if (s.phase === "done") {
      saveProgress(slug, steps.length - 1, true)
      track("lesson_finished", { model: slug })
    }
  }, [s.phase, slug, steps.length])

  // keyboard: space / → next, ← back. Inert inside form controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest("input, textarea, select, [role=slider], [contenteditable=true]")) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "ArrowRight" || (e.key === " " && !el?.closest("button, a"))) {
        e.preventDefault()
        player.next()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        player.back()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [player])

  // the render loop reads the player directly; React hears about it ~10×/s
  const lastEmit = useRef(0)
  const driver = useCallback(
    (dt: number): Frame => {
      player.tick(dt)
      const st = player.state
      lastEmit.current += dt
      if (lastEmit.current > 0.1 && (st.phase === "fold" || st.phase === "loop")) {
        lastEmit.current = 0
        player.emit()
      }
      const guide =
        st.phase === "guide"
          ? Math.min(1, st.clock / (GUIDE_SECONDS * 0.85))
          : (st.phase === "fold" || st.phase === "loop") && st.t < 0.6 && !st.scrubbing
            ? 1
            : -1
      const glow =
        st.phase === "guide" ? 1 : st.phase === "fold" ? 1 - st.t : st.phase === "loop" ? 0.5 * (1 - st.t) : 0
      const done = st.phase === "done"
      return {
        step: st.step,
        t: st.t,
        guide: st.reduced ? -1 : guide,
        glow: st.reduced ? 0 : glow,
        paper: st.paper,
        guided: st.guided,
        checkView: st.checkView && !done,
        flipped: st.flipped,
        spin: done && !st.reduced ? 0.35 : 0,
        snapNonce: st.snapNonce,
        reduced: st.reduced,
        endFrame: done,
      }
    },
    [player]
  )

  const step = steps[s.step]
  const isLast = s.step === steps.length - 1
  const lastTap = useRef(0)
  const resetView = () => player.set({ guided: true })
  const progress = (s.step + (s.phase === "guide" ? 0 : s.t)) / steps.length

  // swipe on the control area (touch): left = next, right = back
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null)

  const next = LIBRARY.find((m) => m.slug === meta.next)

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background select-none">
      {webgl ? (
        <div
          key={fade}
          className={cn("absolute inset-0", s.reduced && "animate-in fade-in-60 duration-200")}
          onPointerUp={(e) => {
            if (e.pointerType !== "touch") return
            const now = performance.now()
            if (now - lastTap.current < 320) resetView()
            lastTap.current = now
          }}
          onDoubleClick={resetView}
        >
          <PaperScene
            model={model}
            driver={driver}
            onGuidedChange={(g) => player.set({ guided: g })}
            captureRef={captureRef}
            lift={0.11}
            className="!absolute inset-0 touch-none"
          />
        </div>
      ) : (
        <FallbackDiagram model={model} step={s.step} paper={s.paper} />
      )}

      {/* top: wayfinding only */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),16px)] sm:px-6">
        <nav aria-label="Lesson" className="pointer-events-auto flex min-w-0 items-center gap-2 text-[15px]">
          <Link href="/" className="rounded-full px-2 py-2 font-semibold tracking-tight">
            Fold
          </Link>
          <span aria-hidden className="text-muted-foreground">
            /
          </span>
          <Link href={`/models/${slug}`} className="truncate rounded-full px-2 py-2 text-muted-foreground hover:text-foreground">
            {meta.title}
          </Link>
        </nav>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Leave the lesson"
          className="pointer-events-auto"
          render={<Link href={`/models/${slug}`} />}
          nativeButton={false}
        >
          <X {...ICON} />
        </Button>
      </header>

      {!s.guided && s.phase !== "done" && (
        <div className="absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),16px)+52px)] flex justify-center">
          <Button variant="secondary" onClick={resetView} className="glass animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <Move3d {...ICON} />
            Back to the guided view
          </Button>
        </div>
      )}

      {s.phase === "done" ? (
        <Finish
          title={meta.title}
          slug={slug}
          paper={s.paper}
          onPaper={(id) => {
            player.set({ paper: id })
            savePref("paper", id)
          }}
          onAgain={() => player.goTo(0)}
          capture={() => captureRef.current?.(1200) ?? null}
          next={next}
        />
      ) : (
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-[max(env(safe-area-inset-bottom),16px)] sm:gap-4"
          onTouchStart={(e) => {
            const t = e.touches[0]
            swipe.current = { x: t.clientX, y: t.clientY, t: performance.now() }
          }}
          onTouchEnd={(e) => {
            const a = swipe.current
            const t = e.changedTouches[0]
            swipe.current = null
            if (!a || (e.target as HTMLElement).closest("[role=slider]")) return
            const dx = t.clientX - a.x
            const dy = t.clientY - a.y
            if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - a.t < 600) {
              if (dx < 0) player.next()
              else player.back()
            }
          }}
        >
          {/* the step, in one sentence */}
          <div className="flex max-w-[760px] flex-col items-center gap-2 text-center" aria-live="polite" aria-atomic="true">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span className="tabular">
                Step {s.step + 1} of {steps.length}
              </span>
              <Tooltip>
                <TooltipTrigger
                  render={<button type="button" />}
                  className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-foreground hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]"
                >
                  {step.fold}
                  <Info strokeWidth={1.5} className="size-3.5 text-muted-foreground" aria-hidden />
                </TooltipTrigger>
                <TooltipContent side="top">
                  {step.fold}: {step.tip}
                </TooltipContent>
              </Tooltip>
            </div>
            <p
              key={s.step}
              className="animate-in fade-in-0 text-step leading-tight font-semibold tracking-[-0.015em] text-balance duration-300 motion-reduce:animate-none"
            >
              {step.text}
            </p>
          </div>

          {/* controls float in a frosted bar */}
          <div className="glass flex w-full max-w-[760px] flex-col gap-1 rounded-[18px] p-2 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <Tooltip>
                <TooltipTrigger
                  render={<Button variant="ghost" size="icon" aria-label="Previous step" disabled={s.step === 0} onClick={() => player.back()} />}
                >
                  <ChevronLeft {...ICON} />
                </TooltipTrigger>
                <TooltipContent>
                  Back <Kbd>←</Kbd>
                </TooltipContent>
              </Tooltip>
              <div className="min-w-0 flex-1 px-1">
                <Slider
                  aria-label="Scrub through this fold"
                  min={0}
                  max={1000}
                  value={[Math.round(s.t * 1000)]}
                  onValueChange={(v) => player.scrub((Array.isArray(v) ? v[0] : v) / 1000)}
                  onValueCommitted={() => player.endScrub()}
                />
                <div className="-mt-1 flex justify-between text-[12px] text-muted-foreground tabular" aria-hidden>
                  <span>{Math.round(progress * 100)}% folded</span>
                  <span>{step.title}</span>
                </div>
              </div>
              <Button onClick={() => player.next()} className="min-w-[96px]" aria-label={isLast ? "Finish" : "Next step"}>
                {isLast ? "Finish" : "Next"}
                {!isLast && <ChevronRight {...ICON} className="-mr-1 size-[18px]" />}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-1 border-t border-hairline pt-1 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-2">
              <ToggleGroup
                aria-label="Playback speed"
                value={[String(s.speed)]}
                onValueChange={(v) => v[0] && player.set({ speed: Number(v[0]) as 0.5 | 1 | 2 })}
                className="gap-0"
              >
                {["0.5", "1", "2"].map((v) => (
                  <ToggleGroupItem key={v} value={v} aria-label={`${v}× speed`} className="h-11 min-w-11 rounded-full px-2 text-[13px] tabular">
                    {v}×
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <ToolButton label="Replay this fold" onClick={() => player.replay()}>
                <RotateCcw {...ICON} />
              </ToolButton>
              <ToolButton label={s.flipped ? "Show the front" : "Turn the model over"} pressed={s.flipped} onClick={() => player.set({ flipped: !s.flipped })}>
                <FlipHorizontal2 {...ICON} />
              </ToolButton>
              <ToolButton
                label={s.checkView ? "Back to the guided angle" : "Check yourself: see it as you hold it"}
                pressed={s.checkView}
                onClick={() => player.set({ checkView: !s.checkView, guided: true })}
              >
                <ScanEye {...ICON} />
              </ToolButton>
              <PaperPicker value={s.paper} onChange={(id) => (player.set({ paper: id }), savePref("paper", id))} />
              <ToolButton
                label={s.sound ? "Mute paper sounds" : "Play paper sounds"}
                pressed={s.sound}
                onClick={() => {
                  paperSound.unlock()
                  player.set({ sound: !s.sound })
                  savePref("sound", !s.sound)
                }}
              >
                {s.sound ? <Volume2 {...ICON} /> : <VolumeX {...ICON} />}
              </ToolButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ToolButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            aria-pressed={pressed}
            onClick={onClick}
            className={cn(pressed && "bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] text-primary hover:bg-[color-mix(in_oklch,var(--primary)_20%,transparent)]")}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function Swatch({ id, active }: { id: string; active?: boolean }) {
  const p = PAPERS.find((x) => x.id === id) ?? PAPERS[0]
  return (
    <span
      aria-hidden
      className={cn("block size-6 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]", active && "outline-2 outline-offset-2 outline-primary")}
      style={{
        background: p.pattern
          ? `radial-gradient(circle at 30% 30%, ${p.ink} 0 18%, transparent 19%), radial-gradient(circle at 70% 70%, ${p.ink} 0 14%, transparent 15%), ${p.front}`
          : p.front,
      }}
    />
  )
}

export function PaperPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const current = PAPERS.find((p) => p.id === value) ?? PAPERS[0]
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger render={<PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={`Paper: ${current.name}`} />} />}>
          <Swatch id={value} />
        </TooltipTrigger>
        <TooltipContent>Paper</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" className="w-auto">
        <PaperSwatches value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}

export function PaperSwatches({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Paper colour" className="flex flex-col gap-2">
      <p className="px-1 text-[13px] text-muted-foreground">Paper. The back stays white, like real kami.</p>
      <div className="flex flex-wrap gap-1">
        {PAPERS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={p.id === value}
            aria-label={p.name}
            title={p.name}
            onClick={() => onChange(p.id)}
            className="grid size-11 place-items-center rounded-full transition-transform duration-(--dur-press) hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] active:scale-[0.94] motion-reduce:transition-none"
          >
            <Swatch id={p.id} active={p.id === value} />
          </button>
        ))}
      </div>
    </div>
  )
}

function Finish({
  title,
  slug,
  paper,
  onPaper,
  onAgain,
  capture,
  next,
}: {
  title: string
  slug: string
  paper: string
  onPaper: (id: string) => void
  onAgain: () => void
  capture: () => string | null
  next?: (typeof LIBRARY)[number]
}) {
  const [busy, setBusy] = useState(false)
  const download = async () => {
    setBusy(true)
    try {
      const shot = capture()
      if (!shot) return
      const url = await composeShare(shot, title)
      const a = document.createElement("a")
      a.href = url
      a.download = `fold-${slug}.png`
      a.click()
      track("share_image", { model: slug })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
      <section
        aria-labelledby="finish-title"
        className="glass flex w-full max-w-[560px] animate-in flex-col gap-4 rounded-[18px] p-5 duration-300 fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none sm:p-6"
      >
        <div>
          <h2 id="finish-title" className="text-[28px] leading-tight font-semibold">
            You folded a {title.toLowerCase().replace("traditional ", "")}.
          </h2>
          <p className="mt-1 text-muted-foreground">Turn it in the light, try another paper, or keep a picture of it.</p>
        </div>
        <PaperSwatches value={paper} onChange={onPaper} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={download} data-loading={busy || undefined} disabled={busy}>
            <Download {...ICON} className="size-[18px]" />
            Save an image
          </Button>
          <Button variant="secondary" onClick={onAgain}>
            Fold it again
          </Button>
        </div>
        {next && (
          <Link
            href={`/models/${next.slug}`}
            onClick={() => track("next_model", { from: slug, to: next.slug })}
            className="group flex items-center justify-between gap-4 rounded-[14px] bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] p-4 transition-colors duration-(--dur-press) hover:bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]"
          >
            <span>
              <span className="block text-[13px] text-muted-foreground">Next, one new fold</span>
              <span className="block font-semibold">{next.title}</span>
              <span className="block text-[15px] text-muted-foreground">{next.technique}</span>
            </span>
            <ChevronRight {...ICON} className="shrink-0 text-muted-foreground transition-transform duration-(--dur-press) group-hover:translate-x-0.5" />
          </Link>
        )}
      </section>
    </div>
  )
}

async function composeShare(shot: string, title: string) {
  const W = 1200
  const c = document.createElement("canvas")
  c.width = W
  c.height = W
  const g = c.getContext("2d") as CanvasRenderingContext2D
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--background").trim() || "#f5f5f7"
  const fg = getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim() || "#1d1d1f"
  g.fillStyle = bg
  g.fillRect(0, 0, W, W)
  const img = new Image()
  img.src = shot
  await img.decode()
  g.drawImage(img, 0, -40, W, W)
  g.fillStyle = fg
  g.font = `600 44px -apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, Helvetica, Arial, sans-serif`
  g.textAlign = "center"
  g.fillText(title, W / 2, W - 120)
  g.globalAlpha = 0.6
  g.font = `400 26px -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, Helvetica, Arial, sans-serif`
  g.fillText("Folded with Fold", W / 2, W - 76)
  return c.toDataURL("image/png")
}
