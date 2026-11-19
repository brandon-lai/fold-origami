import type { Model } from "@/lib/fold/ops"
import { cup } from "./cup"
import { squareBaseModel } from "./square-base"
import { crane } from "./crane"

export const MODELS: Record<string, () => Model> = {
  "paper-cup": cup,
  "square-base": squareBaseModel,
  crane,
}

/** the learning path, in order */
export const ORDER = ["paper-cup", "square-base", "crane"]
