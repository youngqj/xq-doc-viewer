import type {
  FileSource,
  FileType,
  LocaleConfig,
  LocaleKey,
  Renderer,
  ThemeConfig,
  ThemeMode,
  ToolbarConfig,
  ViewerEvents,
  ViewerOptions,
  WatermarkConfig,
} from './types'
import { EventBus } from './events'
import { createRenderer, detectFileType } from './registry'
import { getElement } from '../utils/dom'
import { ThemeManager } from '../theme/theme'
import { I18nManager } from '../i18n/i18n'
import { Toolbar } from '../toolbar/toolbar'
import { WatermarkManager } from '../watermark/watermark'
import { requestFullscreen, exitFullscreen, isFullscreen } from '../utils/fullscreen'
import { fileToUrl } from '../utils/file'

import baseStyles from '../styles/base.css?inline'
import toolbarStyles from '../styles/toolbar.css?inline'
import rendererStyles from '../styles/renderers.css?inline'

export class Viewer {
  private readonly bus = new EventBus<ViewerEvents>()
  private readonly root: HTMLElement
  private readonly options: ViewerOptions

  private container!: HTMLElement
  private contentEl!: HTMLElement
  private styleEl!: HTMLElement
  private renderer: Renderer | null = null
  private toolbar: Toolbar | null = null
  private readonly watermark = new WatermarkManager()
  private mounted = false

  readonly theme: ThemeManager
  readonly i18n: I18nManager

  private currentScale = 1
  private currentRotation = 0
  private currentPage = 1
  private totalPages = 1

  constructor(options: ViewerOptions) {
    this.options = options
    this.root = getElement(options.target)

    // Theme
    const themeInit: ThemeMode =
      typeof options.theme === 'string'
        ? options.theme
        : (options.theme as ThemeConfig)?.mode ?? 'light'
    this.theme = new ThemeManager(themeInit)

    // I18n
    const localeInit: LocaleKey =
      typeof options.locale === 'string' ? options.locale : 'zh-CN'
    const customMessages =
      typeof options.locale === 'object' ? (options.locale as LocaleConfig).messages : undefined
    this.i18n = new I18nManager(localeInit, customMessages)
  }

  // ─── Lifecycle ───

  async mount(): Promise<void> {
    if (this.mounted) return

    this.injectStyles()
    this.buildDOM()
    this.theme.apply(this.container)

    if (this.options.toolbar !== false) {
      const tbConfig: ToolbarConfig | true =
        typeof this.options.toolbar === 'object' ? this.options.toolbar : true
      this.toolbar = new Toolbar(this, tbConfig === true ? {} : tbConfig)
      this.toolbar.mount(this.container)
    }

    this.mounted = true

    if (this.options.watermark) {
      this.watermark.apply(this.contentEl, this.options.watermark)
    }

    if (this.options.file) {
      await this.setFile(this.options.file, this.options.type)
    }
  }

  async setFile(source: FileSource, type?: FileType): Promise<void> {
    const resolvedType = type ?? this.detectType(source)
    if (!resolvedType) {
      const err = new Error(`[xq-doc-viewer] Cannot detect file type`)
      this.bus.emit('error', { error: err })
      this.options.onError?.(err)
      throw err
    }

    // Destroy previous renderer
    if (this.renderer) {
      this.renderer.destroy()
      this.renderer = null
      this.contentEl.innerHTML = ''
    }

    try {
      this.renderer = await createRenderer(resolvedType)
      this.renderer.mount(this.contentEl)
      await this.renderer.load(source)

      this.totalPages = this.renderer.getPageCount?.() ?? 1
      this.currentPage = 1
      this.currentScale = 1
      this.currentRotation = 0

      this.bus.emit('load', { type: resolvedType })
      this.options.onReady?.()
      this.toolbar?.update()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      this.bus.emit('error', { error })
      this.options.onError?.(error)
      throw error
    }
  }

  destroy(): void {
    if (!this.mounted) return
    this.renderer?.destroy()
    this.renderer = null
    this.toolbar?.destroy()
    this.toolbar = null
    this.watermark.remove()
    this.styleEl?.remove()
    this.container?.remove()
    this.bus.emit('destroy', undefined)
    this.bus.removeAll()
    this.mounted = false
  }

  // ─── Navigation ───

  zoom(scale: number): void {
    this.currentScale = scale
    this.renderer?.zoom?.(scale)
    this.bus.emit('zoom-change', { scale })
    this.toolbar?.update()
  }

  rotate(degrees: number): void {
    this.currentRotation = (this.currentRotation + degrees) % 360
    this.renderer?.rotate?.(this.currentRotation)
    this.toolbar?.update()
  }

  gotoPage(page: number): void {
    if (page < 1 || page > this.totalPages) return
    this.currentPage = page
    this.renderer?.gotoPage?.(page)
    this.bus.emit('page-change', { page, total: this.totalPages })
    this.toolbar?.update()
  }

  prevPage(): void {
    this.gotoPage(this.currentPage - 1)
  }

  nextPage(): void {
    this.gotoPage(this.currentPage + 1)
  }

  fullscreen(enable: boolean): void {
    if (enable) {
      requestFullscreen(this.container)
    } else {
      exitFullscreen()
    }
  }

  print(): void {
    this.renderer?.print?.()
  }

  async download(): Promise<void> {
    if (!this.options.file) return
    const url = await fileToUrl(this.options.file)
    const a = document.createElement('a')
    a.href = url
    a.download = this.guessFilename()
    a.click()
  }

  setTheme(mode: ThemeMode): void {
    this.theme.setMode(mode)
    this.theme.apply(this.container)
    this.bus.emit('theme-change', { theme: mode })
  }

  setLocale(locale: LocaleKey): void {
    this.i18n.setLocale(locale)
    this.toolbar?.updateLabels()
    this.bus.emit('locale-change', { locale })
  }

  setWatermark(config: WatermarkConfig): void {
    this.watermark.apply(this.contentEl, config)
    this.bus.emit('watermark-change', { config })
  }

  removeWatermark(): void {
    this.watermark.remove()
    this.bus.emit('watermark-change', { config: null })
  }

  // ─── Events ───

  on<K extends keyof ViewerEvents>(event: K, handler: (payload: ViewerEvents[K]) => void): void {
    this.bus.on(event, handler)
  }

  off<K extends keyof ViewerEvents>(event: K, handler: (payload: ViewerEvents[K]) => void): void {
    this.bus.off(event, handler)
  }

  // ─── Getters ───

  getScale(): number {
    return this.currentScale
  }
  getRotation(): number {
    return this.currentRotation
  }
  getPage(): number {
    return this.currentPage
  }
  getTotalPages(): number {
    return this.totalPages
  }
  isFullscreen(): boolean {
    return isFullscreen()
  }

  // ─── Private ───

  private injectStyles(): void {
    this.styleEl = document.createElement('style')
    this.styleEl.textContent = [baseStyles, toolbarStyles, rendererStyles].join('\n')
    document.head.appendChild(this.styleEl)
  }

  private buildDOM(): void {
    this.container = document.createElement('div')
    this.container.className = 'xq-doc-viewer'
    this.container.style.width = toCssSize(this.options.width ?? '100%')
    this.container.style.height = toCssSize(this.options.height ?? '100%')

    this.contentEl = document.createElement('div')
    this.contentEl.className = 'xq-doc-viewer__content'
    this.container.appendChild(this.contentEl)

    this.root.appendChild(this.container)
  }

  private detectType(source: FileSource): FileType | undefined {
    if (source instanceof ArrayBuffer) return undefined
    return detectFileType(source as string | File | Blob)
  }

  private guessFilename(): string {
    const src = this.options.file
    if (typeof src === 'string') {
      const name = src.split('/').pop()?.split('?')[0]
      if (name) return name
    }
    if (src instanceof File) return src.name
    return 'download'
  }
}

function toCssSize(v: string | number): string {
  return typeof v === 'number' ? `${v}px` : v
}
