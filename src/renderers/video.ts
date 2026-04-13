import type { FileSource, FileType, Renderer } from '../core/types'
import { fileToUrl } from '../utils/file'

class VideoRenderer implements Renderer {
  readonly type: FileType = 'video'
  private container: HTMLElement | null = null
  private video: HTMLVideoElement | null = null

  mount(container: HTMLElement): void {
    this.container = container
    this.container.classList.add('xq-renderer-video')
  }

  async load(source: FileSource): Promise<void> {
    const url = await fileToUrl(source)
    this.video = document.createElement('video')
    this.video.src = url
    this.video.controls = true
    this.video.preload = 'metadata'
    this.container?.appendChild(this.video)
  }

  destroy(): void {
    if (this.video) {
      this.video.pause()
      this.video.src = ''
    }
    if (this.container) {
      this.container.innerHTML = ''
      this.container.classList.remove('xq-renderer-video')
    }
    this.video = null
    this.container = null
  }
}

export function create(): Renderer {
  return new VideoRenderer()
}
