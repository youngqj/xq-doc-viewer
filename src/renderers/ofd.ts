import type { FileSource, FileType, Renderer } from '../core/types'

class OfdRenderer implements Renderer {
  readonly type: FileType = 'ofd'
  private container: HTMLElement | null = null
  private ofdViewer: EasyOFDInstance | null = null
  private totalPages = 0
  private currentPageNum = 1

  mount(container: HTMLElement): void {
    this.container = container
    this.container.classList.add('xq-renderer-ofd')
  }

  async load(source: FileSource): Promise<void> {
    if (!this.container) return

    const EasyOFD = (await import('easyofd')).default

    const id = 'xq-ofd-' + Date.now()
    const viewer = new EasyOFD(id, this.container) as unknown as EasyOFDInstance
    this.ofdViewer = viewer

    const blob = await toBlob(source)

    await new Promise<void>((resolve) => {
      let resolved = false

      // Listen on the doc's event bus — does NOT override the original handler
      viewer.doc.$on('DocumentChange', () => {
        if (!resolved) {
          resolved = true
          this.totalPages = viewer.view?.AllPageNo ?? 1
          this.currentPageNum = viewer.view?.pageNow ?? 1
          resolve()
        }
        this.currentPageNum = viewer.view?.pageNow ?? 1
      })

      viewer.loadFromBlob(blob)

      // Fallback timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          this.totalPages = viewer.view?.AllPageNo ?? 1
          resolve()
        }
      }, 8000)
    })

    // Hide EasyOFD's built-in toolbar — we use our own
    this.hideBuiltinToolbar()
  }

  destroy(): void {
    this.ofdViewer = null
    if (this.container) {
      this.container.innerHTML = ''
      this.container.classList.remove('xq-renderer-ofd')
    }
    this.container = null
  }

  zoom(scale: number): void {
    if (!this.ofdViewer) return
    this.ofdViewer.zoomSize = scale
    this.ofdViewer.DocumentChange()
  }

  getPageCount(): number {
    return this.totalPages
  }

  gotoPage(page: number): void {
    if (!this.ofdViewer?.view || page < 1 || page > this.totalPages) return
    this.ofdViewer.view.pageNow = page
    this.ofdViewer.DocumentChange()
    this.currentPageNum = page
  }

  getCurrentPage(): number {
    return this.currentPageNum
  }

  private hideBuiltinToolbar(): void {
    if (!this.container) return
    const rootDiv = this.container.querySelector(`[id^="xq-ofd-"]`)
    if (rootDiv) {
      const toolbar = rootDiv.querySelector('div:first-child')
      if (toolbar && toolbar.querySelector('.OfdButton')) {
        ;(toolbar as HTMLElement).style.display = 'none'
      }
    }
  }
}

interface EasyOFDDoc {
  $on(event: string, handler: (...args: unknown[]) => void): void
}

interface EasyOFDView {
  pageNow: number
  AllPageNo: number
}

interface EasyOFDInstance {
  loadFromBlob(blob: Blob): void
  DocumentChange(): void
  doc: EasyOFDDoc
  view: EasyOFDView
  zoomSize: number
}

async function toBlob(source: FileSource): Promise<Blob> {
  if (source instanceof Blob) return source
  if (source instanceof ArrayBuffer) return new Blob([source])
  const resp = await fetch(source as string)
  return resp.blob()
}

export function create(): Renderer {
  return new OfdRenderer()
}
