import type { FileSource, FileType, Renderer } from '../core/types'

class MarkdownRenderer implements Renderer {
  readonly type: FileType = 'markdown'
  private container: HTMLElement | null = null
  private wrapper: HTMLElement | null = null

  mount(container: HTMLElement): void {
    this.container = container
    this.wrapper = document.createElement('div')
    this.wrapper.className = 'xq-renderer-markdown'
    this.container.appendChild(this.wrapper)
  }

  async load(source: FileSource): Promise<void> {
    const [{ marked }, hljs] = await Promise.all([
      import('marked'),
      import('highlight.js'),
    ])

    let text: string
    if (typeof source === 'string') {
      const resp = await fetch(source)
      text = await resp.text()
    } else if (source instanceof Blob) {
      text = await source.text()
    } else {
      text = new TextDecoder().decode(source)
    }

    marked.setOptions({
      highlight(code: string, lang: string) {
        if (lang && hljs.default.getLanguage(lang)) {
          return hljs.default.highlight(code, { language: lang }).value
        }
        return hljs.default.highlightAuto(code).value
      },
    } as import('marked').MarkedOptions)

    const html = await marked(text)
    if (this.wrapper) {
      this.wrapper.innerHTML = html
    }
  }

  destroy(): void {
    if (this.container) {
      this.container.innerHTML = ''
    }
    this.wrapper = null
    this.container = null
  }
}

export function create(): Renderer {
  return new MarkdownRenderer()
}
