import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Nav } from "@/components/site/Nav"
import { ModelIntro } from "@/components/site/ModelIntro"
import { LIBRARY } from "@/lib/library"

export function generateStaticParams() {
  return LIBRARY.map((m) => ({ slug: m.slug }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const m = LIBRARY.find((x) => x.slug === slug)
  if (!m) return {}
  return {
    title: m.title,
    description: `${m.blurb} ${m.steps} steps, about ${m.minutes} minutes.`,
    openGraph: { images: [{ url: `/thumbs/${m.slug}.png`, alt: `A folded ${m.title.toLowerCase()}` }] },
  }
}

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const i = LIBRARY.findIndex((m) => m.slug === slug)
  if (i < 0) notFound()
  return (
    <>
      <Nav />
      <ModelIntro m={LIBRARY[i]} n={i + 1} />
    </>
  )
}
