import type { WatermarkConfig } from '../core/types'

const DEFAULT_FONT_SIZE = 16
const DEFAULT_COLOR = 'rgba(0,0,0,0.1)'
const DEFAULT_ROTATE = -30
const DEFAULT_GAP: [number, number] = [100, 100]

export class WatermarkManager {
  private overlayEl: HTMLElement | null = null
  private config: WatermarkConfig | null = null

  apply(parent: HTMLElement, config: WatermarkConfig): void {
    this.config = config
    this.remove()

    const overlay = document.createElement('div')
    overlay.className = 'xq-watermark-overlay'
    overlay.style.position = 'absolute'
    overlay.style.inset = '0'
    overlay.style.pointerEvents = 'none'
    overlay.style.zIndex = '999'
    overlay.style.overflow = 'hidden'

    if (config.image) {
      this.applyImageWatermark(overlay, config)
    } else if (config.text) {
      this.applyTextWatermark(overlay, config)
    }

    parent.appendChild(overlay)
    this.overlayEl = overlay
  }

  remove(): void {
    this.overlayEl?.remove()
    this.overlayEl = null
    this.config = null
  }

  getConfig(): WatermarkConfig | null {
    return this.config
  }

  private applyTextWatermark(overlay: HTMLElement, config: WatermarkConfig): void {
    const fontSize = config.fontSize ?? DEFAULT_FONT_SIZE
    const color = config.color ?? DEFAULT_COLOR
    const rotate = config.rotate ?? DEFAULT_ROTATE
    const [gapX, gapY] = config.gap ?? DEFAULT_GAP

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    const text = config.text ?? ''
    const font = `${fontSize}px sans-serif`
    ctx.font = font
    const metrics = ctx.measureText(text)
    const textWidth = metrics.width
    const textHeight = fontSize * 1.2

    // Tile size must accommodate rotated text + gap
    const tileW = textWidth + gapX
    const tileH = textHeight + gapY
    canvas.width = tileW
    canvas.height = tileH

    ctx.font = font
    ctx.fillStyle = color
    ctx.textBaseline = 'middle'

    ctx.translate(tileW / 2, tileH / 2)
    ctx.rotate((rotate * Math.PI) / 180)
    ctx.fillText(text, -textWidth / 2, 0)

    overlay.style.backgroundImage = `url(${canvas.toDataURL()})`
    overlay.style.backgroundRepeat = 'repeat'
  }

  private applyImageWatermark(overlay: HTMLElement, config: WatermarkConfig): void {
    const rotate = config.rotate ?? DEFAULT_ROTATE
    const [gapX, gapY] = config.gap ?? DEFAULT_GAP

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      const tileW = img.width + gapX
      const tileH = img.height + gapY
      canvas.width = tileW
      canvas.height = tileH

      ctx.globalAlpha = 0.1
      ctx.translate(tileW / 2, tileH / 2)
      ctx.rotate((rotate * Math.PI) / 180)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)

      overlay.style.backgroundImage = `url(${canvas.toDataURL()})`
      overlay.style.backgroundRepeat = 'repeat'
    }
    img.src = config.image!
  }
}
