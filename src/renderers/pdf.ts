import type { FileSource, FileType, Renderer } from '../core/types'
import { fileToArrayBuffer } from '../utils/file'

class PdfRenderer implements Renderer {
  readonly type: FileType = 'pdf'
  private container: HTMLElement | null = null
  private pages: HTMLCanvasElement[] = []
  private pdfDoc: unknown = null
  private scale = 1
  private rotation = 0

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
    this.scale = Math.max(0.25, Math.min(5, scale))
    if (this.pdfDoc) {
      this.renderAllPages(this.pdfDoc as import('pdfjs-dist').PDFDocumentProxy)
    }
  }

  rotate(degrees: number): void {
    this.rotation = degrees
    if (this.pdfDoc) {
      this.renderAllPages(this.pdfDoc as import('pdfjs-dist').PDFDocumentProxy)
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
    // Approximate based on scroll position
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

  private async renderAllPages(pdf: import('pdfjs-dist').PDFDocumentProxy): Promise<void> {
    if (!this.container) return
    this.container.innerHTML = ''
    this.pages = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: this.scale, rotation: this.rotation })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvasContext: ctx, viewport }).promise
      this.container.appendChild(canvas)
      this.pages.push(canvas)
    }
  }
}

export function create(): Renderer {
  return new PdfRenderer()
}
