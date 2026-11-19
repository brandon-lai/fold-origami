"use client"
import Link from "next/link"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Nav } from "./Nav"
import { HeroFold } from "./HeroFold"

const SCREENS = [
  {
    title: "One fold, one sentence.",
    body: "Every step does one thing and says it in plain words. The crease draws itself first, so you know where it goes.",
  },
  {
    title: "Turn it any way you like.",
    body: "Drag to look from any side, pinch to come closer, double-tap to return to the guided view.",
  },
  {
    title: "Hold it up to your own.",
    body: "One tap shows the paper the way it sits in your hands, so you can check your fold before the next one.",
  },
]

export function Landing() {
  const story = useRef<HTMLElement>(null)
  return (
    <>
      <Nav overlay />
      <main>
        <section ref={story} aria-label="Fold a crane as you scroll" className="relative h-[520dvh]">
          <div className="sticky top-0 h-dvh overflow-hidden">
            <HeroFold storyRef={story} />
          </div>
          <div className="pointer-events-none absolute inset-0 flex flex-col">
            {/* screen 1: the promise */}
            <div className="flex h-dvh flex-col items-center px-6 pt-[16vh] text-center">
              <h1 className="max-w-[12ch] text-hero leading-[1.02] font-semibold tracking-[-0.035em] sm:max-w-none">
                See exactly where the paper goes.
              </h1>
              <p className="mt-5 max-w-[34ch] text-[19px] leading-snug text-muted-foreground sm:text-[21px]">
                One sheet folds itself, one crease at a time. Turn it, scrub it, then copy it with your own paper.
              </p>
              <Button size="lg" className="pointer-events-auto mt-8" render={<Link href="/models" />} nativeButton={false}>
                Start folding
              </Button>
            </div>
            {SCREENS.map((s) => (
              <div key={s.title} className="flex h-[110dvh] items-end justify-center px-6 pb-[12vh]">
                <div className="max-w-[30ch] text-center">
                  <h2 className="text-section leading-[1.05] font-semibold">{s.title}</h2>
                  <p className="mt-3 text-[19px] leading-snug text-muted-foreground">{s.body}</p>
                </div>
              </div>
            ))}
            <div className="flex h-[70dvh] items-end justify-center px-6 pb-[14vh]">
              <div className="flex flex-col items-center text-center">
                <h2 className="max-w-[16ch] text-section leading-[1.05] font-semibold">Start with a cup. Finish with a crane.</h2>
                <p className="mt-3 max-w-[34ch] text-[19px] leading-snug text-muted-foreground">
                  Seven traditional models, each teaching one new fold. No account, no sign-up.
                </p>
                <Button size="lg" className="pointer-events-auto mt-7" render={<Link href="/models" />} nativeButton={false}>
                  Start folding
                </Button>
              </div>
            </div>
          </div>
        </section>
        <footer className="mx-auto flex max-w-[1120px] flex-col gap-2 px-6 py-12 text-[13px] text-muted-foreground sm:flex-row sm:justify-between">
          <p>Fold. Traditional designs, folded by a computer and checked for physical correctness.</p>
          <p>
            <Link href="/models" className="underline-offset-4 hover:underline">
              Library
            </Link>
          </p>
        </footer>
      </main>
    </>
  )
}
