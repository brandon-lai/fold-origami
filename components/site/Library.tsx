"use client"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import type { LibraryEntry } from "@/lib/library"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { fetchModel, hasWebGL2 } from "@/lib/use-model"
import { loadProgress } from "@/lib/progress"
import type { BakedModel } from "@/lib/fold/types"

const Showcase = dynamic(() => import("@/components/fold/Showcase").then((m) => m.Showcase), { ssr: false })

type Level = "all" | "Beginner" | "Intermediate"
type Time = "any" | "5" | "15"

export function Library({ models }: { models: LibraryEntry[] }) {
  const [level, setLevel] = useState<Level>("all")
  const [time, setTime] = useState<Time>("any")
  const shown = useMemo(
    () =>
      models
        .map((m, i) => ({ ...m, n: i + 1 }))
        .filter((m) => (level === "all" || m.level === level) && (time === "any" || m.minutes <= Number(time))),
    [models, level, time]
  )
  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3" role="group" aria-label="Filter models">
        <Filter label="Level" value={level} onChange={(v) => setLevel(v as Level)} options={[["all", "All"], ["Beginner", "Beginner"], ["Intermediate", "Intermediate"]]} />
        <Filter label="Time" value={time} onChange={(v) => setTime(v as Time)} options={[["any", "Any"], ["5", "5 min or less"], ["15", "15 min or less"]]} />
      </div>
      {shown.length ? (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => (
            <Card key={m.slug} m={m} total={models.length} />
          ))}
        </ul>
      ) : (
        <div className="mt-16 flex flex-col items-start gap-3">
          <p className="text-[19px]">Nothing matches both filters.</p>
          <p className="text-muted-foreground">Every model in the library takes more time at this level. Widen the time filter to see them.</p>
          <button type="button" onClick={() => (setLevel("all"), setTime("any"))} className="mt-1 min-h-11 rounded-full px-1 text-primary underline-offset-4 hover:underline">
            Show every model
          </button>
        </div>
      )}
    </>
  )
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[15px] text-muted-foreground" id={`f-${label}`}>
        {label}
      </span>
      <ToggleGroup aria-labelledby={`f-${label}`} value={[value]} onValueChange={(v) => v[0] && onChange(v[0])} className="gap-1 rounded-full bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] p-1">
        {options.map(([v, l]) => (
          <ToggleGroupItem
            key={v}
            value={v}
            className="h-9 rounded-full px-3.5 text-[14px] data-[pressed]:bg-card data-[pressed]:text-foreground data-[pressed]:shadow-(--shadow-soft)"
          >
            {l}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

function Card({ m, total }: { m: LibraryEntry & { n: number }; total: number }) {
  const [live, setLive] = useState(false)
  const [model, setModel] = useState<BakedModel | null>(null)
  const [progress, setProgress] = useState<{ step: number; done: boolean } | null>(null)
  useEffect(() => setProgress(loadProgress(m.slug)), [m.slug])
  const wake = () => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || !hasWebGL2()) return
    setLive(true)
    fetchModel(m.slug).then(setModel, () => {})
  }
  return (
    <li>
      <Link
        href={`/models/${m.slug}`}
        onPointerEnter={wake}
        onFocus={wake}
        onPointerLeave={() => setLive(false)}
        onBlur={() => setLive(false)}
        className="group flex h-full flex-col overflow-hidden rounded-[18px] bg-card shadow-(--shadow-soft) transition-[box-shadow,transform] duration-(--dur-ui) ease-(--ease-out) hover:shadow-(--shadow-panel) active:scale-[0.99] motion-reduce:transition-none"
      >
        <div className="relative aspect-[4/3] w-full bg-[color-mix(in_oklch,var(--background)_60%,var(--card))]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/thumbs/${m.slug}.png`}
            alt=""
            width={800}
            height={600}
            className="absolute inset-0 size-full object-contain p-4 transition-opacity duration-(--dur-ui) group-hover:opacity-0 motion-reduce:transition-none"
            style={live && model ? { opacity: 0 } : undefined}
          />
          {live && model && <Showcase model={model} className="!absolute inset-0" spin={0.6} framing={0.7} />}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-5">
          <div className="flex items-baseline justify-between gap-3 text-[13px] text-muted-foreground tabular">
            <span>
              {m.n} of {total}, {m.level.toLowerCase()}
            </span>
            <span>
              {m.steps} steps, {m.minutes} min
            </span>
          </div>
          <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">{m.title}</h2>
          <p className="text-[15px] text-muted-foreground">New: {m.technique.toLowerCase()}</p>
          {progress && (
            <p className="mt-auto pt-2 text-[13px] text-primary">{progress.done ? "Folded" : `Resume at step ${progress.step + 1}`}</p>
          )}
        </div>
      </Link>
    </li>
  )
}
