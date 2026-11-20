"use client"

// The paper: a physically based material with a fibre bump map, creases that
// stay as faint ridges after unfolding, colour on the front and white on the
// back (like real kami), slight light transmission and a faint glow on the flap
// that is about to move.

import * as THREE from "three"
import type { BakedModel } from "@/lib/fold/types"

export interface PaperStyle {
  id: string
  name: string
  front: string
  /** washi pattern drawn over the front colour */
  pattern?: "seigaiha" | "asanoha"
  ink?: string
}

/** PRD paper palette: classic white, red, indigo, mustard, sage, two washi patterns */
export const PAPERS: PaperStyle[] = [
  { id: "red", name: "Red", front: "#c8352e" },
  { id: "white", name: "Classic white", front: "#f4f1ea" },
  { id: "indigo", name: "Indigo", front: "#2f3f7a" },
  { id: "mustard", name: "Mustard", front: "#d9a62e" },
  { id: "sage", name: "Sage", front: "#8fa588" },
  { id: "seigaiha", name: "Washi waves", front: "#3c5a88", pattern: "seigaiha", ink: "#e9e3d3" },
  { id: "asanoha", name: "Washi leaf", front: "#b4473c", pattern: "asanoha", ink: "#f0d9c4" },
]
export const BACK = "#f7f5f0"

const TEX = 1024

function fibreCanvas(seed = 7) {
  const c = document.createElement("canvas")
  c.width = c.height = TEX
  const g = c.getContext("2d") as CanvasRenderingContext2D
  g.fillStyle = "rgb(128,128,128)"
  g.fillRect(0, 0, TEX, TEX)
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  // mottled pulp
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * TEX
    const y = rnd() * TEX
    const r = 6 + rnd() * 26
    const v = 128 + (rnd() - 0.5) * 10
    g.fillStyle = `rgba(${v},${v},${v},0.18)`
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  // fibres
  g.lineCap = "round"
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * TEX
    const y = rnd() * TEX
    const a = rnd() * Math.PI * 2
    const l = 4 + rnd() * 18
    const v = rnd() > 0.5 ? 150 + rnd() * 30 : 100 - rnd() * 30
    g.strokeStyle = `rgba(${v},${v},${v},${0.25 + rnd() * 0.3})`
    g.lineWidth = 0.6 + rnd() * 0.8
    g.beginPath()
    g.moveTo(x, y)
    g.quadraticCurveTo(x + Math.cos(a + 0.4) * l * 0.5, y + Math.sin(a + 0.4) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l)
    g.stroke()
  }
  return c
}

function patternCanvas(p: PaperStyle) {
  const c = document.createElement("canvas")
  c.width = c.height = TEX
  const g = c.getContext("2d") as CanvasRenderingContext2D
  g.fillStyle = p.front
  g.fillRect(0, 0, TEX, TEX)
  if (!p.pattern) return c
  g.strokeStyle = p.ink ?? "#fff"
  g.globalAlpha = 0.55
  g.lineWidth = 3
  if (p.pattern === "seigaiha") {
    const r = 46
    for (let row = -1; row < TEX / (r / 2) + 2; row++) {
      for (let col = -1; col < TEX / (r * 2) + 2; col++) {
        const cx = col * r * 2 + (row % 2 ? r : 0)
        const cy = row * (r / 2)
        for (let k = 4; k >= 1; k--) {
          g.beginPath()
          g.arc(cx, cy, (r * k) / 4, Math.PI, 0)
          g.fillStyle = p.front
          if (k === 4) g.fill()
          g.stroke()
        }
      }
    }
  } else {
    // asanoha (hemp leaf): six-point stars on a triangular lattice
    const s = 64
    const h = (s * Math.sqrt(3)) / 2
    g.lineWidth = 2
    for (let row = -1; row < TEX / h + 2; row++)
      for (let col = -1; col < TEX / s + 2; col++) {
        const x = col * s + (row % 2 ? s / 2 : 0)
        const y = row * h
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 + Math.PI / 6
          g.beginPath()
          g.moveTo(x, y)
          g.lineTo(x + (Math.cos(a) * s) / Math.sqrt(3), y + (Math.sin(a) * s) / Math.sqrt(3))
          g.stroke()
          const b = (k * Math.PI) / 3
          g.beginPath()
          g.moveTo(x, y)
          g.lineTo(x + Math.cos(b) * s, y + Math.sin(b) * s)
          g.stroke()
        }
      }
  }
  return c
}

export class PaperMaterial {
  material: THREE.MeshPhysicalMaterial
  private fibre: HTMLCanvasElement
  private bump: HTMLCanvasElement
  private bumpTex: THREE.CanvasTexture
  private aoCanvas: HTMLCanvasElement
  private aoTex: THREE.CanvasTexture
  private patternTex: THREE.CanvasTexture
  uniforms = {
    uFront: { value: new THREE.Color("#c8352e") },
    uBack: { value: new THREE.Color(BACK) },
    uUsePattern: { value: 0 },
    uPattern: { value: null as THREE.Texture | null },
    uGlow: { value: 0 },
    uTrans: { value: 0.22 },
    uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  }
  private creaseKey = ""

  constructor() {
    this.fibre = fibreCanvas()
    this.bump = document.createElement("canvas")
    this.bump.width = this.bump.height = TEX
    this.bumpTex = new THREE.CanvasTexture(this.bump)
    this.bumpTex.anisotropy = 4
    this.aoCanvas = document.createElement("canvas")
    this.aoCanvas.width = this.aoCanvas.height = TEX
    this.aoTex = new THREE.CanvasTexture(this.aoCanvas)
    this.patternTex = new THREE.CanvasTexture(patternCanvas(PAPERS[0]))
    this.patternTex.colorSpace = THREE.SRGBColorSpace
    this.uniforms.uPattern.value = this.patternTex
    this.material = new THREE.MeshPhysicalMaterial({
      side: THREE.DoubleSide,
      roughness: 0.86,
      metalness: 0,
      sheen: 0.35,
      sheenRoughness: 0.9,
      sheenColor: new THREE.Color("#ffffff"),
      bumpMap: this.bumpTex,
      bumpScale: 0.9,
      aoMap: this.aoTex,
      aoMapIntensity: 0.55,
    })
    this.setCreases(null, 0)
    const u = this.uniforms
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u)
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float glow;\nvarying float vGlow;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = glow;")
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform vec3 uFront; uniform vec3 uBack; uniform float uUsePattern; uniform sampler2D uPattern;
uniform float uGlow; uniform float uTrans; uniform vec3 uKeyDir; varying float vGlow;`
        )
        .replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          `vec3 frontCol = uFront;
#ifdef USE_MAP
#endif
vec4 diffuseColor = vec4( gl_FrontFacing ? frontCol : uBack, opacity );`
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
#if defined( USE_BUMPMAP )
if ( gl_FrontFacing && uUsePattern > 0.5 ) diffuseColor.rgb = texture2D( uPattern, vBumpMapUv ).rgb;
#endif`
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.93, 0.78) * vGlow * uGlow * 0.3;`
        )
        .replace(
          "#include <opaque_fragment>",
          `// thin paper lets light through: the far side's key light glows faintly
outgoingLight += diffuseColor.rgb * uTrans * max( 0.0, dot( -normal, uKeyDir ) ) * 0.6;
#include <opaque_fragment>`
        )
    }
  }

  setPaper(p: PaperStyle) {
    if (p.pattern) {
      const c = patternCanvas(p)
      this.patternTex.image = c
      this.patternTex.needsUpdate = true
      this.uniforms.uUsePattern.value = 1
    } else this.uniforms.uUsePattern.value = 0
    this.uniforms.uFront.value.set(p.front).convertSRGBToLinear()
    this.uniforms.uBack.value.set(p.id === "white" ? "#f7f5f0" : BACK).convertSRGBToLinear()
  }

  /** Redraw crease memory: every crease made up to and including `upto`. */
  setCreases(model: BakedModel | null, count: number) {
    const key = `${model?.file_title}:${count}`
    if (key === this.creaseKey) return
    this.creaseKey = key
    const g = this.bump.getContext("2d") as CanvasRenderingContext2D
    g.drawImage(this.fibre, 0, 0)
    const a = this.aoCanvas.getContext("2d") as CanvasRenderingContext2D
    a.fillStyle = "#fff"
    a.fillRect(0, 0, TEX, TEX)
    if (model) {
      const { w, h } = model["fold:paper"]
      const creases = model["fold:creases"].slice(0, count)
      const px = (p: [number, number]) => [(p[0] / w) * TEX, (1 - p[1] / h) * TEX] as const
      for (const [p, q] of creases) {
        const A = px(p)
        const B = px(q)
        // a soft ridge: wide shallow rise, bright narrow crest
        g.lineCap = "round"
        g.strokeStyle = "rgba(170,170,170,0.5)"
        g.lineWidth = 7
        g.beginPath()
        g.moveTo(A[0], A[1])
        g.lineTo(B[0], B[1])
        g.stroke()
        g.strokeStyle = "rgba(205,205,205,0.9)"
        g.lineWidth = 1.6
        g.stroke()
        a.lineCap = "round"
        a.strokeStyle = "rgba(150,150,150,0.55)"
        a.lineWidth = 3
        a.beginPath()
        a.moveTo(A[0], A[1])
        a.lineTo(B[0], B[1])
        a.stroke()
      }
    }
    this.bumpTex.needsUpdate = true
    this.aoTex.needsUpdate = true
  }

  dispose() {
    this.material.dispose()
    this.bumpTex.dispose()
    this.aoTex.dispose()
    this.patternTex.dispose()
  }
}
