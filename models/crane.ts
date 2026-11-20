import { Model } from "@/lib/fold/ops"
import { C_PT, birdBaseFront, petalFold, squareBase } from "./bases"
import { insideReverse } from "./reverse"
import { norm2, rot2, type V2 } from "@/lib/fold/math"
import type { GroupSpec } from "@/lib/fold/engine"

export function crane() {
  const e0 = null
  void e0
  const m = new Model(
    {
      slug: "crane",
      title: "Traditional crane",
      level: "Intermediate",
      difficulty: 3,
      minutes: 15,
      paper: "15 cm square, colour side down",
      technique: "Narrowing, inside reverse folds",
      blurb: "The model every folder wants to make. Two petal folds and three reverse folds.",
      next: "lily",
    },
    { rotate: Math.PI / 4 }
  )
  const e = m.e
  squareBase(m)
  birdBaseFront(m)
  m.turnOver()
  petalFold(m, {
    title: "Petal fold the back",
    text: "Repeat the petal fold on this side: lift the bottom corner and fold the sides in.",
  })
  narrow(m, "front")
  m.turnOver()
  narrow(m, "back")
  const H = -0.2071
  // neck and tail: the thin lower points turn up between the body layers
  insideReverse(m, {
    title: "Reverse fold the neck",
    text: "Open the right point slightly and fold it up inside the body.",
    V: [0, H - 0.02],
    from: [0, -1],
    to: [Math.cos(PI / 3), Math.sin(PI / 3)],
    flap: (c) => c[0] > 0 && c[1] < H + 0.02,
    reach: 0.5,
  })
  insideReverse(m, {
    title: "Reverse fold the tail",
    text: "Fold the left point up inside the body the same way.",
    V: [0, H - 0.02],
    from: [0, -1],
    to: [Math.cos((2 * PI) / 3), Math.sin((2 * PI) / 3)],
    flap: (c) => c[0] < 0 && c[1] < H + 0.02,
    reach: 0.5,
  })
  // head: a small reverse fold near the tip of the neck
  const V: V2 = [0, H - 0.02]
  const nd: V2 = [Math.cos(PI / 3), Math.sin(PI / 3)]
  const legLen = V[1] + Math.SQRT1_2
  const tipN: V2 = [V[0] + nd[0] * legLen, V[1] + nd[1] * legLen]
  const hv: V2 = [V[0] + nd[0] * (legLen - 0.1), V[1] + nd[1] * (legLen - 0.1)]
  insideReverse(m, {
    title: "Reverse fold the head",
    text: "Fold the tip of the neck down inside itself to make the head.",
    V: hv,
    from: nd,
    to: [Math.cos(-PI / 9), Math.sin(-PI / 9)],
    flap: (_c, id) => e.worldPoly(id).some((q) => Math.hypot(q[0] - tipN[0], q[1] - tipN[1]) < 0.01),
    reach: 0.1,
    camera: { elevation: 56, zoom: 1.4 },
    duration: 2.6,
  })
  // the wings hinge along the top of the body, where the square base was closed
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
  // stand it up and spread the wings
  const all = [...e.alive]
  const stand = { p: [0, 0, 0] as [number, number, number], d: [1, 0, 0] as [number, number, number] }
  const fs = m.e.hingeSign(wing, front)
  m.step(
    {
      title: "Spread the wings",
      text: "Stand the crane up and gently pull the wings out level.",
      fold: "Shaping",
      tip: "the last touch: bend flaps to give the model its form",
      duration: 2.6,
      camera: { elevation: 22, azimuth: 28, zoom: 1.05 },
    },
    {
      groups: [
        { faces: all.filter((f) => !front.includes(f) && !back.includes(f)), p: stand.p, d: stand.d, end: PI / 2 },
        { faces: front, parent: 0, p: stand.p, d: stand.d, end: fs * -(PI / 2) * 0.95 },
        { faces: back, parent: 0, p: stand.p, d: stand.d, end: fs * (PI / 2) * 0.95 },
      ],
      flatEnd: false,
    }
  )
  return m
}

const PI = Math.PI

/** Fold both lower edges of the top layer to the centre line (thin legs). */
function narrow(m: Model, side: "front" | "back") {
  const e = m.e
  const groups: GroupSpec[] = []
  for (const sign of [1, -1] as const) {
    const d = norm2(rot2([0, 1], (-sign * PI) / 16)) as V2
    const L = { p: C_PT, d }
    const faces = e.flap([sign * 0.09, -0.45], 0, L, sign === 1 ? -1 : 1)
    groups.push(m.hinge(L, faces, "valley", { bend: 0.12 }))
  }
  m.step(
    {
      title: side === "front" ? "Narrow the legs" : "Narrow the back",
      text:
        side === "front"
          ? "Fold the lower edges of the top layer in to the centre line."
          : "Repeat on this side: fold both lower edges in to the centre.",
      fold: "Valley fold",
      tip: "fold toward you so the edge lies on the centre line",
      camera: { elevation: 60 },
    },
    { groups, flatEnd: true }
  )
}
