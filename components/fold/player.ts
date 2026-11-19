"use client"

// Lesson playback state. Lives outside React so the render loop can advance
// time every frame without re-rendering the page; React reads it through
// useSyncExternalStore for the controls.

import { useSyncExternalStore } from "react"

export type Phase = "guide" | "fold" | "hold" | "loop" | "done"

export interface PlayerState {
  step: number
  /** fold progress within the step, 0..1 */
  t: number
  phase: Phase
  /** seconds spent in the current phase */
  clock: number
  speed: 0.5 | 1 | 2
  scrubbing: boolean
  /** user is orbiting: the guided camera lets go until a double-tap */
  guided: boolean
  checkView: boolean
  flipped: boolean
  paper: string
  sound: boolean
  reduced: boolean
  /** bumps when the camera should snap instead of glide */
  snapNonce: number
}

export const GUIDE_SECONDS = 0.75
export const HOLD_SECONDS = 1.3
export const LOOP_SPEED = 0.55

type Listener = () => void

export class Player {
  state: PlayerState
  private listeners = new Set<Listener>()
  private uiState: PlayerState
  durations: number[] = []
  onStepChange?: (step: number) => void
  onFoldStart?: () => void
  onFoldLand?: () => void

  constructor(init: Partial<PlayerState> = {}) {
    this.state = {
      step: 0,
      t: 0,
      phase: "guide",
      clock: 0,
      speed: 1,
      scrubbing: false,
      guided: true,
      checkView: false,
      flipped: false,
      paper: "red",
      sound: false,
      reduced: false,
      snapNonce: 0,
      ...init,
    }
    this.uiState = { ...this.state }
  }

  get stepCount() {
    return this.durations.length
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  getSnapshot = () => this.uiState

  /** Push state to React. Called on discrete changes and ~10×/s during playback. */
  emit() {
    this.uiState = { ...this.state }
    this.listeners.forEach((l) => l())
  }

  set(patch: Partial<PlayerState>) {
    Object.assign(this.state, patch)
    this.emit()
  }

  goTo(step: number, opts: { fromEnd?: boolean } = {}) {
    const n = this.stepCount
    if (step < 0 || step >= n) return
    const s = this.state
    s.step = step
    s.clock = 0
    s.scrubbing = false
    if (s.reduced) {
      s.t = 1
      s.phase = "hold"
    } else if (opts.fromEnd) {
      s.t = 1
      s.phase = "hold"
    } else {
      s.t = 0
      s.phase = "guide"
    }
    this.onStepChange?.(step)
    this.emit()
  }
  next() {
    if (this.state.step < this.stepCount - 1) this.goTo(this.state.step + 1)
    else this.set({ phase: "done", t: 1 })
  }
  back() {
    if (this.state.phase === "done") return this.goTo(this.state.step)
    this.goTo(this.state.step - 1)
  }
  replay() {
    this.goTo(this.state.step)
  }
  scrub(t: number) {
    Object.assign(this.state, { t, scrubbing: true, phase: "hold", clock: 0 })
    this.emit()
  }
  endScrub() {
    this.state.scrubbing = false
    this.state.clock = 0
    this.emit()
  }

  /** advance time; returns true if the frame changed */
  tick(dt: number): boolean {
    const s = this.state
    if (s.scrubbing || s.phase === "done") return false
    const dur = (this.durations[s.step] ?? 1.5) / s.speed
    s.clock += dt
    let changed = false
    let emit = false
    switch (s.phase) {
      case "guide":
        if (s.clock >= GUIDE_SECONDS) {
          s.phase = "fold"
          s.clock = 0
          this.onFoldStart?.()
          emit = true
        }
        changed = true
        break
      case "fold":
        s.t = Math.min(1, s.clock / dur)
        changed = true
        if (s.t >= 1) {
          s.phase = "hold"
          s.clock = 0
          this.onFoldLand?.()
          emit = true
        }
        break
      case "hold":
        if (s.reduced) break
        if (s.clock >= HOLD_SECONDS) {
          // then loop slowly until the learner moves on
          s.phase = "loop"
          s.t = 0
          s.clock = -0.5
          emit = true
          changed = true
        }
        break
      case "loop": {
        const ldur = dur / LOOP_SPEED
        if (s.clock < 0) break
        s.t = Math.min(1, s.clock / ldur)
        changed = true
        if (s.t >= 1) {
          s.phase = "hold"
          s.clock = 0
          emit = true
        }
        break
      }
    }
    if (emit) this.emit()
    return changed
  }
}

export function usePlayer(p: Player) {
  return useSyncExternalStore(p.subscribe, p.getSnapshot, p.getSnapshot)
}
