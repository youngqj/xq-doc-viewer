import type { FileSource, FileType, Renderer } from '../core/types'
import { fileToArrayBuffer } from '../utils/file'

/** Number of pages to keep rendered above/below the visible area */
const BUFFER_PAGES = 2

class PdfRenderer implements Renderer {
  readonly type: FileType = 'pdf'
  private container: HTMLElement | null = null
  private scrollParent: HTMLElement | null = null
  private pdfDoc: import('pdfjs-dist').PDFDocumentProxy | null = null

  // Page slot elements (always present as placeholders)
  private slots: HTMLDivElement[] = []
  // Track which pages have been rendered
  private renderedPages = new Set<number>()

  private userScale = 0.5
  private baseScale = 1
  private rotation = 0

  private onScrollBound: (() => void) | null = null
  private _currentPage = 1
  private _totalPages = 0
  onPageChange?: (page: number) => void

  // Cached page dimensions (from first page at scale=1)
  private pageWidth = 0
  private pageHeight = 0

  mount(container: HTMLElement): void {
    this.container = container
    this.container.classList.add('xq-renderer-pdf')
    this.scrollParent = container.parentElement as HTMLElement
  }

  async load(source: FileSource): Promise<void> {
    if (!(globalThis as Record<string, unknown>).pdfjsWorker) {
      ;(globalThis as Record<string, unknown>).pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs')
    }

    const pdfjsLib = await import('pdfjs-dist')

    const data = await fileToArrayBuffer(source)
    const loadingTask = pdfjsLib.getDocument({ data })
    this.pdfDoc = await loadingTask.promise
    this._totalPages = this.pdfDoc.numPages

    // Get first page dimensions to compute base scale
    const firstPage = await this.pdfDoc.getPage(1)
    const vp = firstPage.getViewport({ scale: 1, rotation: this.rotation })
    this.pageWidth = vp.width
    this.pageHeight = vp.height
    this.baseScale = this.getContainerWidth() / vp.width
    // Clean up the page reference so it can be re-fetched for rendering
    firstPage.cleanup()

    // Build placeholder slots for all pages
    this.buildSlots()

    // Render visible pages
    await this.renderVisiblePages()

    // Listen for scroll to lazily render more pages
    this.attachScrollListener()
  }

  destroy(): void {
    this.removeScrollListener()
    this.slots = []
    this.renderedPages.clear()
    if (this.container) {
      this.container.innerHTML = ''
      this.container.classList.remove('xq-renderer-pdf')
    }
    this.container = null
    this.scrollParent = null
    if (this.pdfDoc) {
      this.pdfDoc.destroy()
      this.pdfDoc = null
    }
  }

  zoom(scale: number): void {
    this.userScale = Math.max(0.5, Math.min(5, scale))
    this.rebuildAll()
  }

  rotate(degrees: number): void {
    this.rotation = degrees
    if (this.pdfDoc) {
      this.pdfDoc.getPage(1).then((page) => {
        const vp = page.getViewport({ scale: 1, rotation: this.rotation })
        this.pageWidth = vp.width
        this.pageHeight = vp.height
        this.baseScale = this.getContainerWidth() / vp.width
        page.cleanup()
        this.rebuildAll()
      })
    }
  }

  getPageCount(): number {
    return this._totalPages
  }

  gotoPage(page: number): void {
    const slot = this.slots[page - 1]
    slot?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  getCurrentPage(): number {
    return this._currentPage
  }

  print(): void {
    window.print()
  }

  // ─── Private ───

  private getEffectiveScale(): number {
    return this.baseScale * this.userScale
  }

  private getContainerWidth(): number {
    const parent = this.container?.parentElement
    if (parent) return parent.clientWidth - 32
    return 800
  }

  /** Create placeholder divs with loading spinner for every page */
  private buildSlots(): void {
    if (!this.container) return
    this.container.innerHTML = ''
    this.slots = []
    this.renderedPages.clear()

    const scale = this.getEffectiveScale()
    const containerWidth = this.getContainerWidth()
    const cssWidth = Math.min(this.pageWidth * scale, containerWidth)
    const ratio = cssWidth / (this.pageWidth * scale)
    const cssHeight = this.pageHeight * scale * ratio

    for (let i = 0; i < this._totalPages; i++) {
      const slot = document.createElement('div')
      slot.className = 'xq-pdf-page-slot'
      slot.style.width = `${Math.floor(cssWidth)}px`
      slot.style.height = `${Math.floor(cssHeight)}px`
      slot.style.marginBottom = '12px'
      slot.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)'
      slot.style.background = '#fff'
      slot.style.position = 'relative'

      // Loading spinner
      const spinner = document.createElement('div')
      spinner.className = 'xq-pdf-loading'
      spinner.innerHTML = '<div class="xq-pdf-spinner"></div>'
      slot.appendChild(spinner)

      this.container.appendChild(slot)
      this.slots.push(slot)
    }
  }

  /** Re-render everything after zoom/rotate change */
  private rebuildAll(): void {
    this.removeScrollListener()
    this.buildSlots()
    this.renderVisiblePages().then(() => {
      this.attachScrollListener()
    })
  }

  /** Determine which pages are visible and render them */
  private async renderVisiblePages(): Promise<void> {
    if (!this.scrollParent || !this.pdfDoc) return

    const parentRect = this.scrollParent.getBoundingClientRect()
    const visibleTop = parentRect.top
    const visibleBottom = parentRect.bottom

    let firstVisible = -1
    let lastVisible = -1

    for (let i = 0; i < this.slots.length; i++) {
      const rect = this.slots[i].getBoundingClientRect()
      if (rect.bottom > visibleTop && rect.top < visibleBottom) {
        if (firstVisible === -1) firstVisible = i
        lastVisible = i
      }
    }

    if (firstVisible === -1) {
      firstVisible = 0
      lastVisible = 0
    }

    const renderStart = Math.max(0, firstVisible - BUFFER_PAGES)
    const renderEnd = Math.min(this._totalPages - 1, lastVisible + BUFFER_PAGES)

    // Render pages that haven't been rendered yet
    const promises: Promise<void>[] = []
    for (let i = renderStart; i <= renderEnd; i++) {
      if (!this.renderedPages.has(i)) {
        promises.push(this.renderPage(i))
      }
    }
    await Promise.all(promises)
  }

  /** Render a single page into its slot */
  private async renderPage(index: number): Promise<void> {
    if (!this.pdfDoc || this.renderedPages.has(index)) return
    this.renderedPages.add(index)

    const page = await this.pdfDoc.getPage(index + 1)
    const dpr = window.devicePixelRatio || 1
    const effectiveScale = this.getEffectiveScale()

    const cssViewport = page.getViewport({ scale: effectiveScale, rotation: this.rotation })
    const renderViewport = page.getViewport({ scale: effectiveScale * dpr, rotation: this.rotation })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(renderViewport.width)
    canvas.height = Math.floor(renderViewport.height)

    const containerWidth = this.getContainerWidth()
    const cssWidth = Math.min(cssViewport.width, containerWidth)
    const ratio = cssWidth / cssViewport.width
    const cssHeight = cssViewport.height * ratio
    canvas.style.width = `${Math.floor(cssWidth)}px`
    canvas.style.height = `${Math.floor(cssHeight)}px`
    canvas.style.display = 'block'

    // pdfjs 5.x: use `canvas` param (recommended), set canvasContext undefined
    await page.render({ canvas, viewport: renderViewport } as import('pdfjs-dist/types/src/display/api').RenderParameters).promise

    // Replace slot content with rendered canvas
    const slot = this.slots[index]
    if (slot) {
      slot.innerHTML = ''
      slot.style.background = 'none'
      slot.appendChild(canvas)
    }
  }

  private attachScrollListener(): void {
    this.removeScrollListener()
    if (!this.scrollParent) return
    let rafPending = false
    this.onScrollBound = () => {
      // Update page number immediately on every scroll
      this.detectCurrentPage()
      // Throttle rendering of off-screen pages
      if (!rafPending) {
        rafPending = true
        requestAnimationFrame(() => {
          rafPending = false
          this.renderVisiblePages()
        })
      }
    }
    this.scrollParent.addEventListener('scroll', this.onScrollBound, { passive: true })
  }

  private removeScrollListener(): void {
    if (this.onScrollBound && this.scrollParent) {
      this.scrollParent.removeEventListener('scroll', this.onScrollBound)
      this.onScrollBound = null
    }
  }

  /** Detect current page from scroll position — lightweight, no rendering */
  private detectCurrentPage(): void {
    if (!this.scrollParent || this.slots.length === 0) return
    const parentRect = this.scrollParent.getBoundingClientRect()
    const midY = parentRect.top + parentRect.height / 2

    let page = 1
    for (let i = 0; i < this.slots.length; i++) {
      const rect = this.slots[i].getBoundingClientRect()
      if (rect.bottom >= midY) {
        page = i + 1
        break
      }
      page = i + 1
    }

    if (page !== this._currentPage) {
      this._currentPage = page
      this.onPageChange?.(page)
    }
  }
}

export function create(): Renderer {
  return new PdfRenderer()
}
