"use client"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { useModel } from "@/lib/use-model"

const Showcase = dynamic(() => import("@/components/fold/Showcase").then((m) => m.Showcase), { ssr: false })

export function ThumbStudio() {
  const [slug, setSlug] = useState<string | null>(null)
  const [view, setView] = useState<{ elevation?: number; azimuth?: number }>({})
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    setSlug(q.get("slug"))
    setView({ elevation: Number(q.get("el") ?? 46), azimuth: q.get("az") ? Number(q.get("az")) : undefined })
  }, [])
  const { model } = useModel(slug ?? "crane")
  const cap = useRef<((s: number) => string) | null>(null)
  useEffect(() => {
    ;(window as unknown as { __thumb: () => string | null }).__thumb = () => cap.current?.(800) ?? null
  }, [])
  if (!model) return null
  return (
    <div style={{ width: 800, height: 800, position: "relative" }}>
      <Showcase model={model} spin={0} className="!absolute inset-0" framing={0.78} captureRef={cap} view={view} floor={false} />
    </div>
  )
}
