import type { FileSource, FileType, Renderer } from '../core/types'
import { fileToUrl } from '../utils/file'

const BAR_COUNT = 32
const BAR_GAP = 2
const BAR_MIN_H = 3
const BAR_RADIUS = 2
const COLOR_PLAYING = '#4f87f7'
const COLOR_IDLE = '#a0b4d0'

class AudioRenderer implements Renderer {
  readonly type: FileType = 'audio'
  private container: HTMLElement | null = null
  private audio: HTMLAudioElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private analyser: AnalyserNode | null = null
  private audioCtx: AudioContext | null = null
  private sourceNode: MediaElementAudioSourceNode | null = null
  private rafId = 0
  private connected = false

  mount(container: HTMLElement): void {
    this.container = container
    this.container.classList.add('xq-renderer-audio')
  }

  async load(source: FileSource): Promise<void> {
    if (!this.container) return

    const url = await fileToUrl(source)

    // Wrapper
    const wrapper = document.createElement('div')
    wrapper.className = 'xq-audio-wrapper'

    // Canvas visualizer
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'xq-audio-canvas'
    this.canvas.width = 400
    this.canvas.height = 120
    this.ctx = this.canvas.getContext('2d')
    wrapper.appendChild(this.canvas)

    // Audio element
    this.audio = document.createElement('audio')
    this.audio.src = url
    this.audio.controls = true
    this.audio.preload = 'metadata'
    this.audio.crossOrigin = 'anonymous'
    wrapper.appendChild(this.audio)

    this.container.appendChild(wrapper)

    // Draw idle state
    this.drawIdle()

    // Connect Web Audio API on first play (user gesture required)
    this.audio.addEventListener('play', this.ensureAnalyser)
    this.audio.addEventListener('play', this.startVisualize)
    this.audio.addEventListener('pause', this.stopVisualize)
    this.audio.addEventListener('ended', this.stopVisualize)
  }

  destroy(): void {
    this.stopVisualize()
    if (this.audio) {
      this.audio.removeEventListener('play', this.ensureAnalyser)
      this.audio.removeEventListener('play', this.startVisualize)
      this.audio.removeEventListener('pause', this.stopVisualize)
      this.audio.removeEventListener('ended', this.stopVisualize)
      this.audio.pause()
      this.audio.src = ''
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {})
    }
    if (this.container) {
      this.container.innerHTML = ''
      this.container.classList.remove('xq-renderer-audio')
    }
    this.audio = null
    this.canvas = null
    this.ctx = null
    this.analyser = null
    this.audioCtx = null
    this.sourceNode = null
    this.connected = false
    this.container = null
  }

  /* ── Web Audio setup ── */

  private ensureAnalyser = (): void => {
    if (this.connected || !this.audio) return
    this.connected = true

    this.audioCtx = new AudioContext()
    this.analyser = this.audioCtx.createAnalyser()
    this.analyser.fftSize = 128
    this.analyser.smoothingTimeConstant = 0.75

    this.sourceNode = this.audioCtx.createMediaElementSource(this.audio)
    this.sourceNode.connect(this.analyser)
    this.analyser.connect(this.audioCtx.destination)
  }

  /* ── Animation loop ── */

  private startVisualize = (): void => {
    if (this.rafId) return
    this.drawFrame()
  }

  private stopVisualize = (): void => {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
    // Smoothly settle to idle
    this.drawIdle()
  }

  private drawFrame = (): void => {
    if (!this.analyser || !this.ctx || !this.canvas) return

    const data = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(data)

    const { width, height } = this.canvas
    const barW = (width - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT

    this.ctx.clearRect(0, 0, width, height)

    for (let i = 0; i < BAR_COUNT; i++) {
      const val = data[i] ?? 0
      const barH = Math.max(BAR_MIN_H, (val / 255) * height * 0.9)
      const x = i * (barW + BAR_GAP)
      const y = (height - barH) / 2

      // Gradient color per bar — center bars brighter
      const ratio = 1 - Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2)
      const alpha = 0.5 + ratio * 0.5
      this.ctx.fillStyle = hexWithAlpha(COLOR_PLAYING, alpha)

      roundRect(this.ctx, x, y, barW, barH, BAR_RADIUS)
    }

    this.rafId = requestAnimationFrame(this.drawFrame)
  }

  private drawIdle(): void {
    if (!this.ctx || !this.canvas) return
    const { width, height } = this.canvas
    const barW = (width - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT

    this.ctx.clearRect(0, 0, width, height)

    for (let i = 0; i < BAR_COUNT; i++) {
      const barH = BAR_MIN_H + Math.sin(i * 0.5) * 4
      const x = i * (barW + BAR_GAP)
      const y = (height - barH) / 2

      this.ctx.fillStyle = COLOR_IDLE
      roundRect(this.ctx, x, y, barW, barH, BAR_RADIUS)
    }
  }
}

/* ── Helpers ── */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
}

function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function create(): Renderer {
  return new AudioRenderer()
}
