import type { FileSource, FileType, Renderer } from '../core/types'
import { fileToUrl } from '../utils/file'

class ImageRenderer implements Renderer {
  readonly type: FileType = 'image'
  private container: HTMLElement | null = null
  private img: HTMLImageElement | null = null
  private scale = 1
  private rotation = 0

  mount(container: HTMLElement): void {
    this.container = container
    this.container.classList.add('xq-renderer-image')
  }

  async load(source: FileSource): Promise<void> {
    const url = await fileToUrl(source)
    this.img = document.createElement('img')
    this.img.src = url
    await new Promise<void>((resolve, reject) => {
      this.img!.onload = () => resolve()
      this.img!.onerror = () => reject(new Error('Failed to load image'))
    })
    this.container?.appendChild(this.img)
  }

  destroy(): void {
    if (this.container) {
      this.container.innerHTML = ''
      this.container.classList.remove('xq-renderer-image')
    }
    this.img = null
    this.container = null
  }

  zoom(scale: number): void {
    this.scale = Math.max(0.1, Math.min(10, scale))
    this.applyTransform()
  }

  rotate(degrees: number): void {
    this.rotation = degrees
    this.applyTransform()
  }

  print(): void {
    window.print()
  }

  private applyTransform(): void {
    if (!this.img) return
    this.img.style.transform = `scale(${this.scale}) rotate(${this.rotation}deg)`
  }
}

export function create(): Renderer {
  return new ImageRenderer()
}
