"use client"

import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Line, OrbitControls, PerformanceMonitor } from "@react-three/drei"
import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import { evaluateInto, prepareStep, type StepRuntime } from "@/lib/fold/evaluate"
import { buildMesh } from "@/lib/fold/mesh"
import type { BakedModel } from "@/lib/fold/types"
import type { V3 } from "@/lib/fold/math"
import { PAPERS, PaperMaterial } from "./paper-material"

export interface Frame {
  step: number
  t: number
  /** 0..1 how much of the crease guide is drawn (−1 hides it) */
  guide: number
  /** 0..1 moving-flap glow and ghost visibility */
  glow: number
  paper: string
  guided: boolean
  checkView: boolean
  flipped: boolean
  /** slow turntable spin (showcase) in radians per second, 0 = off */
  spin: number
  snapNonce: number
  reduced: boolean
  /** frame only the step's end state (a finished model on a turntable) */
  endFrame?: boolean
  /** override the step's camera hint (showcase, landing) */
  view?: { elevation?: number; azimuth?: number; zoom?: number }
}

export type Driver = (dt: number) => Frame

const FOV = 30
const snapNow = (f: Frame) => f.reduced

/** engine (x, y, z-up) → three (x, y-up, z toward viewer) */
const toThree = (p: V3) => new THREE.Vector3(p[0], p[2], -p[1])

interface StepBox {
  center: THREE.Vector3
  radius: number
  minY: number
  end: { center: THREE.Vector3; radius: number; minY: number }
}

export function PaperScene({
  model,
  driver,
  onGuidedChange,
  className,
  interactive = true,
  quality = "high",
  captureRef,
  framing = 0.74,
  lift = 0,
}: {
  model: BakedModel
  driver: Driver
  onGuidedChange?: (guided: boolean) => void
  className?: string
  interactive?: boolean
  quality?: "high" | "low"
  captureRef?: React.MutableRefObject<((size: number) => string) | null>
  /** share of the viewport the model should fill (PRD: about 70%) */
  framing?: number
  /** move the model up by this share of the height (room for controls below) */
  lift?: number
}) {
  const [dpr, setDpr] = useState<number>(quality === "low" ? 1 : 1.75)
  const [rich, setRich] = useState(quality === "high")
  return (
    <Canvas
      className={className}
      dpr={dpr}
      shadows="soft"
      camera={{ fov: FOV, near: 0.01, far: 40, position: [0, 2.2, 2.2] }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
      onCreated={({ gl }) => {
        // neutral tone mapping keeps the paper's colour true (ACES desaturates reds)
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 1.0
      }}
    >
      <PerformanceMonitor
        onDecline={() => {
          // quality tiers: drop pixel ratio first, then shadows
          setDpr((d) => (d > 1.2 ? 1.2 : 1))
          setRich(false)
        }}
      />
      <Studio />
      <Paper
        model={model}
        driver={driver}
        onGuidedChange={onGuidedChange}
        interactive={interactive}
        rich={rich}
        captureRef={captureRef}
        framing={framing}
        lift={lift}
      />
    </Canvas>
  )
}

function Studio() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.55
    return () => {
      env.dispose()
      pm.dispose()
    }
  }, [gl, scene])
  return (
    <>
      <hemisphereLight args={["#ffffff", "#d8d4cc", 0.55]} />
      <directionalLight
        name="key"
        position={[-1.6, 3.2, 2.1]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.012}
        shadow-radius={6}
        shadow-camera-left={-1.4}
        shadow-camera-right={1.4}
        shadow-camera-top={1.4}
        shadow-camera-bottom={-1.4}
        shadow-camera-near={0.5}
        shadow-camera-far={8}
      />
      <directionalLight position={[2.2, 1.4, -1.8]} intensity={0.45} color="#fff6ea" />
    </>
  )
}

function Paper({
  model,
  driver,
  onGuidedChange,
  interactive,
  rich,
  captureRef,
  framing,
  lift,
}: {
  model: BakedModel
  driver: Driver
  onGuidedChange?: (g: boolean) => void
  interactive: boolean
  rich: boolean
  captureRef?: React.MutableRefObject<((size: number) => string) | null>
  framing: number
  lift: number
}) {
  const { camera, size, gl, scene } = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const group = useRef<THREE.Group>(null)
  const flipGroup = useRef<THREE.Group>(null)
  const steps = model["fold:steps"]
  const nf = model["fold:faces"].length

  const { geometry, mesh, runtimes, ghostIndex } = useMemo(() => {
    const mesh = buildMesh(model, 0.035)
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(mesh.face.length * 3)
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
    const { w, h } = model["fold:paper"]
    const uv = new Float32Array(mesh.face.length * 2)
    for (let i = 0; i < mesh.face.length; i++) {
      uv[i * 2] = mesh.uv[i * 2] / w
      uv[i * 2 + 1] = mesh.uv[i * 2 + 1] / h
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
    g.setAttribute("glow", new THREE.BufferAttribute(new Float32Array(mesh.face.length), 1))
    g.setIndex(new THREE.BufferAttribute(mesh.index, 1))
    const runtimes: StepRuntime[] = steps.map((s) => prepareStep(s, nf))
    // polygon outline per face for the ghost (CP corners)
    const ghostIndex = model["fold:faces"].map((poly) => poly)
    return { geometry: g, mesh, runtimes, ghostIndex }
  }, [model, steps, nf])

  const paper = useMemo(() => new PaperMaterial(), [])
  useEffect(() => () => paper.dispose(), [paper])

  // per-step framing box, computed from a handful of frames through the fold
  const boxes = useMemo<StepBox[]>(() => {
    const tmp = new Float32Array(mesh.face.length * 3)
    return steps.map((s, i) => {
      const b = new THREE.Box3()
      let end = { center: new THREE.Vector3(), radius: 1, minY: 0 }
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        evaluateInto(s, runtimes[i], mesh, t, tmp, true)
        const bt = new THREE.Box3()
        for (let k = 0; k < tmp.length; k += 3) bt.expandByPoint(toThree([tmp[k], tmp[k + 1], tmp[k + 2]]))
        b.union(bt)
        if (t === 1) {
          const sp = bt.getBoundingSphere(new THREE.Sphere())
          end = { center: bt.getCenter(new THREE.Vector3()), radius: sp.radius, minY: bt.min.y }
        }
      }
      const sphere = b.getBoundingSphere(new THREE.Sphere())
      return { center: sphere.center, radius: sphere.radius, minY: b.min.y, end }
    })
  }, [steps, runtimes, mesh])

  const ghost = useMemo(() => new THREE.BufferGeometry(), [])
  const ghostMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#1d1d1f", transparent: true, opacity: 0, depthWrite: false }),
    []
  )

  const last = useRef({ step: -1, t: -1, paper: "", creases: -1 })
  const guideRef = useRef<{ a: THREE.Vector3; b: THREE.Vector3 }[]>([])
  const [guideState, setGuideState] = useState<{ pts: [THREE.Vector3, THREE.Vector3][]; draw: number }>({
    pts: [],
    draw: -1,
  })
  const guidedRef = useRef(true)
  const camGoal = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3(), init: false })
  const flipAngle = useRef(0)
  const spinAngle = useRef(0)
  const lastSnap = useRef(-1)
  const shadowRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    if (!captureRef) return
    captureRef.current = (px: number) => {
      const prev = gl.getPixelRatio()
      const prevSize = gl.getSize(new THREE.Vector2())
      gl.setPixelRatio(1)
      gl.setSize(px, px, false)
      const cam = camera as THREE.PerspectiveCamera
      const aspect = cam.aspect
      cam.aspect = 1
      cam.updateProjectionMatrix()
      gl.render(scene, cam)
      const url = gl.domElement.toDataURL("image/png")
      cam.aspect = aspect
      cam.updateProjectionMatrix()
      gl.setPixelRatio(prev)
      gl.setSize(prevSize.x, prevSize.y, false)
      return url
    }
    return () => {
      captureRef.current = null
    }
  }, [captureRef, gl, scene, camera])

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const f = driver(dt)
    const step = steps[f.step]
    const rt = runtimes[f.step]
    const L = last.current
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute

    if (f.step !== L.step) {
      // glow attribute for the faces that move this step
      const glow = geometry.getAttribute("glow") as THREE.BufferAttribute
      const moving = new Uint8Array(nf)
      step.moving.forEach((i) => (moving[i] = 1))
      for (let i = 0; i < mesh.face.length; i++) (glow.array as Float32Array)[i] = moving[mesh.face[i]]
      glow.needsUpdate = true
      // ghost outline of where the moving flap lands
      const pts: number[] = []
      const mats = step.moving
      if (mats.length) {
        const tmpMesh = {
          face: new Uint16Array(mats.flatMap((fi) => ghostIndex[fi].map(() => fi))),
          uv: new Float32Array(mats.flatMap((fi) => ghostIndex[fi].flatMap((q) => q))),
          index: new Uint32Array(0),
        }
        const out = new Float32Array(tmpMesh.face.length * 3)
        evaluateInto(step, rt, tmpMesh, 1, out, true)
        let k = 0
        for (const fi of mats) {
          const n = ghostIndex[fi].length
          for (let j = 0; j < n; j++) {
            const a = (k + j) * 3
            const b = (k + ((j + 1) % n)) * 3
            pts.push(out[a], out[a + 1], out[a + 2] + 0.002, out[b], out[b + 1], out[b + 2] + 0.002)
          }
          k += n
        }
      }
      ghost.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3))
      guideRef.current = step.guide.map(([a, b]) => ({
        a: new THREE.Vector3(a[0], a[1], a[2]),
        b: new THREE.Vector3(b[0], b[1], b[2]),
      }))
    }

    if (f.step !== L.step || f.t !== L.t) {
      evaluateInto(step, rt, mesh, f.t, pos.array as Float32Array, true)
      pos.needsUpdate = true
      geometry.computeVertexNormals()
      geometry.computeBoundingSphere()
    }
    // crease memory: everything creased before this step, plus this step's once it lands
    const creases = f.t >= 0.999 ? step.creases : f.step > 0 ? steps[f.step - 1].creases : 0
    if (creases !== L.creases) {
      paper.setCreases(model, creases)
      L.creases = creases
    }
    if (f.paper !== L.paper) {
      paper.setPaper(PAPERS.find((p) => p.id === f.paper) ?? PAPERS[0])
      L.paper = f.paper
    }
    paper.uniforms.uGlow.value = f.glow
    ghostMat.opacity = 0.28 * f.glow * (1 - f.t)

    // crease guide (React state only when it visibly changes)
    const drawQ = f.guide < 0 ? -1 : Math.round(f.guide * 24) / 24
    if (drawQ !== guideState.draw || (f.step !== L.step && guideRef.current.length)) {
      setGuideState({
        pts: guideRef.current.map((g) => [g.a, g.a.clone().lerp(g.b, Math.max(0.001, drawQ))]),
        draw: drawQ,
      })
    }

    // key light direction in view space for translucency
    const key = state.scene.getObjectByName("key") as THREE.DirectionalLight | undefined
    if (key) {
      paper.uniforms.uKeyDir.value
        .copy(key.position)
        .normalize()
        .transformDirection(state.camera.matrixWorldInverse)
    }

    // flip view / turntable
    const flipGoal = f.flipped ? Math.PI : 0
    flipAngle.current = f.reduced ? flipGoal : THREE.MathUtils.damp(flipAngle.current, flipGoal, 6, dt)
    spinAngle.current += f.spin * dt
    const box = f.endFrame ? boxes[f.step].end : boxes[f.step]
    if (flipGroup.current && group.current) {
      flipGroup.current.position.copy(box.center)
      flipGroup.current.rotation.set(flipAngle.current, spinAngle.current, 0)
      group.current.position.copy(box.center).multiplyScalar(-1)
    }

    // the table sits just under this step's lowest point
    if (shadowRef.current) {
      const gy = box.minY - 0.02
      const sh = shadowRef.current.position
      sh.y = snapNow(f) ? gy : THREE.MathUtils.damp(sh.y, gy, 3, dt)
      sh.x = box.center.x
      sh.z = box.center.z
    }

    // guided camera: frame the fold from the step's angle
    if (f.guided !== guidedRef.current) {
      guidedRef.current = f.guided
    }
    const cam = camera as THREE.PerspectiveCamera
    const shift = Math.round(size.height * lift)
    if (cam.view?.offsetY !== shift || cam.view?.fullHeight !== size.height || cam.view?.fullWidth !== size.width) {
      if (shift) cam.setViewOffset(size.width, size.height, 0, shift, size.width, size.height)
      else cam.clearViewOffset()
    }
    const hint = { ...(step.camera ?? {}), ...(f.view ?? {}) }
    const elev = THREE.MathUtils.degToRad(f.checkView ? 89 : (hint.elevation ?? 56))
    const azim = THREE.MathUtils.degToRad(f.checkView ? 0 : (hint.azimuth ?? 0))
    const aspect = size.width / Math.max(1, size.height)
    const fitR = box.radius / framing
    const vFov = THREE.MathUtils.degToRad(FOV) / 2
    const hFov = Math.atan(Math.tan(vFov) * aspect)
    const dist = (fitR / Math.sin(Math.min(vFov, hFov))) / (hint.zoom ?? 1)
    const target = box.center
    const goalPos = new THREE.Vector3(
      target.x + dist * Math.cos(elev) * Math.sin(azim),
      target.y + dist * Math.sin(elev),
      target.z + dist * Math.cos(elev) * Math.cos(azim)
    )
    const snap = !camGoal.current.init || f.reduced || f.snapNonce !== lastSnap.current
    lastSnap.current = f.snapNonce
    if (f.guided) {
      const ctl = controls.current
      if (snap) {
        cam.position.copy(goalPos)
        ctl?.target.copy(target)
      } else {
        cam.position.x = THREE.MathUtils.damp(cam.position.x, goalPos.x, 2.6, dt)
        cam.position.y = THREE.MathUtils.damp(cam.position.y, goalPos.y, 2.6, dt)
        cam.position.z = THREE.MathUtils.damp(cam.position.z, goalPos.z, 2.6, dt)
        if (ctl) {
          ctl.target.x = THREE.MathUtils.damp(ctl.target.x, target.x, 2.6, dt)
          ctl.target.y = THREE.MathUtils.damp(ctl.target.y, target.y, 2.6, dt)
          ctl.target.z = THREE.MathUtils.damp(ctl.target.z, target.z, 2.6, dt)
        }
      }
      if (!ctl) cam.lookAt(target)
      ctl?.update()
      camGoal.current.init = true
    }

    L.step = f.step
    L.t = f.t
  })

  const firstCenter = boxes[boxes.length - 1].center

  return (
    <>
      <group ref={flipGroup}>
        <group ref={group}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <mesh geometry={geometry} material={paper.material} castShadow receiveShadow />
            <lineSegments geometry={ghost} material={ghostMat} />
            {guideState.draw >= 0 &&
              guideState.pts.map(([a, b], i) => (
                <Line key={i} points={[a, b]} color="#2b2b2e" lineWidth={2.2} transparent opacity={0.85} depthTest />
              ))}
          </group>
        </group>
      </group>
      {/* the table: catches the key light's real shadow (a soft studio shadow) */}
      <mesh ref={shadowRef as unknown as React.RefObject<THREE.Mesh>} rotation={[-Math.PI / 2, 0, 0]} position={[firstCenter.x, boxes[0].minY - 0.02, firstCenter.z]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <shadowMaterial transparent opacity={rich ? 0.2 : 0.14} />
      </mesh>
      {interactive && (
        <OrbitControls
          ref={controls}
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.12}
          rotateSpeed={0.7}
          minDistance={0.4}
          maxDistance={8}
          onStart={() => onGuidedChange?.(false)}
        />
      )}
    </>
  )
}
