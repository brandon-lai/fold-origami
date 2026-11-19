"use client"
// Privacy-friendly event tracking (PRD: step reached, lesson finished) through
// Vercel Web Analytics: no cookies, no personal data, no cross-site identifiers.
import { track as vaTrack } from "@vercel/analytics"

type Props = Record<string, string | number | boolean>

export function track(event: "lesson_started" | "step_reached" | "lesson_finished" | "share_image" | "next_model", props: Props = {}) {
  try {
    vaTrack(event, props)
  } catch {
    // analytics must never break a lesson
  }
}
