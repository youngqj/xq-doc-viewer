import type { ToolbarConfig } from '../core/types'
import type { Viewer } from '../core/viewer'
import { createElement } from '../utils/dom'

// SVG icon paths (minimal inline SVGs)
const ICONS = {
  zoomIn:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
  zoomOut:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
  rotateLeft:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  rotateRight:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  prev:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>',
  next:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
  fullscreen:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
  print:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
}

export class Toolbar {
  private readonly viewer: Viewer
  private readonly config: ToolbarConfig
  private el: HTMLElement | null = null
  private pageInfo: HTMLElement | null = null
  private prevBtn: HTMLButtonElement | null = null
  private nextBtn: HTMLButtonElement | null = null

  constructor(viewer: Viewer, config: ToolbarConfig) {
    this.viewer = viewer
    this.config = {
      zoom: true,
      rotate: true,
      pagination: true,
      fullscreen: true,
      print: false,
      download: true,
      ...config,
    }
  }

  mount(parent: HTMLElement): void {
    this.el = createElement('div', 'xq-toolbar')

    if (this.config.zoom) {
      this.el.appendChild(this.btn('zoomOut', ICONS.zoomOut, () => this.viewer.zoom(this.viewer.getScale() - 0.25)))
      this.el.appendChild(this.btn('zoomIn', ICONS.zoomIn, () => this.viewer.zoom(this.viewer.getScale() + 0.25)))
      this.el.appendChild(this.separator())
    }

    if (this.config.rotate) {
      this.el.appendChild(this.btn('rotateLeft', ICONS.rotateLeft, () => this.viewer.rotate(-90)))
      this.el.appendChild(this.btn('rotateRight', ICONS.rotateRight, () => this.viewer.rotate(90)))
      this.el.appendChild(this.separator())
    }

    if (this.config.pagination) {
      this.prevBtn = this.btn('prevPage', ICONS.prev, () => this.viewer.prevPage())
      this.el.appendChild(this.prevBtn)

      this.pageInfo = createElement('span', 'xq-toolbar__page-info')
      this.pageInfo.textContent = '-'
      this.el.appendChild(this.pageInfo)

      this.nextBtn = this.btn('nextPage', ICONS.next, () => this.viewer.nextPage())
      this.el.appendChild(this.nextBtn)
      this.el.appendChild(this.separator())
    }

    // Spacer
    this.el.appendChild(createElement('span', 'xq-toolbar__spacer'))

    if (this.config.fullscreen) {
      this.el.appendChild(
        this.btn('fullscreen', ICONS.fullscreen, () =>
          this.viewer.fullscreen(!this.viewer.isFullscreen()),
        ),
      )
    }

    if (this.config.print) {
      this.el.appendChild(this.btn('print', ICONS.print, () => this.viewer.print()))
    }

    if (this.config.download) {
      this.el.appendChild(this.btn('download', ICONS.download, () => this.viewer.download()))
    }

    // Insert toolbar before content
    parent.insertBefore(this.el, parent.firstChild)
  }

  update(): void {
    if (this.pageInfo) {
      const page = this.viewer.getPage()
      const total = this.viewer.getTotalPages()
      this.pageInfo.textContent = this.viewer.i18n
        .t('pageOf')
        .replace('{page}', String(page))
        .replace('{total}', String(total))
    }
    if (this.prevBtn) this.prevBtn.disabled = this.viewer.getPage() <= 1
    if (this.nextBtn) this.nextBtn.disabled = this.viewer.getPage() >= this.viewer.getTotalPages()
  }

  updateLabels(): void {
    // Re-render tooltips when locale changes
    this.el?.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => {
      const action = btn.getAttribute('data-action') as keyof typeof actionToI18n | null
      if (action && actionToI18n[action]) {
        btn.title = this.viewer.i18n.t(actionToI18n[action])
      }
    })
  }

  destroy(): void {
    this.el?.remove()
    this.el = null
    this.pageInfo = null
    this.prevBtn = null
    this.nextBtn = null
  }

  private btn(action: string, icon: string, onClick: () => void): HTMLButtonElement {
    const button = createElement('button', 'xq-toolbar__btn', { 'data-action': action })
    button.innerHTML = icon
    const i18nKey = actionToI18n[action]
    if (i18nKey) button.title = this.viewer.i18n.t(i18nKey)
    button.addEventListener('click', onClick)
    return button
  }

  private separator(): HTMLElement {
    return createElement('span', 'xq-toolbar__separator')
  }
}

const actionToI18n: Record<string, keyof import('../core/types').LocaleMessages> = {
  zoomIn: 'zoomIn',
  zoomOut: 'zoomOut',
  rotateLeft: 'rotateLeft',
  rotateRight: 'rotateRight',
  prevPage: 'prevPage',
  nextPage: 'nextPage',
  fullscreen: 'fullscreen',
  print: 'print',
  download: 'download',
}
