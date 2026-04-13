import type { FileSource, FileType, Renderer } from '../core/types'
import { fileToArrayBuffer } from '../utils/file'

const ROW_HEIGHT = 30
const BUFFER_ROWS = 10

class ExcelRenderer implements Renderer {
  readonly type: FileType = 'excel'
  private container: HTMLElement | null = null
  private wrapper: HTMLElement | null = null
  private sheetNames: string[] = []
  private sheets: Map<string, string[][]> = new Map()
  private currentSheet = 0

  // Virtual scroll state
  private scrollContainer: HTMLElement | null = null
  private spacerTop: HTMLElement | null = null
  private spacerBottom: HTMLElement | null = null
  private tbody: HTMLTableSectionElement | null = null
  private thead: HTMLTableSectionElement | null = null
  private currentRows: string[][] = []
  private visibleStart = 0
  private visibleEnd = 0
  private onScroll: (() => void) | null = null

  mount(container: HTMLElement): void {
    this.container = container
    this.wrapper = document.createElement('div')
    this.wrapper.className = 'xq-renderer-table'
    this.container.appendChild(this.wrapper)
  }

  async load(source: FileSource): Promise<void> {
    const ExcelJS = await import('exceljs')
    const data = await fileToArrayBuffer(source)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(data)

    this.sheetNames = []
    this.sheets = new Map()

    workbook.eachSheet((worksheet) => {
      const name = worksheet.name
      this.sheetNames.push(name)
      const rows: string[][] = []
      worksheet.eachRow((row) => {
        const cells: string[] = []
        const colCount = worksheet.columnCount
        for (let col = 1; col <= colCount; col++) {
          const cell = row.getCell(col)
          let text = ''
          try {
            text = cell.text || ''
          } catch {
            text = cell.value != null ? String(cell.value) : ''
          }
          cells.push(text)
        }
        rows.push(cells)
      })
      this.sheets.set(name, rows)
    })

    this.renderSheet(0)
  }

  destroy(): void {
    this.detachScroll()
    if (this.container) {
      this.container.innerHTML = ''
    }
    this.wrapper = null
    this.container = null
    this.scrollContainer = null
    this.spacerTop = null
    this.spacerBottom = null
    this.tbody = null
    this.thead = null
    this.sheets = new Map()
    this.sheetNames = []
    this.currentRows = []
  }

  getPageCount(): number {
    return this.sheetNames.length
  }

  gotoPage(page: number): void {
    this.currentSheet = page - 1
    this.renderSheet(this.currentSheet)
  }

  getCurrentPage(): number {
    return this.currentSheet + 1
  }

  private renderSheet(index: number): void {
    if (!this.wrapper) return
    this.detachScroll()

    const name = this.sheetNames[index]
    const rows = this.sheets.get(name)
    if (!rows || rows.length === 0) {
      this.wrapper.innerHTML = '<p style="padding:16px;color:var(--xq-text-secondary)">Empty sheet</p>'
      return
    }

    this.currentRows = rows

    // Small tables — render directly, no virtual scroll
    if (rows.length <= 200) {
      this.renderFull(rows)
      return
    }

    // Large tables — virtual scroll
    this.renderVirtual(rows)
  }

  private renderFull(rows: string[][]): void {
    if (!this.wrapper) return
    let html = '<table>'
    rows.forEach((row, ri) => {
      const tag = ri === 0 ? 'th' : 'td'
      html += '<tr>'
      row.forEach((cell) => {
        html += `<${tag}>${escapeHtml(cell)}</${tag}>`
      })
      html += '</tr>'
    })
    html += '</table>'
    this.wrapper.innerHTML = html
  }

  private renderVirtual(rows: string[][]): void {
    if (!this.wrapper) return
    this.wrapper.innerHTML = ''

    // The scroll container takes full available height
    this.scrollContainer = document.createElement('div')
    this.scrollContainer.className = 'xq-virtual-scroll'
    this.scrollContainer.style.cssText = 'overflow-y:auto;height:100%;position:relative;'

    // Table with fixed header
    const table = document.createElement('table')

    // Header row (always visible)
    this.thead = document.createElement('thead')
    const headerRow = rows[0]
    const headerTr = document.createElement('tr')
    headerRow.forEach((cell) => {
      const th = document.createElement('th')
      th.textContent = cell
      headerTr.appendChild(th)
    })
    this.thead.appendChild(headerTr)
    table.appendChild(this.thead)

    // Top spacer
    this.spacerTop = document.createElement('tr')
    this.spacerTop.style.height = '0px'

    // Body
    this.tbody = document.createElement('tbody')
    this.tbody.appendChild(this.spacerTop)

    // Bottom spacer
    this.spacerBottom = document.createElement('tr')
    this.spacerBottom.style.height = '0px'
    this.tbody.appendChild(this.spacerBottom)

    table.appendChild(this.tbody)
    this.scrollContainer.appendChild(table)
    this.wrapper.appendChild(this.scrollContainer)

    // Initial render
    this.updateVisibleRows()

    // Scroll listener
    this.onScroll = () => this.updateVisibleRows()
    this.scrollContainer.addEventListener('scroll', this.onScroll, { passive: true })
  }

  private updateVisibleRows(): void {
    if (!this.scrollContainer || !this.tbody || !this.spacerTop || !this.spacerBottom) return

    const rows = this.currentRows
    const dataRows = rows.length - 1 // exclude header
    if (dataRows <= 0) return

    const scrollTop = this.scrollContainer.scrollTop
    const viewHeight = this.scrollContainer.clientHeight

    // Calculate visible range (data rows start at index 1)
    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS)
    const endIdx = Math.min(dataRows, Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + BUFFER_ROWS)

    // Skip re-render if range unchanged
    if (startIdx === this.visibleStart && endIdx === this.visibleEnd) return
    this.visibleStart = startIdx
    this.visibleEnd = endIdx

    // Update spacers
    this.spacerTop.style.height = `${startIdx * ROW_HEIGHT}px`
    this.spacerBottom.style.height = `${Math.max(0, (dataRows - endIdx) * ROW_HEIGHT)}px`

    // Remove old data rows (everything between spacers)
    const frag = document.createDocumentFragment()
    frag.appendChild(this.spacerTop)

    for (let i = startIdx; i < endIdx; i++) {
      const row = rows[i + 1] // +1 because row 0 is header
      const tr = document.createElement('tr')
      tr.style.height = `${ROW_HEIGHT}px`
      row.forEach((cell) => {
        const td = document.createElement('td')
        td.textContent = cell
        tr.appendChild(td)
      })
      frag.appendChild(tr)
    }

    frag.appendChild(this.spacerBottom)

    // Replace tbody content
    this.tbody.innerHTML = ''
    this.tbody.appendChild(frag)
  }

  private detachScroll(): void {
    if (this.scrollContainer && this.onScroll) {
      this.scrollContainer.removeEventListener('scroll', this.onScroll)
    }
    this.onScroll = null
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function create(): Renderer {
  return new ExcelRenderer()
}
