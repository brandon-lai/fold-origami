import type { Metadata } from "next"
import { Nav } from "@/components/site/Nav"
import { Library } from "@/components/site/Library"
import { LIBRARY } from "@/lib/library"

export const metadata: Metadata = {
  title: "The library",
  description: "Seven traditional origami models, from a paper cup to a lily, each teaching one new fold.",
}

export default function ModelsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1200px] px-4 pt-10 pb-24 sm:px-6 sm:pt-16">
        <h1 className="text-section leading-[1.05] font-semibold">The library</h1>
        <p className="mt-3 max-w-[48ch] text-[19px] leading-snug text-muted-foreground">
          One learning path, in order. Each model adds one new fold to the ones before it.
        </p>
        <Library models={LIBRARY} />
      </main>
    </>
  )
}
