import { Model } from "@/lib/fold/ops"
import { birdBaseFront, petalFold, squareBase } from "./bases"

export function crane() {
  const m = new Model(
    {
      slug: "crane",
      title: "Traditional crane",
      level: "Intermediate",
      difficulty: 3,
      minutes: 15,
      paper: "15 cm square, colour side down",
      technique: "Bird base, inside reverse folds",
      blurb: "The model every folder wants to make. Two petal folds and three reverse folds.",
      next: "lily",
    },
    { rotate: Math.PI / 4 }
  )
  squareBase(m)
  birdBaseFront(m)
  m.turnOver()
  petalFold(m, {
    title: "Petal fold the back",
    text: "Repeat the petal fold on this side: lift the bottom corner and fold the sides in.",
  })
  return m
}
