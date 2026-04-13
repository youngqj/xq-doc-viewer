import type { FileSource, FileType, Renderer } from '../core/types'
import { fileToArrayBuffer } from '../utils/file'

class PdfRenderer implements Renderer {
  readonly type: FileType = 'pdf'
  private container: HTMLElement | null = null
  private pages: HTMLCanvasElement[] = []
  private pdfDoc: unknown = null
  private userScale = 1        // user-requested multiplier (1 = fit-width)
  private baseScale = 1        // computed fit-width scale
  private rotation = 0
  private dpr = Math.min(window.devicePixelRatio || 1, 2)

  mount(container: HTMLElement): void {
    this.container = container
    this.container.classList.add('xq-renderer-pdf')
  }

  async load(source: FileSource): Promise<void> {
    const pdfjsLib = await import('pdfjs-dist')

    // Set worker source
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
    }

    const data = await fileToArrayBuffer(source)
    const loadingTask = pdfjsLib.getDocument({ data })
    const pdf = await loadingTask.promise
    this.pdfDoc = pdf

    // Compute fit-width base scale from first page
    const firstPage = await pdf.getPage(1)
    const defaultViewport = firstPage.getViewport({ scale: 1, rotation: this.rotation })
    const containerWidth = this.getContainerWidth()
    this.baseScale = containerWidth / defaultViewport.width

    await this.renderAllPages(pdf)
  }

  destroy(): void {
    this.pages = []
    if (this.container) {
      this.container.innerHTML = ''
      this.container.classList.remove('xq-renderer-pdf')
    }
    this.container = null
    this.pdfDoc = null
  }

  zoom(scale: number): void {
    this.userScale = Math.max(0.25, Math.min(5, scale))
    if (this.pdfDoc) {
      this.renderAllPages(this.pdfDoc as import('pdfjs-dist').PDFDocumentProxy)
    }
  }

  rotate(degrees: number): void {
    this.rotation = degrees
    if (this.pdfDoc) {
      // Recompute base scale for rotated viewport
      const pdf = this.pdfDoc as import('pdfjs-dist').PDFDocumentProxy
      pdf.getPage(1).then((firstPage) => {
        const vp = firstPage.getViewport({ scale: 1, rotation: this.rotation })
        this.baseScale = this.getContainerWidth() / vp.width
        this.renderAllPages(pdf)
      })
    }
  }

  getPageCount(): number {
    return (this.pdfDoc as import('pdfjs-dist').PDFDocumentProxy)?.numPages ?? 0
  }

  gotoPage(page: number): void {
    const canvas = this.pages[page - 1]
    canvas?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  getCurrentPage(): number {
    if (!this.container || this.pages.length === 0) return 1
    const scrollTop = this.container.parentElement?.scrollTop ?? 0
    for (let i = 0; i < this.pages.length; i++) {
      if (this.pages[i].offsetTop + this.pages[i].offsetHeight > scrollTop) {
        return i + 1
      }
    }
    return this.pages.length
  }

  print(): void {
    window.print()
  }

  /** Effective scale = fit-width base × user multiplier */
  private getEffectiveScale(): number {
    return this.baseScale * this.userScale
  }

  private getContainerWidth(): number {
    // Use content area width minus padding (16px × 2)
    const parent = this.container?.parentElement
    if (parent) return parent.clientWidth - 32
    return 800 // fallback
  }

  private async renderAllPages(pdf: import('pdfjs-dist').PDFDocumentProxy): Promise<void> {
    if (!this.container) return
    this.container.innerHTML = ''
    this.pages = []

    const effectiveScale = this.getEffectiveScale()
    const containerWidth = this.getContainerWidth()

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: effectiveScale, rotation: this.rotation })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      // High-DPI rendering: canvas pixels = viewport × dpr, CSS size = viewport
      canvas.width = Math.floor(viewport.width * this.dpr)
      canvas.height = Math.floor(viewport.height * this.dpr)

      // CSS size: clamp to container width to prevent horizontal scrollbar
      const cssWidth = Math.min(viewport.width, containerWidth)
      const cssHeight = viewport.height * (cssWidth / viewport.width)
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`

      ctx.scale(this.dpr, this.dpr)
      await page.render({ canvasContext: ctx, viewport }).promise
      this.container.appendChild(canvas)
      this.pages.push(canvas)
    }
  }
}

export function create(): Renderer {
  return new PdfRenderer()
}
