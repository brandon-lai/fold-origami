import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { LIBRARY } from "@/lib/library"
import { LessonLoader } from "./lesson-loader"

export function generateStaticParams() {
  return LIBRARY.map((m) => ({ slug: m.slug }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const m = LIBRARY.find((x) => x.slug === slug)
  return m ? { title: `Fold a ${m.title.toLowerCase()}, step by step`, description: m.blurb } : {}
}

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!LIBRARY.some((m) => m.slug === slug)) notFound()
  return <LessonLoader slug={slug} />
}
