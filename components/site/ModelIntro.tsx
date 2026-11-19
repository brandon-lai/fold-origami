"use client"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import type { LibraryEntry } from "@/lib/library"
import { Button } from "@/components/ui/button"
import { useModel, hasWebGL2 } from "@/lib/use-model"
import { loadPref, loadProgress } from "@/lib/progress"

const Showcase = dynamic(() => import("@/components/fold/Showcase").then((m) => m.Showcase), { ssr: false })

export function ModelIntro({ m, n }: { m: LibraryEntry; n: number }) {
  const { model } = useModel(m.slug)
  const [progress, setProgress] = useState<{ step: number; done: boolean } | null>(null)
  const [paper, setPaper] = useState("red")
  const [webgl, setWebgl] = useState(true)
  useEffect(() => {
    setProgress(loadProgress(m.slug))
    setPaper(loadPref("paper", "red"))
    setWebgl(hasWebGL2())
  }, [m.slug])
  const [size, side] = m.paper.split(", ")
  const resume = progress && !progress.done && progress.step > 0
  return (
    <main className="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-6 px-4 pb-16 sm:px-6 lg:min-h-[calc(100dvh-56px)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="order-2 flex flex-col gap-6 lg:order-1">
        <div>
          <p className="text-[15px] text-muted-foreground tabular">
            Model {n} of 7
          </p>
          <h1 className="mt-1 text-section leading-[1.05] font-semibold">{m.title}</h1>
          <p className="mt-3 max-w-[40ch] text-[19px] leading-snug text-muted-foreground">{m.blurb}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-hairline py-5 text-[15px]">
          <div>
            <dt className="text-muted-foreground">Difficulty</dt>
            <dd className="font-medium">{m.level}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Steps</dt>
            <dd className="font-medium tabular">{m.steps}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Time</dt>
            <dd className="font-medium tabular">About {m.minutes} minutes</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Paper</dt>
            <dd className="font-medium">
              {size}
              <span className="block font-normal text-muted-foreground">{side}</span>
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">New in this model</dt>
            <dd className="font-medium">{m.technique}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" render={<Link href={`/models/${m.slug}/learn`} />} nativeButton={false}>
            {resume ? `Resume at step ${progress.step + 1}` : progress?.done ? "Fold it again" : "Start the lesson"}
          </Button>
          {resume && (
            <Button variant="ghost" size="lg" render={<Link href={`/models/${m.slug}/learn?step=1`} />} nativeButton={false}>
              Start over
            </Button>
          )}
        </div>
      </div>
      <div className="relative order-1 aspect-square w-full lg:order-2" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/thumbs/${m.slug}.png`} alt="" width={800} height={600} className="absolute inset-0 size-full object-contain p-8" style={model && webgl ? { opacity: 0 } : undefined} />
        {model && webgl && <Showcase model={model} paper={paper} className="!absolute inset-0" spin={0.3} framing={0.66} />}
      </div>
    </main>
  )
}
