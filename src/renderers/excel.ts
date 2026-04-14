import type { FileSource, FileType, Renderer } from '../core/types'
import { fileToArrayBuffer } from '../utils/file'

/* ─── Interfaces ─── */

interface CellStyle {
  backgroundColor?: string
  color?: string
  fontWeight?: string
  fontStyle?: string
  fontSize?: string
  textDecoration?: string
  textAlign?: string
  verticalAlign?: string
  whiteSpace?: string
  borderTop?: string
  borderRight?: string
  borderBottom?: string
  borderLeft?: string
}

interface SheetCell {
  text: string
  colSpan: number
  rowSpan: number
  hidden: boolean
  style: CellStyle
}

interface SheetData {
  cells: SheetCell[][]
  rowHeights: number[]
  colWidths: number[]
  rowCount: number
  colCount: number
}

/* ─── Utilities ─── */

function parseCellAddress(addr: string): { row: number; col: number } {
  const match = addr.match(/^([A-Z]+)(\d+)$/)
  if (!match) return { row: 0, col: 0 }
  let col = 0
  for (const ch of match[1]) {
    col = col * 26 + (ch.charCodeAt(0) - 64)
  }
  return { row: parseInt(match[2], 10), col }
}

function parseRange(range: string): { top: number; left: number; bottom: number; right: number } {
  const [startAddr, endAddr] = range.split(':')
  const start = parseCellAddress(startAddr)
  const end = endAddr ? parseCellAddress(endAddr) : start
  return { top: start.row, left: start.col, bottom: end.row, right: end.col }
}

function argbToHex(argb: string | undefined): string | undefined {
  if (!argb || argb.length < 6) return undefined
  // ExcelJS ARGB format: "FFRRGGBB" (8 chars) or "RRGGBB" (6 chars)
  if (argb.length === 8) return '#' + argb.substring(2)
  if (argb.length === 6) return '#' + argb
  return undefined
}

function resolveColor(color: Record<string, unknown> | undefined): string | undefined {
  if (!color) return undefined
  // ExcelJS color can be { argb: 'FF00FF00' } or { theme: N, tint: X }
  if (typeof color.argb === 'string') return argbToHex(color.argb)
  // Theme colors are hard to resolve without the theme XML; skip for now
  return undefined
}

const BORDER_STYLE_MAP: Record<string, string> = {
  thin: '1px solid',
  medium: '2px solid',
  thick: '3px solid',
  dotted: '1px dotted',
  dashed: '1px dashed',
  dashDot: '1px dashed',
  dashDotDot: '1px dashed',
  double: '3px double',
  hair: '1px solid',
  mediumDashed: '2px dashed',
  mediumDashDot: '2px dashed',
  mediumDashDotDot: '2px dashed',
  slantDashDot: '2px dashed',
}

function borderToCSS(border: Record<string, unknown> | undefined): string | undefined {
  if (!border || !border.style) return undefined
  const style = BORDER_STYLE_MAP[border.style as string] || '1px solid'
  const color = resolveColor(border.color as Record<string, unknown> | undefined) || '#000'
  return `${style} ${color}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCellStyle(cell: any): CellStyle {
  const style: CellStyle = {}

  // Fill / background color
  const fill = cell.fill
  if (fill) {
    if (fill.type === 'pattern' && fill.pattern === 'solid') {
      const bg = resolveColor(fill.fgColor)
      if (bg) style.backgroundColor = bg
    }
  }

  // Font
  const font = cell.font
  if (font) {
    if (font.bold) style.fontWeight = 'bold'
    if (font.italic) style.fontStyle = 'italic'
    if (font.underline) style.textDecoration = 'underline'
    if (font.strike) style.textDecoration = (style.textDecoration ? style.textDecoration + ' line-through' : 'line-through')
    if (font.size) style.fontSize = `${font.size}pt`
    const fontColor = resolveColor(font.color)
    if (fontColor) style.color = fontColor
  }

  // Alignment
  const alignment = cell.alignment
  if (alignment) {
    if (alignment.horizontal) style.textAlign = alignment.horizontal
    if (alignment.vertical) {
      const vMap: Record<string, string> = { top: 'top', middle: 'middle', bottom: 'bottom' }
      style.verticalAlign = vMap[alignment.vertical] || 'middle'
    }
    if (alignment.wrapText) style.whiteSpace = 'pre-wrap'
  }

  // Borders
  const border = cell.border
  if (border) {
    const t = borderToCSS(border.top)
    const r = borderToCSS(border.right)
    const b = borderToCSS(border.bottom)
    const l = borderToCSS(border.left)
    if (t) style.borderTop = t
    if (r) style.borderRight = r
    if (b) style.borderBottom = b
    if (l) style.borderLeft = l
  }

  return style
}

function cellStyleToCSS(s: CellStyle): string {
  const parts: string[] = []
  if (s.backgroundColor) parts.push(`background-color:${s.backgroundColor}`)
  if (s.color) parts.push(`color:${s.color}`)
  if (s.fontWeight) parts.push(`font-weight:${s.fontWeight}`)
  if (s.fontStyle) parts.push(`font-style:${s.fontStyle}`)
  if (s.fontSize) parts.push(`font-size:${s.fontSize}`)
  if (s.textDecoration) parts.push(`text-decoration:${s.textDecoration}`)
  if (s.textAlign) parts.push(`text-align:${s.textAlign}`)
  if (s.verticalAlign) parts.push(`vertical-align:${s.verticalAlign}`)
  if (s.whiteSpace) parts.push(`white-space:${s.whiteSpace}`)
  if (s.borderTop) parts.push(`border-top:${s.borderTop}`)
  if (s.borderRight) parts.push(`border-right:${s.borderRight}`)
  if (s.borderBottom) parts.push(`border-bottom:${s.borderBottom}`)
  if (s.borderLeft) parts.push(`border-left:${s.borderLeft}`)
  return parts.join(';')
}

/* ─── Constants ─── */

const DEFAULT_ROW_HEIGHT = 20
const BUFFER_ROWS = 10
const FULL_RENDER_THRESHOLD = 500

/* ─── Renderer ─── */

class ExcelRenderer implements Renderer {
  readonly type: FileType = 'excel'
  private container: HTMLElement | null = null
  private wrapper: HTMLElement | null = null
  private tabBar: HTMLElement | null = null
  private sheetNames: string[] = []
  private sheets: Map<string, SheetData> = new Map()
  private currentSheet = 0

  // HTML cache: sheet name → pre-built HTML string
  private htmlCache: Map<string, string> = new Map()

  // Virtual scroll state
  private scrollContainer: HTMLElement | null = null
  private spacerTop: HTMLElement | null = null
  private spacerBottom: HTMLElement | null = null
  private tbody: HTMLTableSectionElement | null = null
  private currentData: SheetData | null = null
  private cumulativeHeights: number[] = []
  private visibleStart = 0
  private visibleEnd = 0
  private onScroll: (() => void) | null = null

  onPageChange?: (page: number) => void

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
    this.htmlCache = new Map()

    workbook.eachSheet((worksheet) => {
      const name = worksheet.name
      this.sheetNames.push(name)

      const rowCount = worksheet.rowCount
      const colCount = worksheet.columnCount
      if (rowCount === 0 || colCount === 0) {
        this.sheets.set(name, { cells: [], rowHeights: [], colWidths: [], rowCount: 0, colCount: 0 })
        return
      }

      // Parse merges
      const mergeMap = new Map<string, { rowSpan: number; colSpan: number }>()
      const hiddenSet = new Set<string>()

      // worksheet.model.merges is an array of range strings like "A1:C2"
      const merges: string[] = (worksheet.model as unknown as Record<string, unknown>).merges as string[] || []
      for (const range of merges) {
        const m = parseRange(range)
        const masterKey = `${m.top},${m.left}`
        mergeMap.set(masterKey, {
          rowSpan: m.bottom - m.top + 1,
          colSpan: m.right - m.left + 1,
        })
        for (let r = m.top; r <= m.bottom; r++) {
          for (let c = m.left; c <= m.right; c++) {
            if (r === m.top && c === m.left) continue
            hiddenSet.add(`${r},${c}`)
          }
        }
      }

      // Build column widths (Excel width units → px, approx width * 8)
      const colWidths: number[] = []
      for (let c = 1; c <= colCount; c++) {
        const col = worksheet.getColumn(c)
        const w = col.width
        colWidths.push(w ? Math.round(w * 8) : 64)
      }

      // Build row heights and cells
      const rowHeights: number[] = []
      const allCells: SheetCell[][] = []

      for (let r = 1; r <= rowCount; r++) {
        const wsRow = worksheet.getRow(r)
        const h = wsRow.height
        rowHeights.push(h ? Math.round(h * 1.333) : DEFAULT_ROW_HEIGHT)

        const rowCells: SheetCell[] = []
        for (let c = 1; c <= colCount; c++) {
          const key = `${r},${c}`

          if (hiddenSet.has(key)) {
            rowCells.push({ text: '', colSpan: 1, rowSpan: 1, hidden: true, style: {} })
            continue
          }

          const cell = wsRow.getCell(c)
          let text = ''
          try {
            text = cell.text || ''
          } catch {
            text = cell.value != null ? String(cell.value) : ''
          }

          const merge = mergeMap.get(key)
          const style = extractCellStyle(cell)

          rowCells.push({
            text,
            colSpan: merge?.colSpan ?? 1,
            rowSpan: merge?.rowSpan ?? 1,
            hidden: false,
            style,
          })
        }
        allCells.push(rowCells)
      }

      this.sheets.set(name, {
        cells: allCells,
        rowHeights,
        colWidths,
        rowCount,
        colCount,
      })
    })

    // Build sheet tab bar if multiple sheets
    if (this.sheetNames.length > 1) {
      this.buildTabBar()
    }

    this.renderSheet(0)
  }

  destroy(): void {
    this.detachScroll()
    if (this.container) {
      this.container.innerHTML = ''
    }
    this.wrapper = null
    this.tabBar = null
    this.container = null
    this.scrollContainer = null
    this.spacerTop = null
    this.spacerBottom = null
    this.tbody = null
    this.currentData = null
    this.cumulativeHeights = []
    this.sheets = new Map()
    this.sheetNames = []
    this.htmlCache = new Map()
  }

  getPageCount(): number {
    return this.sheetNames.length
  }

  gotoPage(page: number): void {
    if (page < 1 || page > this.sheetNames.length) return
    this.currentSheet = page - 1
    this.renderSheet(this.currentSheet)
    this.updateTabBar()
    this.onPageChange?.(page)
  }

  getCurrentPage(): number {
    return this.currentSheet + 1
  }

  private buildTabBar(): void {
    if (!this.container) return

    this.tabBar = document.createElement('div')
    this.tabBar.className = 'xq-sheet-tabs'

    for (let i = 0; i < this.sheetNames.length; i++) {
      const tab = document.createElement('button')
      tab.className = 'xq-sheet-tab'
      if (i === 0) tab.classList.add('xq-sheet-tab--active')
      tab.textContent = this.sheetNames[i]
      tab.title = this.sheetNames[i]
      tab.addEventListener('click', () => {
        this.gotoPage(i + 1)
      })
      this.tabBar.appendChild(tab)
    }

    this.container.appendChild(this.tabBar)
  }

  private updateTabBar(): void {
    if (!this.tabBar) return
    const tabs = this.tabBar.querySelectorAll('.xq-sheet-tab')
    tabs.forEach((tab, i) => {
      tab.classList.toggle('xq-sheet-tab--active', i === this.currentSheet)
    })
  }

  private renderSheet(index: number): void {
    if (!this.wrapper) return
    this.detachScroll()
    // Reset virtual scroll state so updateVisibleRows always runs on switch
    this.visibleStart = -1
    this.visibleEnd = -1

    const name = this.sheetNames[index]
    const data = this.sheets.get(name)
    if (!data || data.rowCount === 0) {
      this.wrapper.innerHTML = '<p style="padding:16px;color:var(--xq-text-secondary)">Empty sheet</p>'
      return
    }

    this.currentData = data

    if (data.rowCount <= FULL_RENDER_THRESHOLD) {
      this.renderFull(data, name)
    } else {
      this.renderVirtual(data)
    }
  }

  /** Build the colgroup HTML shared by full and cached renders */
  private buildColgroupHtml(colWidths: number[]): string {
    let html = '<colgroup>'
    for (const w of colWidths) {
      html += `<col style="width:${w}px">`
    }
    html += '</colgroup>'
    return html
  }

  private renderFull(data: SheetData, sheetName: string): void {
    if (!this.wrapper) return

    // Return cached HTML instantly if available
    const cached = this.htmlCache.get(sheetName)
    if (cached) {
      this.wrapper.innerHTML = cached
      return
    }

    const { cells, rowHeights, colWidths } = data
    const html = this.buildFullHtml(cells, rowHeights, colWidths, 0, cells.length)
    this.htmlCache.set(sheetName, html)
    this.wrapper.innerHTML = html
  }

  /** Build complete HTML string for a row range (used for small sheets & caching) */
  private buildFullHtml(
    cells: SheetCell[][],
    rowHeights: number[],
    colWidths: number[],
    startRow: number,
    endRow: number,
  ): string {
    let html = '<table class="xq-excel-table">'
    html += this.buildColgroupHtml(colWidths)

    for (let r = startRow; r < endRow; r++) {
      const row = cells[r]
      const rh = rowHeights[r] || DEFAULT_ROW_HEIGHT
      html += `<tr style="height:${rh}px">`
      for (let c = 0; c < row.length; c++) {
        const cell = row[c]
        if (cell.hidden) continue
        let attrs = ''
        if (cell.colSpan > 1) attrs += ` colspan="${cell.colSpan}"`
        if (cell.rowSpan > 1) attrs += ` rowspan="${cell.rowSpan}"`
        const inlineStyle = cellStyleToCSS(cell.style)
        if (inlineStyle) attrs += ` style="${inlineStyle}"`
        html += `<td${attrs}>${escapeHtml(cell.text)}</td>`
      }
      html += '</tr>'
    }
    html += '</table>'
    return html
  }

  private renderVirtual(data: SheetData): void {
    if (!this.wrapper) return
    this.wrapper.innerHTML = ''

    // Build cumulative height array for binary search
    this.cumulativeHeights = []
    let cumH = 0
    for (let r = 0; r < data.rowCount; r++) {
      cumH += data.rowHeights[r] || DEFAULT_ROW_HEIGHT
      this.cumulativeHeights.push(cumH)
    }
    const totalContentHeight = cumH

    this.scrollContainer = document.createElement('div')
    this.scrollContainer.className = 'xq-virtual-scroll'
    this.scrollContainer.style.cssText = 'overflow-y:auto;height:100%;position:relative;'

    const table = document.createElement('table')
    table.className = 'xq-excel-table'

    // colgroup
    const colgroup = document.createElement('colgroup')
    for (const w of data.colWidths) {
      const col = document.createElement('col')
      col.style.width = `${w}px`
      colgroup.appendChild(col)
    }
    table.appendChild(colgroup)

    // Body with spacers
    this.tbody = document.createElement('tbody')
    this.spacerTop = document.createElement('tr')
    this.spacerTop.style.height = '0px'
    this.spacerBottom = document.createElement('tr')
    this.spacerBottom.style.height = `${totalContentHeight}px`
    this.tbody.appendChild(this.spacerTop)
    this.tbody.appendChild(this.spacerBottom)

    table.appendChild(this.tbody)
    this.scrollContainer.appendChild(table)
    this.wrapper.appendChild(this.scrollContainer)

    // Capture ref for the rAF guard — if renderSheet replaces scrollContainer
    // before rAF fires, the callback must be a no-op.
    const sc = this.scrollContainer

    this.onScroll = () => this.updateVisibleRows()
    this.scrollContainer.addEventListener('scroll', this.onScroll, { passive: true })

    // Defer initial render so the container has a measured height.
    // Guard: only proceed if this scrollContainer is still the active one.
    requestAnimationFrame(() => {
      if (this.scrollContainer !== sc) return
      this.updateVisibleRows()
    })
  }

  private updateVisibleRows(): void {
    if (!this.scrollContainer || !this.tbody || !this.spacerTop || !this.spacerBottom || !this.currentData) return

    const data = this.currentData
    const totalRows = data.rowCount
    if (totalRows <= 0) return

    const scrollTop = this.scrollContainer.scrollTop
    // If the container hasn't been laid out yet, use a sensible fallback
    const viewHeight = this.scrollContainer.clientHeight || 600

    // Binary search for start row
    let startIdx = this.binarySearchRow(scrollTop)
    startIdx = Math.max(0, startIdx - BUFFER_ROWS)
    let endIdx = this.binarySearchRow(scrollTop + viewHeight)
    endIdx = Math.min(totalRows, endIdx + BUFFER_ROWS)

    if (startIdx === this.visibleStart && endIdx === this.visibleEnd) return
    this.visibleStart = startIdx
    this.visibleEnd = endIdx

    const topHeight = startIdx > 0 ? this.cumulativeHeights[startIdx - 1] : 0
    const totalHeight = this.cumulativeHeights[totalRows - 1]
    const bottomHeight = totalHeight - this.cumulativeHeights[Math.min(endIdx, totalRows) - 1]

    this.spacerTop.style.height = `${topHeight}px`
    this.spacerBottom.style.height = `${Math.max(0, bottomHeight)}px`

    const frag = document.createDocumentFragment()
    frag.appendChild(this.spacerTop)

    for (let r = startIdx; r < endIdx; r++) {
      const row = data.cells[r]
      if (!row) continue
      const rh = data.rowHeights[r] || DEFAULT_ROW_HEIGHT
      const tr = document.createElement('tr')
      tr.style.height = `${rh}px`

      for (let c = 0; c < row.length; c++) {
        const cell = row[c]
        if (cell.hidden) continue
        const td = document.createElement('td')
        td.textContent = cell.text

        const inlineStyle = cellStyleToCSS(cell.style)
        if (inlineStyle) td.setAttribute('style', inlineStyle)

        if (cell.colSpan > 1) td.colSpan = cell.colSpan

        tr.appendChild(td)
      }
      frag.appendChild(tr)
    }

    frag.appendChild(this.spacerBottom)
    this.tbody.innerHTML = ''
    this.tbody.appendChild(frag)
  }

  /** Binary search for the row index at a given scroll offset */
  private binarySearchRow(offset: number): number {
    const heights = this.cumulativeHeights
    let lo = 0
    let hi = heights.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      if (heights[mid] < offset) {
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return lo
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
