"use client"
import { useEffect, useState } from "react"
import type { BakedModel } from "./fold/types"

const cache = new Map<string, Promise<BakedModel>>()

export function fetchModel(slug: string) {
  let p = cache.get(slug)
  if (!p) {
    p = fetch(`/models/${slug}.json`).then((r) => {
      if (!r.ok) throw new Error(`model ${slug}: ${r.status}`)
      return r.json() as Promise<BakedModel>
    })
    cache.set(slug, p)
    p.catch(() => cache.delete(slug))
  }
  return p
}

export function useModel(slug: string) {
  const [state, setState] = useState<{ model: BakedModel | null; error: string | null }>({ model: null, error: null })
  useEffect(() => {
    let live = true
    fetchModel(slug).then(
      (model) => live && setState({ model, error: null }),
      (e: Error) => live && setState({ model: null, error: e.message })
    )
    return () => {
      live = false
    }
  }, [slug])
  return state
}

export function hasWebGL2() {
  if (typeof document === "undefined") return true
  try {
    return !!document.createElement("canvas").getContext("webgl2")
  } catch {
    return false
  }
}
