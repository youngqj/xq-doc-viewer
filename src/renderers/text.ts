import type { FileSource, FileType, Renderer } from '../core/types'

class TextRenderer implements Renderer {
  readonly type: FileType = 'text'
  private container: HTMLElement | null = null
  private pre: HTMLPreElement | null = null

  mount(container: HTMLElement): void {
    this.container = container
    this.container.classList.add('xq-renderer-text')
  }

  async load(source: FileSource): Promise<void> {
    let text: string
    if (typeof source === 'string') {
      const resp = await fetch(source)
      text = await resp.text()
    } else if (source instanceof Blob) {
      text = await source.text()
    } else {
      // ArrayBuffer
      text = new TextDecoder().decode(source)
    }

    this.pre = document.createElement('pre')

    // Add line numbers
    const lines = text.split('\n')
    const numbered = lines
      .map((line, i) => {
        const num = String(i + 1).padStart(4, ' ')
        return `<span class="xq-line-num">${num}</span>  ${escapeHtml(line)}`
      })
      .join('\n')

    this.pre.innerHTML = numbered
    this.container?.appendChild(this.pre)
  }

  destroy(): void {
    if (this.container) {
      this.container.innerHTML = ''
      this.container.classList.remove('xq-renderer-text')
    }
    this.pre = null
    this.container = null
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function create(): Renderer {
  return new TextRenderer()
}
