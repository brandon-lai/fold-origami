"use client"
// Progress memory: the last step reached per model, in this browser only.
const key = (slug: string) => `fold:progress:${slug}`

export function loadProgress(slug: string): { step: number; done: boolean } | null {
  try {
    const raw = localStorage.getItem(key(slug))
    return raw ? (JSON.parse(raw) as { step: number; done: boolean }) : null
  } catch {
    return null
  }
}
export function saveProgress(slug: string, step: number, done = false) {
  try {
    localStorage.setItem(key(slug), JSON.stringify({ step, done }))
  } catch {
    // private mode or storage blocked: the lesson still works, it just won't resume
  }
}
export function loadPref<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`fold:pref:${name}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
export function savePref(name: string, v: unknown) {
  try {
    localStorage.setItem(`fold:pref:${name}`, JSON.stringify(v))
  } catch {}
}
