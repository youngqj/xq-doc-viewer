import type { FileSource, FileType, Renderer } from '../core/types'
import { fileToArrayBuffer } from '../utils/file'

interface PptxImageFill {
  base64?: string
  blob?: string
  ref?: string
  opacity?: number
}

interface PptxGradientStop {
  pos: string
  color: string
}

interface PptxGradientFill {
  rot: number
  path: string
  colors: PptxGradientStop[]
}

interface PptxFill {
  type: string
  value: string | PptxImageFill | PptxGradientFill
}

interface PptxShadow {
  h: number
  v: number
  blur: number
  color: string
}

interface PptxRect {
  t?: number
  b?: number
  l?: number
  r?: number
}

interface PptxTableCell {
  text?: string
  colSpan?: number
  rowSpan?: number
  vMerge?: number
  hMerge?: number
  fontBold?: boolean
  fontColor?: string
  fillColor?: string
  borders?: Record<string, { borderColor?: string; borderWidth?: number; borderType?: string }>
}

interface PptxChartData {
  key?: string | number
  values?: { x: number; y: number }[]
  xlabels?: Record<string, string>
}

interface PptxElement {
  type: string
  left: number
  top: number
  width: number
  height: number
  rotate?: number
  order?: number
  content?: string
  src?: string
  url?: string
  base64?: string
  blob?: string
  ref?: string
  path?: string
  fill?: PptxFill
  borderColor?: string
  borderWidth?: number
  borderType?: string
  borderStrokeDasharray?: number | string
  shapType?: string
  isFlipV?: boolean
  isFlipH?: boolean
  vAlign?: string
  shadow?: PptxShadow
  elements?: PptxElement[]
  picBase64?: string
  picBlob?: string
  textList?: { text: string }[]
  isVertical?: boolean
  autoFit?: string
  link?: string
  name?: string
  keypoints?: Record<string, number>
  // Image-specific fields
  rect?: PptxRect
  geom?: string
  filters?: Record<string, number>
  // Table-specific fields
  data?: PptxTableCell[][]
  colWidths?: number[]
  rowHeights?: number[]
  // Chart-specific fields
  chartType?: string
  chartData?: PptxChartData[]
  colors?: string[]
}

interface PptxSlide {
  fill?: PptxFill
  elements: PptxElement[]
  layoutElements?: PptxElement[]
}

interface PptxResult {
  slides: PptxSlide[]
  size: { width: number; height: number }
}

let idCounter = 0
function uid(): string {
  return 'xp-' + (++idCounter).toString(36)
}

class PptxRenderer implements Renderer {
  readonly type: FileType = 'pptx'
  private container: HTMLElement | null = null
  private slideEl: HTMLElement | null = null
  private slides: PptxSlide[] = []
  private slideSize = { width: 960, height: 540 }
  private currentSlide = 0
  private userScale = 1

  mount(container: HTMLElement): void {
    this.container = container
    this.container.classList.add('xq-renderer-pptx')
  }

  async load(source: FileSource): Promise<void> {
    const { parse } = await import('pptxtojson')
    const buffer = await fileToArrayBuffer(source)
    const result = await parse(buffer) as unknown as PptxResult

    this.slides = result.slides
    this.slideSize = result.size
    this.currentSlide = 0

    this.renderCurrentSlide()
  }

  destroy(): void {
    this.slides = []
    if (this.container) {
      this.container.innerHTML = ''
      this.container.classList.remove('xq-renderer-pptx')
    }
    this.slideEl = null
    this.container = null
  }

  zoom(scale: number): void {
    this.userScale = Math.max(0.25, Math.min(5, scale))
    this.renderCurrentSlide()
  }

  getPageCount(): number {
    return this.slides.length
  }

  gotoPage(page: number): void {
    const index = page - 1
    if (index < 0 || index >= this.slides.length) return
    this.currentSlide = index
    this.renderCurrentSlide()
  }

  getCurrentPage(): number {
    return this.currentSlide + 1
  }

  private getFitScale(): number {
    if (!this.container) return 1
    const parent = this.container.parentElement ?? this.container
    const availW = parent.clientWidth - 32
    const { width } = this.slideSize
    if (width <= 0) return 1
    return Math.min(availW / width, 2)
  }

  /* ──── Slide rendering ──── */

  private renderCurrentSlide(): void {
    if (!this.container || this.slides.length === 0) return

    if (this.slideEl) this.slideEl.remove()

    const slide = this.slides[this.currentSlide]
    const { width, height } = this.slideSize
    const scale = this.getFitScale() * this.userScale
    const scaledW = width * scale
    const scaledH = height * scale

    const wrapper = document.createElement('div')
    wrapper.className = 'xq-pptx-slide'
    wrapper.style.cssText = `
      position:relative;
      width:${scaledW}px;height:${scaledH}px;
      overflow:hidden;
      background:${this.getSlideBg(slide)};
      box-shadow:0 2px 12px rgba(0,0,0,0.3);
    `

    // Merge layout + slide elements, sorted by order (z-index)
    const allElements: PptxElement[] = [
      ...(slide.layoutElements ?? []),
      ...slide.elements,
    ]
    allElements.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    // Debug: log slide data for development
    if (typeof console !== 'undefined') {
      console.log('[xq-pptx] slide', this.currentSlide, {
        fill: slide.fill,
        bgCss: this.getSlideBg(slide),
        layoutCount: slide.layoutElements?.length ?? 0,
        elementCount: slide.elements.length,
        types: allElements.map(e => `${e.type}${e.fill ? '(fill:' + e.fill.type + ')' : ''}`),
      })
    }

    for (const el of allElements) {
      const dom = this.renderElement(el, scale)
      if (dom) wrapper.appendChild(dom)
    }

    this.container.appendChild(wrapper)
    this.slideEl = wrapper
  }

  /* ──── Element rendering ──── */

  private renderElement(el: PptxElement, scale: number): HTMLElement | null {
    const div = document.createElement('div')
    const w = el.width * scale
    const h = el.height * scale
    div.style.cssText = `
      position:absolute;
      left:${el.left * scale}px;
      top:${el.top * scale}px;
      width:${w}px;height:${h}px;
    `

    if (el.order != null) div.style.zIndex = String(el.order)

    // Rotation & flip
    const transforms: string[] = []
    if (el.rotate) transforms.push(`rotate(${el.rotate}deg)`)
    if (el.isFlipH) transforms.push('scaleX(-1)')
    if (el.isFlipV) transforms.push('scaleY(-1)')
    if (transforms.length) div.style.transform = transforms.join(' ')

    // Shadow — use drop-shadow filter for better SVG compat
    if (el.shadow) {
      const { h: sh, v: sv, blur, color } = el.shadow
      div.style.filter = `drop-shadow(${sh}px ${sv}px ${blur}px ${color})`
    }

    switch (el.type) {
      case 'text':
        this.applyBorder(div, el)
        this.applyFill(div, el.fill)
        this.renderText(div, el, scale)
        break
      case 'shape':
        this.renderShape(div, el, scale)
        break
      case 'image':
        this.applyBorder(div, el)
        this.renderImage(div, el)
        break
      case 'table':
        this.renderTable(div, el, scale)
        break
      case 'group':
        this.renderGroup(div, el, scale)
        break
      case 'diagram':
        this.renderDiagram(div, el, scale)
        break
      case 'math':
        this.renderMath(div, el)
        break
      case 'chart':
        this.renderChart(div, el)
        break
      case 'video':
      case 'audio':
        div.style.background = 'rgba(0,0,0,0.05)'
        if (!div.style.border) div.style.border = '1px solid #ccc'
        break
      default:
        break
    }

    return div
  }

  /* ──── Text ──── */

  private renderText(div: HTMLElement, el: PptxElement, _scale: number): void {
    if (!el.content) return

    // Vertical alignment
    if (el.vAlign) {
      div.style.display = 'flex'
      div.style.flexDirection = 'column'
      div.style.justifyContent =
        el.vAlign === 'mid' ? 'center' : el.vAlign === 'bottom' ? 'flex-end' : 'flex-start'
    }

    const inner = document.createElement('div')
    inner.style.cssText = 'width:100%;overflow:hidden;line-height:1.4;word-break:break-word;'
    if (el.isVertical) inner.style.writingMode = 'vertical-rl'
    inner.innerHTML = el.content
    div.appendChild(inner)
  }

  /* ──── Shape ──── */

  private renderShape(div: HTMLElement, el: PptxElement, _scale: number): void {
    if (el.path) {
      this.renderShapeSvg(div, el)
    } else {
      // No path — plain shape (rect/ellipse/roundRect) rendered with CSS
      this.applyFill(div, el.fill)
      this.applyBorder(div, el)
      if (el.shapType === 'ellipse' || el.shapType === 'oval') {
        div.style.borderRadius = '50%'
      } else if (el.shapType === 'roundRect') {
        div.style.borderRadius = '8px'
      }
    }

    // Text content on top of shape
    if (el.content) {
      const inner = document.createElement('div')
      const valign = el.vAlign === 'mid' ? 'center' : el.vAlign === 'bottom' ? 'flex-end' : 'flex-start'
      inner.style.cssText = `
        position:absolute;left:0;top:0;right:0;bottom:0;z-index:1;
        display:flex;flex-direction:column;
        justify-content:${valign};
        overflow:hidden;line-height:1.4;word-break:break-word;
        padding:4px;box-sizing:border-box;
      `
      if (el.isVertical) inner.style.writingMode = 'vertical-rl'
      inner.innerHTML = el.content
      div.appendChild(inner)
    }
  }

  private renderShapeSvg(div: HTMLElement, el: PptxElement): void {
    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')

    // Use element's own width/height as viewBox — path is in these coordinates
    svg.setAttribute('viewBox', `0 0 ${el.width} ${el.height}`)
    svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;'
    svg.setAttribute('preserveAspectRatio', 'none')

    const defs = document.createElementNS(svgNS, 'defs')
    const path = document.createElementNS(svgNS, 'path')
    path.setAttribute('d', el.path!)
    path.setAttribute('vector-effect', 'non-scaling-stroke')
    path.setAttribute('stroke-linecap', 'butt')
    path.setAttribute('stroke-miterlimit', '8')

    // Fill
    this.applySvgFill(path, defs, el, div)

    // Stroke
    if (el.borderColor) {
      path.setAttribute('stroke', el.borderColor)
      path.setAttribute('stroke-width', String(el.borderWidth ?? 1))
      if (el.borderStrokeDasharray) {
        path.setAttribute('stroke-dasharray', String(el.borderStrokeDasharray))
      }
    }

    svg.appendChild(defs)
    svg.appendChild(path)
    div.appendChild(svg)
  }

  private applySvgFill(
    path: SVGPathElement,
    defs: SVGDefsElement,
    el: PptxElement,
    div: HTMLElement,
  ): void {
    const svgNS = 'http://www.w3.org/2000/svg'
    const fill = el.fill

    if (!fill) {
      path.setAttribute('fill', 'none')
      return
    }

    if (fill.type === 'color' && typeof fill.value === 'string') {
      path.setAttribute('fill', fill.value)
    } else if (fill.type === 'image') {
      const imgFill = fill.value as PptxImageFill
      const bgSrc = imgFill.base64 || imgFill.blob
      if (bgSrc) {
        const patId = uid()
        const pattern = document.createElementNS(svgNS, 'pattern')
        pattern.setAttribute('id', patId)
        pattern.setAttribute('patternUnits', 'objectBoundingBox')
        pattern.setAttribute('width', '1')
        pattern.setAttribute('height', '1')
        const img = document.createElementNS(svgNS, 'image')
        img.setAttribute('href', bgSrc)
        img.setAttribute('width', String(el.width))
        img.setAttribute('height', String(el.height))
        img.setAttribute('preserveAspectRatio', 'xMidYMid slice')
        pattern.appendChild(img)
        defs.appendChild(pattern)
        path.setAttribute('fill', `url(#${patId})`)
      } else {
        path.setAttribute('fill', 'none')
      }
    } else if (fill.type === 'gradient') {
      const gradFill = fill.value
      // pptxtojson may output a CSS string OR a gradient object
      if (typeof gradFill === 'string') {
        // CSS gradient string — apply to div background
        div.style.background = gradFill
        path.setAttribute('fill', 'transparent')
      } else {
        // Structured gradient: {rot, path, colors: [{pos, color}]}
        const gradObj = gradFill as PptxGradientFill
        const gradId = uid()

        if (gradObj.path === 'shape') {
          // Radial gradient
          const radGrad = document.createElementNS(svgNS, 'radialGradient')
          radGrad.setAttribute('id', gradId)
          for (const stop of gradObj.colors) {
            const s = document.createElementNS(svgNS, 'stop')
            s.setAttribute('offset', stop.pos || '0%')
            s.setAttribute('stop-color', stop.color)
            radGrad.appendChild(s)
          }
          defs.appendChild(radGrad)
        } else {
          // Linear gradient
          const linGrad = document.createElementNS(svgNS, 'linearGradient')
          linGrad.setAttribute('id', gradId)
          linGrad.setAttribute('x1', '0%')
          linGrad.setAttribute('y1', '0%')
          linGrad.setAttribute('x2', '100%')
          linGrad.setAttribute('y2', '0%')
          linGrad.setAttribute('gradientTransform', `rotate(${gradObj.rot || 0},0.5,0.5)`)
          for (const stop of gradObj.colors) {
            const s = document.createElementNS(svgNS, 'stop')
            s.setAttribute('offset', stop.pos || '0%')
            s.setAttribute('stop-color', stop.color)
            linGrad.appendChild(s)
          }
          defs.appendChild(linGrad)
        }
        path.setAttribute('fill', `url(#${gradId})`)
      }
    } else {
      path.setAttribute('fill', 'none')
    }
  }

  /* ──── Image ──── */

  private renderImage(div: HTMLElement, el: PptxElement): void {
    const src = el.base64 || el.blob || el.src || el.url
    if (!src) return

    const img = document.createElement('img')
    img.src = src
    img.draggable = false

    // Handle image cropping (rect: {t, b, l, r} as percentages)
    if (el.rect && (el.rect.t || el.rect.b || el.rect.l || el.rect.r)) {
      const t = el.rect.t || 0
      const r = el.rect.r || 0
      const b = el.rect.b || 0
      const l = el.rect.l || 0
      // Position and size the img so cropped region fills the container
      const visibleW = 100 - l - r
      const visibleH = 100 - t - b
      const imgW = visibleW > 0 ? (100 / visibleW) * 100 : 100
      const imgH = visibleH > 0 ? (100 / visibleH) * 100 : 100
      const imgLeft = visibleW > 0 ? -(l / visibleW) * 100 : 0
      const imgTop = visibleH > 0 ? -(t / visibleH) * 100 : 0
      img.style.cssText = `position:absolute;width:${imgW}%;height:${imgH}%;left:${imgLeft}%;top:${imgTop}%;`
      div.style.overflow = 'hidden'
    } else {
      img.style.cssText = 'width:100%;height:100%;object-fit:fill;'
    }

    // Handle image geometry/clip shape
    if (el.geom && el.geom !== 'rect') {
      if (el.geom === 'ellipse') {
        div.style.borderRadius = '50%'
        div.style.overflow = 'hidden'
      } else if (el.geom === 'roundRect') {
        div.style.borderRadius = '8px'
        div.style.overflow = 'hidden'
      }
      // custom shapes — just let overflow:hidden clip to rectangle
    }

    div.appendChild(img)
  }

  /* ──── Table ──── */

  private renderTable(div: HTMLElement, el: PptxElement, scale: number): void {
    // pptxtojson v2 outputs data as array of rows, or content as HTML string
    if (el.data && Array.isArray(el.data)) {
      this.renderTableFromData(div, el, scale)
    } else if (el.content) {
      // Fallback: HTML content
      div.innerHTML = el.content
      div.style.overflow = 'hidden'
    }
  }

  private renderTableFromData(div: HTMLElement, el: PptxElement, _scale: number): void {
    const table = document.createElement('table')
    table.style.cssText = `
      width:100%;height:100%;border-collapse:collapse;
      table-layout:fixed;font-size:12px;
    `

    // Column widths
    if (el.colWidths && el.colWidths.length > 0) {
      const colgroup = document.createElement('colgroup')
      const totalW = el.colWidths.reduce((s, w) => s + w, 0)
      for (const cw of el.colWidths) {
        const col = document.createElement('col')
        col.style.width = totalW > 0 ? `${(cw / totalW) * 100}%` : 'auto'
        colgroup.appendChild(col)
      }
      table.appendChild(colgroup)
    }

    const tbody = document.createElement('tbody')
    for (const row of el.data!) {
      const tr = document.createElement('tr')
      for (const cell of row) {
        // Skip merged cells
        if (cell.vMerge || cell.hMerge) continue

        const td = document.createElement('td')
        td.style.cssText = 'padding:4px 6px;vertical-align:middle;border:1px solid #d0d0d0;overflow:hidden;word-break:break-word;'

        if (cell.colSpan && cell.colSpan > 1) td.colSpan = cell.colSpan
        if (cell.rowSpan && cell.rowSpan > 1) td.rowSpan = cell.rowSpan
        if (cell.fillColor) td.style.backgroundColor = cell.fillColor
        if (cell.fontColor) td.style.color = cell.fontColor
        if (cell.fontBold) td.style.fontWeight = 'bold'

        // Cell borders
        if (cell.borders) {
          for (const [side, b] of Object.entries(cell.borders)) {
            if (b.borderColor && b.borderWidth) {
              td.style.setProperty(
                `border-${side}`,
                `${b.borderWidth}px ${b.borderType || 'solid'} ${b.borderColor}`,
              )
            }
          }
        }

        if (cell.text) td.innerHTML = cell.text
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    div.appendChild(table)
    div.style.overflow = 'hidden'
  }

  /* ──── Group ──── */

  private renderGroup(div: HTMLElement, el: PptxElement, scale: number): void {
    if (!el.elements) return
    // Group children have coordinates relative to the group container
    // (pptxtojson transforms them: (left - chx) * ws)
    // We just render them inside the group div which is already positioned/sized
    for (const child of el.elements) {
      const childDom = this.renderElement(child, scale)
      if (childDom) div.appendChild(childDom)
    }
  }

  /* ──── Diagram ──── */

  private renderDiagram(div: HTMLElement, el: PptxElement, scale: number): void {
    if (!el.elements) {
      // Fallback: show textList if available
      if (el.textList && el.textList.length > 0) {
        div.style.cssText += 'display:flex;flex-direction:column;justify-content:center;align-items:center;overflow:hidden;'
        for (const item of el.textList) {
          const p = document.createElement('div')
          p.style.cssText = 'padding:2px 4px;text-align:center;'
          p.textContent = item.text
          div.appendChild(p)
        }
      }
      return
    }

    // Diagram children have absolute slide coordinates from processSpNode.
    // We need to offset them by diagram container's position.
    for (const child of el.elements) {
      const adjusted: PptxElement = {
        ...child,
        left: child.left - el.left,
        top: child.top - el.top,
      }
      const childDom = this.renderElement(adjusted, scale)
      if (childDom) div.appendChild(childDom)
    }
  }

  /* ──── Math ──── */

  private renderMath(div: HTMLElement, el: PptxElement): void {
    const src = el.picBase64 || el.picBlob
    if (src) {
      const img = document.createElement('img')
      img.src = src
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;'
      img.draggable = false
      div.appendChild(img)
    } else if (el.content) {
      div.innerHTML = el.content
    }
  }

  /* ──── Chart (placeholder) ──── */

  private renderChart(div: HTMLElement, el: PptxElement): void {
    div.style.cssText += `
      display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.03);border:1px solid #ddd;
      overflow:hidden;font-size:12px;color:#999;
    `
    const label = el.chartType ? `[Chart: ${el.chartType}]` : '[Chart]'
    div.textContent = label
  }

  /* ──── Utility: border ──── */

  private applyBorder(div: HTMLElement, el: PptxElement): void {
    if (el.borderColor && el.borderWidth) {
      div.style.border = `${el.borderWidth}px ${el.borderType || 'solid'} ${el.borderColor}`
      if (el.borderStrokeDasharray) div.style.borderStyle = 'dashed'
    }
  }

  /* ──── Utility: fill ──── */

  private applyFill(div: HTMLElement, fill?: PptxFill): void {
    if (!fill) return
    if (fill.type === 'color' && typeof fill.value === 'string') {
      div.style.backgroundColor = fill.value
    } else if (fill.type === 'image') {
      const imgFill = fill.value as PptxImageFill
      const bgSrc = imgFill.base64 || imgFill.blob
      if (bgSrc) {
        div.style.backgroundImage = `url(${bgSrc})`
        div.style.backgroundSize = 'cover'
        div.style.backgroundPosition = 'center'
      }
    } else if (fill.type === 'gradient') {
      const gradFill = fill.value
      if (typeof gradFill === 'string') {
        div.style.background = gradFill
      } else {
        // Convert structured gradient to CSS
        const gradObj = gradFill as PptxGradientFill
        const stops = gradObj.colors.map(s => `${s.color} ${s.pos}`).join(', ')
        if (gradObj.path === 'shape') {
          div.style.background = `radial-gradient(ellipse at center, ${stops})`
        } else {
          div.style.background = `linear-gradient(${gradObj.rot || 0}deg, ${stops})`
        }
      }
    }
  }

  /* ──── Utility: slide background ──── */

  private getSlideBg(slide: PptxSlide): string {
    if (!slide.fill) return '#ffffff'

    const { type, value } = slide.fill
    if (!type || !value) return '#ffffff'

    if (type === 'color' && typeof value === 'string') {
      return value
    }
    if (type === 'image') {
      const imgFill = value as PptxImageFill
      const bgSrc = imgFill.base64 || imgFill.blob
      if (bgSrc) return `url(${bgSrc}) center/cover no-repeat`
    }
    if (type === 'gradient') {
      if (typeof value === 'string') return value
      const gradObj = value as PptxGradientFill
      if (gradObj.colors && gradObj.colors.length > 0) {
        const stops = gradObj.colors.map(s => `${s.color} ${s.pos}`).join(', ')
        if (gradObj.path === 'shape') {
          return `radial-gradient(ellipse at center, ${stops})`
        }
        return `linear-gradient(${gradObj.rot || 0}deg, ${stops})`
      }
    }
    return '#ffffff'
  }
}

export function create(): Renderer {
  return new PptxRenderer()
}
