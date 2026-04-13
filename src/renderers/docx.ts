import type { FileSource, FileType, Renderer } from '../core/types'
import { fileToArrayBuffer } from '../utils/file'

class DocxRenderer implements Renderer {
  readonly type: FileType = 'docx'
  private container: HTMLElement | null = null
  private wrapper: HTMLElement | null = null

  mount(container: HTMLElement): void {
    this.container = container
    this.wrapper = document.createElement('div')
    this.wrapper.className = 'xq-renderer-docx'
    this.container.appendChild(this.wrapper)
  }

  async load(source: FileSource): Promise<void> {
    const docxPreview = await import('docx-preview')
    const data = await fileToArrayBuffer(source)

    if (this.wrapper) {
      await docxPreview.renderAsync(data, this.wrapper)
    }
  }

  destroy(): void {
    if (this.container) {
      this.container.innerHTML = ''
    }
    this.wrapper = null
    this.container = null
  }

  print(): void {
    window.print()
  }
}

export function create(): Renderer {
  return new DocxRenderer()
}
