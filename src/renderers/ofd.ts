import type { FileSource, FileType, Renderer } from '../core/types'

class OfdRenderer implements Renderer {
  readonly type: FileType = 'ofd'
  private container: HTMLElement | null = null
  private ofdData: unknown = null
  private pageDivs: HTMLDivElement[] = []
  private totalPageCount = 0
  private currentPageNum = 1
  private currentScale = 1

  mount(container: HTMLElement): void {
    this.container = container
    this.container.classList.add('xq-renderer-ofd')
  }

  async load(source: FileSource): Promise<void> {
    if (!this.container) return

    // Dynamic import from local source (lazy-loaded)
    const { parseOfdDocument, renderOfd, setPageScale } = await import('../lib/ofd/ofd.js')

    const data = await toArrayBuffer(source)

    // Parse OFD document
    const ofdData = await new Promise<unknown>((resolve, reject) => {
      parseOfdDocument({
        ofd: data,
        success(res: unknown) {
          resolve(res)
        },
        fail(err: unknown) {
          reject(new Error(String(err)))
        },
      })
    })

    // ofd.js returns an array of docs, take the first one
    this.ofdData = Array.isArray(ofdData) ? ofdData[0] : ofdData
    this.totalPageCount = (this.ofdData as Record<string, unknown>)?.pages
      ? ((this.ofdData as Record<string, unknown>).pages as unknown[]).length
      : 1

    // Render all pages
    this.renderPages(renderOfd, setPageScale)
  }

  destroy(): void {
    this.ofdData = null
    this.pageDivs = []
    if (this.container) {
      this.container.innerHTML = ''
      this.container.classList.remove('xq-renderer-ofd')
    }
    this.container = null
  }

  zoom(scale: number): void {
    this.currentScale = scale
    const wrapper = this.container?.querySelector('.xq-renderer-ofd__page') as HTMLElement | null
    if (wrapper) {
      wrapper.style.transformOrigin = 'top left'
      wrapper.style.transform = `scale(${scale})`
    }
  }

  rotate(degrees: number): void {
    const wrapper = this.container?.querySelector('.xq-renderer-ofd__page') as HTMLElement | null
    if (wrapper) {
      wrapper.style.transformOrigin = 'center top'
      wrapper.style.transform = `scale(${this.currentScale}) rotate(${degrees}deg)`
    }
  }

  getPageCount(): number {
    return this.totalPageCount
  }

  gotoPage(page: number): void {
    if (page < 1 || page > this.totalPageCount) return
    const target = this.pageDivs[page - 1]
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    this.currentPageNum = page
  }

  getCurrentPage(): number {
    return this.currentPageNum
  }

  private renderPages(
    renderOfd: (screenWidth: number, ofd: unknown) => HTMLDivElement[],
    setPageScale: (scale: number) => void,
  ): void {
    if (!this.container || !this.ofdData) return

    const containerWidth = this.container.parentElement?.clientWidth ?? 800
    const screenWidth = Math.floor(containerWidth * this.currentScale)

    this.container.innerHTML = ''
    this.pageDivs = []

    setPageScale(this.currentScale)

    const pageWrapper = document.createElement('div')
    pageWrapper.className = 'xq-renderer-ofd__page'

    const pages = renderOfd(screenWidth, this.ofdData)
    if (Array.isArray(pages)) {
      for (const pageDiv of pages) {
        pageWrapper.appendChild(pageDiv)
        this.pageDivs.push(pageDiv as HTMLDivElement)
      }
    }

    this.container.appendChild(pageWrapper)
  }
}

async function toArrayBuffer(source: FileSource): Promise<ArrayBuffer> {
  if (source instanceof ArrayBuffer) return source
  if (source instanceof File || source instanceof Blob) {
    return source.arrayBuffer()
  }
  // URL string — fetch as ArrayBuffer
  const resp = await fetch(source as string)
  return resp.arrayBuffer()
}

export function create(): Renderer {
  return new OfdRenderer()
}
