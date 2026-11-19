"use client"
// Soft paper sounds, synthesised (no audio files): a short filtered-noise
// rustle when a fold starts and a gentle press when it lands. Muted by default.

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio() {
  if (typeof window === "undefined") return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    const len = ctx.sampleRate * 1.2
    noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noise.getChannelData(0)
    let b = 0
    for (let i = 0; i < len; i++) {
      b = 0.97 * b + 0.03 * (Math.random() * 2 - 1)
      d[i] = (Math.random() * 2 - 1) * 0.6 + b * 2
    }
  }
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

function burst(dur: number, freq: number, q: number, gain: number) {
  const a = audio()
  if (!a || !noise) return
  const src = a.createBufferSource()
  src.buffer = noise
  const f = a.createBiquadFilter()
  f.type = "bandpass"
  f.frequency.value = freq
  f.Q.value = q
  const g = a.createGain()
  const t = a.currentTime
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + dur * 0.25)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(a.destination)
  src.start(t, Math.random() * 0.4, dur + 0.05)
}

export const paperSound = {
  unlock() {
    audio()
  },
  rustle() {
    burst(0.55, 2400, 0.7, 0.09)
    setTimeout(() => burst(0.35, 3800, 1.1, 0.05), 120)
  },
  press() {
    burst(0.12, 900, 0.9, 0.12)
  },
}
