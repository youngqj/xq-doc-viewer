// ─── File Source ───
export type FileSource = string | File | Blob | ArrayBuffer

// ─── File Types ───
export type FileType =
  | 'pdf'
  | 'docx'
  | 'excel'
  | 'csv'
  | 'pptx'
  | 'ofd'
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'markdown'

// ─── Toolbar Config ───
export interface ToolbarConfig {
  zoom?: boolean
  rotate?: boolean
  pagination?: boolean
  fullscreen?: boolean
  print?: boolean
  download?: boolean
}

// ─── Theme ───
export type ThemeMode = 'light' | 'dark'

export interface ThemeConfig {
  mode: ThemeMode
  colors?: Partial<ThemeColors>
}

export interface ThemeColors {
  bgPrimary: string
  bgSecondary: string
  textPrimary: string
  textSecondary: string
  border: string
  accent: string
  toolbarBg: string
  toolbarText: string
}

// ─── Locale ───
export type LocaleKey = 'zh-CN' | 'en'

export interface LocaleMessages {
  zoomIn: string
  zoomOut: string
  rotateLeft: string
  rotateRight: string
  fullscreen: string
  exitFullscreen: string
  print: string
  download: string
  prevPage: string
  nextPage: string
  pageOf: string
  loading: string
  error: string
  dragHint: string
  unsupportedType: string
  pptxSlide: string
  ofdPage: string
  watermark: string
}

export interface LocaleConfig {
  messages: LocaleMessages
}

// ─── Watermark ───
export interface WatermarkConfig {
  text?: string
  image?: string
  fontSize?: number
  color?: string
  rotate?: number
  gap?: [number, number]
}

// ─── Branding ───
export interface BrandingConfig {
  show?: boolean
  text?: string
  url?: string
}

// ─── Viewer Options ───
export interface ViewerOptions {
  target: HTMLElement | string
  file?: FileSource
  type?: FileType
  toolbar?: boolean | ToolbarConfig
  theme?: ThemeMode | ThemeConfig
  locale?: LocaleKey | LocaleConfig
  watermark?: WatermarkConfig
  branding?: boolean | BrandingConfig
  width?: string | number
  height?: string | number
  onReady?: () => void
  onError?: (error: Error) => void
}

// ─── Renderer Interface ───
export interface Renderer {
  readonly type: FileType
  mount(container: HTMLElement): void
  load(source: FileSource): Promise<void>
  destroy(): void

  // Optional capabilities
  zoom?(scale: number): void
  rotate?(degrees: number): void
  getPageCount?(): number
  gotoPage?(page: number): void
  getCurrentPage?(): number
  print?(): void

  // Scroll-driven page change callback (set by Viewer)
  onPageChange?: (page: number) => void
}

export type RendererFactory = () => Promise<Renderer>

// ─── Event Types ───
export interface ViewerEvents {
  load: { type: FileType }
  error: { error: Error }
  'page-change': { page: number; total: number }
  'zoom-change': { scale: number }
  'theme-change': { theme: ThemeMode }
  'locale-change': { locale: LocaleKey | string }
  'watermark-change': { config: WatermarkConfig | null }
  destroy: undefined
}

export type ViewerEventName = keyof ViewerEvents
