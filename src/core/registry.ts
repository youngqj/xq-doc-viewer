import type { FileType, Renderer, RendererFactory } from './types'

type RendererModule = { create(): Renderer }

const builtinRenderers: Record<FileType, () => Promise<RendererModule>> = {
  pdf: () => import('../renderers/pdf'),
  docx: () => import('../renderers/docx'),
  excel: () => import('../renderers/excel'),
  csv: () => import('../renderers/csv'),
  pptx: () => import('../renderers/pptx'),
  ofd: () => import('../renderers/ofd'),
  image: () => import('../renderers/image'),
  video: () => import('../renderers/video'),
  audio: () => import('../renderers/audio'),
  text: () => import('../renderers/text'),
  markdown: () => import('../renderers/markdown'),
}

const customFactories = new Map<FileType, RendererFactory>()

export function registerRenderer(type: FileType, factory: RendererFactory): void {
  customFactories.set(type, factory)
}

export async function createRenderer(type: FileType): Promise<Renderer> {
  const customFactory = customFactories.get(type)
  if (customFactory) {
    return customFactory()
  }

  const loader = builtinRenderers[type]
  if (!loader) {
    throw new Error(`[xq-doc-viewer] No renderer for type: ${type}`)
  }

  const mod = await loader()
  return mod.create()
}

// ─── File type detection ───

const EXTENSION_MAP: Record<string, FileType> = {
  // PDF
  pdf: 'pdf',
  // DOCX
  docx: 'docx',
  doc: 'docx',
  // PPTX
  pptx: 'pptx',
  ppt: 'pptx',
  // OFD
  ofd: 'ofd',
  // Excel
  xlsx: 'excel',
  xls: 'excel',
  // CSV
  csv: 'csv',
  tsv: 'csv',
  // Image
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  bmp: 'image',
  ico: 'image',
  avif: 'image',
  // Video
  mp4: 'video',
  webm: 'video',
  ogg: 'video',
  mov: 'video',
  avi: 'video',
  mkv: 'video',
  // Audio
  mp3: 'audio',
  wav: 'audio',
  flac: 'audio',
  aac: 'audio',
  m4a: 'audio',
  wma: 'audio',
  // Markdown
  md: 'markdown',
  markdown: 'markdown',
  // Text
  txt: 'text',
  log: 'text',
  json: 'text',
  xml: 'text',
  yaml: 'text',
  yml: 'text',
  ini: 'text',
  conf: 'text',
  cfg: 'text',
  toml: 'text',
  html: 'text',
  htm: 'text',
  css: 'text',
  js: 'text',
  ts: 'text',
  py: 'text',
  rb: 'text',
  java: 'text',
  go: 'text',
  rs: 'text',
  c: 'text',
  cpp: 'text',
  h: 'text',
  sh: 'text',
  bat: 'text',
}

const MIME_MAP: Record<string, FileType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'pptx',
  'application/ofd': 'ofd',
  'text/csv': 'csv',
  'text/tab-separated-values': 'csv',
  'text/markdown': 'markdown',
  'text/plain': 'text',
}

export function detectFileType(source: string | File | Blob): FileType | undefined {
  if (typeof source === 'string') {
    return detectFromUrl(source)
  }

  if (source instanceof File) {
    const fromName = detectFromUrl(source.name)
    if (fromName) return fromName
    return detectFromMime(source.type)
  }

  if (source instanceof Blob) {
    return detectFromMime(source.type)
  }

  return undefined
}

function detectFromUrl(url: string): FileType | undefined {
  const cleaned = url.split('?')[0].split('#')[0]
  const ext = cleaned.split('.').pop()?.toLowerCase()
  return ext ? EXTENSION_MAP[ext] : undefined
}

function detectFromMime(mime: string): FileType | undefined {
  if (!mime) return undefined
  if (MIME_MAP[mime]) return MIME_MAP[mime]
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('text/')) return 'text'
  return undefined
}
