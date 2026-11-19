import { Model } from "@/lib/fold/ops"
import { squareBase } from "./bases"

export function squareBaseModel() {
  const m = new Model(
    {
      slug: "square-base",
      title: "Square base",
      level: "Beginner",
      difficulty: 1,
      minutes: 4,
      paper: "15 cm square, colour side down",
      technique: "Collapsing along existing creases",
      blurb: "Four creases, one collapse. The starting point for the crane, the bird and the lily.",
      next: "masu-box",
    },
    { rotate: Math.PI / 4 }
  )
  squareBase(m)
  return m
}
