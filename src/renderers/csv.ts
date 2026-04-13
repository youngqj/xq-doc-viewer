import type { FileSource, FileType, Renderer } from '../core/types'

const ROW_HEIGHT = 30
const BUFFER_ROWS = 10

class CsvRenderer implements Renderer {
  readonly type: FileType = 'csv'
  private container: HTMLElement | null = null
  private wrapper: HTMLElement | null = null

  // Virtual scroll state
  private rows: string[][] = []
  private scrollContainer: HTMLElement | null = null
  private spacerTop: HTMLElement | null = null
  private spacerBottom: HTMLElement | null = null
  private tbody: HTMLTableSectionElement | null = null
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
    const Papa = await import('papaparse')

    let text: string
    if (typeof source === 'string') {
      const resp = await fetch(source)
      text = await resp.text()
    } else if (source instanceof Blob) {
      text = await source.text()
    } else {
      text = new TextDecoder().decode(source)
    }

    const result = Papa.default.parse<string[]>(text, { skipEmptyLines: true })
    this.rows = result.data

    if (!this.wrapper || this.rows.length === 0) return

    if (this.rows.length <= 200) {
      this.renderFull()
    } else {
      this.renderVirtual()
    }
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
    this.rows = []
  }

  private renderFull(): void {
    if (!this.wrapper) return
    let html = '<table>'
    this.rows.forEach((row, ri) => {
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

  private renderVirtual(): void {
    if (!this.wrapper) return
    this.wrapper.innerHTML = ''

    this.scrollContainer = document.createElement('div')
    this.scrollContainer.className = 'xq-virtual-scroll'
    this.scrollContainer.style.cssText = 'overflow-y:auto;height:100%;position:relative;'

    const table = document.createElement('table')

    // Header
    const thead = document.createElement('thead')
    const headerTr = document.createElement('tr')
    this.rows[0].forEach((cell) => {
      const th = document.createElement('th')
      th.textContent = cell
      headerTr.appendChild(th)
    })
    thead.appendChild(headerTr)
    table.appendChild(thead)

    // Body with spacers
    this.tbody = document.createElement('tbody')
    this.spacerTop = document.createElement('tr')
    this.spacerTop.style.height = '0px'
    this.spacerBottom = document.createElement('tr')
    this.spacerBottom.style.height = '0px'
    this.tbody.appendChild(this.spacerTop)
    this.tbody.appendChild(this.spacerBottom)

    table.appendChild(this.tbody)
    this.scrollContainer.appendChild(table)
    this.wrapper.appendChild(this.scrollContainer)

    this.updateVisibleRows()

    this.onScroll = () => this.updateVisibleRows()
    this.scrollContainer.addEventListener('scroll', this.onScroll, { passive: true })
  }

  private updateVisibleRows(): void {
    if (!this.scrollContainer || !this.tbody || !this.spacerTop || !this.spacerBottom) return

    const dataRows = this.rows.length - 1
    if (dataRows <= 0) return

    const scrollTop = this.scrollContainer.scrollTop
    const viewHeight = this.scrollContainer.clientHeight

    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS)
    const endIdx = Math.min(dataRows, Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + BUFFER_ROWS)

    if (startIdx === this.visibleStart && endIdx === this.visibleEnd) return
    this.visibleStart = startIdx
    this.visibleEnd = endIdx

    this.spacerTop.style.height = `${startIdx * ROW_HEIGHT}px`
    this.spacerBottom.style.height = `${Math.max(0, (dataRows - endIdx) * ROW_HEIGHT)}px`

    const frag = document.createDocumentFragment()
    frag.appendChild(this.spacerTop)

    for (let i = startIdx; i < endIdx; i++) {
      const row = this.rows[i + 1]
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
  return new CsvRenderer()
}
