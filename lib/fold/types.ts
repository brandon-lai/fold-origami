import type { V2, V3 } from "./math"

/** One rigid group of faces turning about a hinge, possibly riding on a parent group. */
export interface BakedGroup {
  faces: number[]
  /** index of parent group, or -1 for the stationary world */
  parent: number
  /** hinge axis at the start of the step (world, unoffset) */
  p: V3
  d: V3
  /** hinge angle at each sample, radians; length = samples + 1 */
  a: number[]
  /** lag bend: far edge trails the hinge mid-fold (radians at the tip) */
  bend?: number
  /** max distance of any vertex from the hinge, for normalising the bend */
  r?: number
  /**
   * Stack pivot height. A multi-layer flap turns about the inside of its crease
   * (top of the moving stack for a valley, bottom for a mountain) so layers never
   * sweep back through the paper beside the hinge.
   */
  h?: number
}

/**
 * Non-rigid opening used by reverse folds: faces on either side of a flap's
 * spine swing apart by ±alpha·w(x), where w falls off outside the sector the
 * moving tip sweeps through. Paper flexes; the bake checks it never tears.
 */
export interface BakedFlex {
  p: V3
  d: V3
  /**
   * Weight field. "sector": w = 1 inside the wedge the tip sweeps (apex v,
   * angles th0..th1), fading by `margin` and between radii r1..r2.
   * "band": w = smoothstep(r1, r2, distance from the line through v at angle th0),
   * a lid that opens away from a fixed crease.
   */
  kind?: "sector" | "band"
  /** sector apex (the vertex where the reverse crease meets the spine) */
  v: V2
  /** sector start/end angles (radians, world) and soft margin */
  th0: number
  th1: number
  margin: number
  r1: number
  r2: number
  /** index of the group whose angle is alpha */
  alphaGroup: number
  front: number[]
  back: number[]
}

/** Petal curl for the lily's last step: faces roll around an axis progressively. */
export interface BakedCurl {
  faces: number[]
  /** the curl starts at this line (world 3D at step start) and rolls the far side */
  p: V3
  d: V3
  /** direction away from the line, in the face plane, at step start */
  out: V3
  /** curl axis direction (bending direction, normal to the paper at start) */
  n: V3
  radius: number
  /** total roll angle at t = 1 */
  angle: number
}

export interface BakedStep {
  title: string
  text: string
  /** the fold's name and short tooltip, e.g. "Squash fold" / "open a flap and press it flat" */
  fold: string
  tip: string
  camera: CameraHint
  duration: number
  /** per leaf face: 12-float transform at step start */
  T: number[][]
  o0: V3[]
  o1: V3[]
  groups: BakedGroup[]
  flex?: BakedFlex
  curl?: BakedCurl[]
  flatEnd: boolean
  /** faces that move this step (glow) */
  moving: number[]
  /** crease guide segments, world at step start (offset applied) */
  guide: [V3, V3][]
  /** creases that exist after this step, indexes into model.creases */
  creases: number
}

export interface CameraHint {
  /** elevation above the paper plane in degrees; 90 = straight down */
  elevation?: number
  /** azimuth in degrees; 0 = looking from the paper's bottom edge */
  azimuth?: number
  /** zoom multiplier on the auto framing */
  zoom?: number
}

export interface ModelMeta {
  slug: string
  title: string
  level: "Beginner" | "Intermediate"
  difficulty: number
  minutes: number
  paper: string
  technique: string
  blurb: string
  next?: string
}

export interface BakedModel {
  file_spec: number
  file_creator: string
  file_title: string
  file_classes: string[]
  "fold:meta": ModelMeta
  "fold:paper": { w: number; h: number }
  /** leaf faces in crease-pattern coordinates */
  "fold:faces": V2[][]
  /** every crease ever made: CP segment + the step it first appears */
  "fold:creases": [V2, V2, number][]
  "fold:steps": BakedStep[]
  /** FOLD-standard frames: crease pattern + per-step folded vertices for interoperability */
  vertices_coords: V2[]
  faces_vertices: number[][]
  file_frames: FoldFrame[]
}

export interface FoldFrame {
  frame_title: string
  frame_inherit: boolean
  frame_parent: number
  vertices_coords: V3[]
  faces_vertices: number[][]
  faceOrders?: [number, number, number][]
  "fold:step": { type: string; text: string; angle: number }
}

export const SAMPLES = 96
export const LAYER = 0.0008
