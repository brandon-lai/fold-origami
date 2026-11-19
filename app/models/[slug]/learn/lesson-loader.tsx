"use client"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { useModel } from "@/lib/use-model"
import { Spinner } from "@/components/fold/Spinner"

const Lesson = dynamic(() => import("@/components/fold/Lesson").then((m) => m.Lesson), {
  ssr: false,
  loading: () => <Loading />,
})

function Loading({ label = "Laying out the paper…" }: { label?: string }) {
  return (
    <div className="grid h-dvh place-items-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground" role="status">
        <Spinner />
        {label}
      </div>
    </div>
  )
}

function Inner({ slug }: { slug: string }) {
  const { model, error } = useModel(slug)
  const q = useSearchParams()
  const step = q.get("step")
  if (error)
    return (
      <div className="grid h-dvh place-items-center px-6 text-center">
        <p>
          This lesson didn’t load. Check your connection and reload the page.
          <br />
          <span className="text-muted-foreground">({error})</span>
        </p>
      </div>
    )
  if (!model) return <Loading />
  return <Lesson model={model} slug={slug} startAt={step ? Number(step) - 1 : undefined} />
}

export function LessonLoader({ slug }: { slug: string }) {
  return (
    <Suspense fallback={<Loading />}>
      <Inner slug={slug} />
    </Suspense>
  )
}
