import type { Model } from "@/lib/fold/ops"
import { cup } from "./cup"
import { squareBaseModel } from "./square-base"
import { crane } from "./crane"
import { flappingBird } from "./flapping-bird"
import { masu } from "./masu"
import { frog } from "./frog"

export const MODELS: Record<string, () => Model> = {
  "paper-cup": cup,
  "masu-box": masu,
  "jumping-frog": frog,
  "square-base": squareBaseModel,
  "flapping-bird": flappingBird,
  crane,
}

/** the learning path, in order */
export const ORDER = ["paper-cup", "masu-box", "jumping-frog", "square-base", "flapping-bird", "crane"]
