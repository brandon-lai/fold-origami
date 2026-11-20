import { Model } from "@/lib/fold/ops"
import { birdBaseFront, petalFold, squareBase } from "./bases"
import { insideReverse } from "./reverse"
import type { V2 } from "@/lib/fold/math"

const PI = Math.PI

/** The traditional flapping bird: a bird base with wide neck and tail, no narrowing. */
export function flappingBird() {
  const m = new Model(
    {
      slug: "flapping-bird",
      title: "Flapping bird",
      level: "Intermediate",
      difficulty: 3,
      minutes: 12,
      paper: "15 cm square, colour side down",
      technique: "Petal fold, the bird base",
      blurb: "Pull its tail and the wings beat. Your first petal folds, without the crane’s fine finish.",
      next: "crane",
    },
    { rotate: PI / 4 }
  )
  const e = m.e
  squareBase(m)
  birdBaseFront(m)
  m.turnOver()
  petalFold(m, {
    title: "Petal fold the back",
    text: "Repeat the petal fold on this side: lift the bottom corner and fold the sides in.",
  })
  const H = -0.2071
  const V: V2 = [0, H - 0.01]
  const legLen = V[1] + Math.SQRT1_2
  const nd: V2 = [Math.cos((5 * PI) / 12), Math.sin((5 * PI) / 12)]
  insideReverse(m, {
    title: "Reverse fold the neck",
    text: "Fold the right lower point up inside the body, close to the wing.",
    V,
    from: [0, -1],
    to: nd,
    flap: (c) => c[0] > 0 && c[1] < H + 0.02,
    reach: legLen,
  })
  insideReverse(m, {
    title: "Reverse fold the tail",
    text: "Fold the left lower point up inside the body the same way.",
    V,
    from: [0, -1],
    to: [Math.cos((7 * PI) / 12), Math.sin((7 * PI) / 12)],
    flap: (c) => c[0] < 0 && c[1] < H + 0.02,
    reach: legLen,
  })
  const tipN: V2 = [V[0] + nd[0] * legLen, V[1] + nd[1] * legLen]
  insideReverse(m, {
    title: "Reverse fold the head",
    text: "Fold the tip of the neck down inside itself to make the head.",
    V: [V[0] + nd[0] * (legLen - 0.09), V[1] + nd[1] * (legLen - 0.09)],
    from: nd,
    to: [Math.cos(-PI / 12), Math.sin(-PI / 12)],
    flap: (_c, id) => e.worldPoly(id).some((q) => Math.hypot(q[0] - tipN[0], q[1] - tipN[1]) < 0.01),
    reach: 0.09,
    camera: { elevation: 56, zoom: 1.4 },
    duration: 2.6,
  })
  const wing = { p: [0, 0] as V2, d: [1, 0] as V2 }
  const front = e.flap([0.02, 0.1], 0, wing, 1)
  const back = e.flap([0.02, 0.1], -1, wing, 1)
  m.step(
    {
      title: "Fold the wings down",
      text: "Fold the front wing down along the top of the body, and the back wing behind.",
      fold: "Valley and mountain fold",
      tip: "fold one wing toward you and the other away",
      camera: { elevation: 48 },
    },
    { groups: [m.hinge(wing, front, "valley"), m.hinge(wing, back, "mountain")], flatEnd: true }
  )
  const all = [...e.alive]
  const fs = e.hingeSign(wing, front)
  const axis = { p: [0, 0, 0] as [number, number, number], d: [1, 0, 0] as [number, number, number] }
  m.step(
    {
      title: "Shape the wings",
      text: "Stand the bird up and curve the wings out. Hold the neck and pull the tail to flap.",
      fold: "Shaping",
      tip: "the last touch: bend flaps to give the model its form",
      duration: 2.6,
      camera: { elevation: 20, azimuth: 30, zoom: 1.05 },
    },
    {
      groups: [
        { faces: all.filter((f) => !front.includes(f) && !back.includes(f)), p: axis.p, d: axis.d, end: PI / 2 },
        { faces: front, parent: 0, p: axis.p, d: axis.d, end: fs * -(PI / 2) * 0.7 },
        { faces: back, parent: 0, p: axis.p, d: axis.d, end: fs * (PI / 2) * 0.7 },
      ],
      flatEnd: false,
    }
  )
  return m
}
