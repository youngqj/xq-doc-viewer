# xq-doc-viewer

[中文](./README.md) | **English**

A zero-dependency, framework-agnostic document preview SDK. Supports 11 formats: PDF, DOCX, PPTX, Excel, CSV, OFD, images, video, audio, plain text, and Markdown.

## Features

- **Zero install dependencies** — `npm install xq-doc-viewer` is enough; all rendering engines are bundled
- **Lazy loading** — each format is its own chunk; the PDF engine is only fetched when you open a PDF
- **Framework-agnostic** — pure DOM; works with Vue, React, Angular, or plain HTML
- **Built-in toolbar** — zoom, pagination, rotate, fullscreen, print, download
- **Theming** — light/dark modes with custom accent colors
- **i18n** — ships with Chinese and English; accepts custom locale packs
- **Watermark** — text or image watermarks
- **Audio visualization** — real-time waveform animation while playing audio
- **TypeScript** — full type definitions

## Supported formats

| Format | Extensions |
|--------|------------|
| PDF | .pdf |
| Word | .docx |
| PowerPoint | .pptx, .ppt |
| Excel | .xlsx, .xls |
| CSV | .csv |
| OFD | .ofd |
| Image | .jpg, .png, .gif, .svg, .webp, .bmp |
| Video | .mp4, .webm, .ogg |
| Audio | .mp3, .wav, .ogg, .aac, .flac |
| Plain text | .txt, .log, .json, .xml, .yaml, etc. |
| Markdown | .md |

## Installation

```bash
npm install xq-doc-viewer
# or
pnpm add xq-doc-viewer
# or
yarn add xq-doc-viewer
```

## Quick start

```html
<div id="viewer" style="width: 100%; height: 600px;"></div>
```

```ts
import { createViewer } from 'xq-doc-viewer'

const viewer = createViewer({
  target: '#viewer',
  file: '/path/to/document.pdf',
})

await viewer.mount()
```

## API

### createViewer(options)

Create a Viewer instance.

```ts
const viewer = createViewer({
  // Required: mount target (CSS selector or DOM element)
  target: '#viewer',

  // File source (URL, File object, Blob, or ArrayBuffer)
  file: '/demo.pdf',

  // File type (auto-detected when omitted)
  type: 'pdf',

  // Toolbar config (true/false or granular config)
  toolbar: true,

  // Theme ('light' | 'dark' or a custom config)
  theme: 'light',

  // Locale ('zh-CN' | 'en' or a custom locale pack)
  locale: 'en',

  // Watermark config
  watermark: {
    text: 'Confidential',
    color: 'rgba(0,0,0,0.08)',
    rotate: -30,
  },

  // Container size
  width: '100%',
  height: '600px',

  // Callbacks
  onReady: () => console.log('ready'),
  onError: (err) => console.error(err),
})
```

### ViewerOptions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `target` | `string \| HTMLElement` | — | **Required.** Mount container |
| `file` | `string \| File \| Blob \| ArrayBuffer` | — | File source |
| `type` | `FileType` | auto-detect | Explicit file type |
| `toolbar` | `boolean \| ToolbarConfig` | `true` | Toolbar config |
| `theme` | `'light' \| 'dark' \| ThemeConfig` | `'light'` | Theme |
| `locale` | `'zh-CN' \| 'en' \| LocaleConfig` | `'zh-CN'` | Locale |
| `watermark` | `WatermarkConfig` | — | Watermark config |
| `width` | `string \| number` | `'100%'` | Container width |
| `height` | `string \| number` | `'100%'` | Container height |
| `onReady` | `() => void` | — | Load-complete callback |
| `onError` | `(error: Error) => void` | — | Error callback |

### Viewer instance methods

#### Lifecycle

```ts
await viewer.mount()         // mount into DOM
viewer.destroy()             // tear down and release resources
```

#### Switch file

```ts
// By URL
await viewer.setFile('/path/to/file.docx')

// By File object (e.g. drag-and-drop)
await viewer.setFile(file)

// By ArrayBuffer (type must be specified)
await viewer.setFile(buffer, 'pdf')
```

#### Navigation

```ts
viewer.zoom(1.5)             // set zoom scale
viewer.rotate(90)            // rotate (accumulative)
viewer.gotoPage(3)           // jump to page 3
viewer.prevPage()            // previous page
viewer.nextPage()            // next page
viewer.fullscreen(true)      // enter fullscreen
viewer.print()               // print
await viewer.download()      // download the file
```

#### Theme & locale

```ts
viewer.setTheme('dark')      // switch to dark theme
viewer.setLocale('en')       // switch to English
```

#### Watermark

```ts
// Text watermark
viewer.setWatermark({
  text: 'Confidential',
  fontSize: 16,
  color: 'rgba(0,0,0,0.1)',
  rotate: -30,
  gap: [100, 100],
})

// Image watermark
viewer.setWatermark({
  image: '/logo.png',
})

// Remove watermark
viewer.removeWatermark()
```

#### State queries

```ts
viewer.getScale()            // current zoom scale
viewer.getRotation()         // current rotation (deg)
viewer.getPage()             // current page
viewer.getTotalPages()       // total pages
viewer.isFullscreen()        // fullscreen state
```

### Events

```ts
viewer.on('load', ({ type }) => {
  console.log(`loaded ${type} file`)
})

viewer.on('page-change', ({ page, total }) => {
  console.log(`page ${page}/${total}`)
})

viewer.on('zoom-change', ({ scale }) => {
  console.log(`zoom ${scale}`)
})

viewer.on('error', ({ error }) => {
  console.error(error)
})

viewer.on('theme-change', ({ theme }) => {})
viewer.on('locale-change', ({ locale }) => {})
viewer.on('watermark-change', ({ config }) => {})
viewer.on('destroy', () => {})

// Unsubscribe
viewer.off('load', handler)
```

### Custom renderer

```ts
import { registerRenderer } from 'xq-doc-viewer'

registerRenderer('pdf', async () => {
  return {
    type: 'pdf',
    mount(container) { /* ... */ },
    async load(source) { /* ... */ },
    destroy() { /* ... */ },
    // Optional
    zoom(scale) { /* ... */ },
    rotate(degrees) { /* ... */ },
    getPageCount() { return 10 },
    gotoPage(page) { /* ... */ },
    getCurrentPage() { return 1 },
    print() { /* ... */ },
  }
})
```

### Toolbar config

```ts
createViewer({
  target: '#viewer',
  toolbar: {
    zoom: true,       // zoom buttons
    rotate: true,     // rotate buttons
    pagination: true, // pagination
    fullscreen: true, // fullscreen
    print: false,     // hide print
    download: false,  // hide download
  },
})
```

### Custom theme colors

```ts
createViewer({
  target: '#viewer',
  theme: {
    mode: 'light',
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f5f5f5',
      textPrimary: '#333333',
      textSecondary: '#666666',
      border: '#e0e0e0',
      accent: '#1890ff',
      toolbarBg: '#ffffff',
      toolbarText: '#333333',
    },
  },
})
```

### Custom locale pack

```ts
createViewer({
  target: '#viewer',
  locale: {
    messages: {
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      rotateLeft: 'Rotate Left',
      rotateRight: 'Rotate Right',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit Fullscreen',
      print: 'Print',
      download: 'Download',
      prevPage: 'Previous',
      nextPage: 'Next',
      pageOf: 'Page {page} of {total}',
      loading: 'Loading…',
      error: 'Failed to load',
      dragHint: 'Drag and drop a file here to preview',
      unsupportedType: 'Unsupported file type',
      pptxSlide: 'Slide',
      ofdPage: 'OFD Page',
      watermark: 'Watermark',
      errorTitle: 'Cannot preview this file',
      errorUnknownType: 'Cannot detect file type. Please pass `type` explicitly.',
      errorUnsupportedType: 'Unsupported file type: {type}',
      errorLoadFailed: 'Failed to load file',
      errorNetwork: 'Cannot access the file. Please check the URL or network.',
      errorRetry: 'Retry',
    },
  },
})
```

## Error handling

When a file can't be previewed, the viewer renders a friendly in-place error panel instead of leaving a blank canvas. It covers three failure modes:

1. **Unknown type** — `file` is provided but no `type` was passed and the extension couldn't be inferred.
2. **Unsupported type** — `type` (or the inferred type) isn't registered.
3. **Load / network failure** — fetch failed, CORS blocked, 404, or the underlying renderer threw.

For URL or `File` sources a **Retry** button is shown. The `error` event and `onError` callback still fire so you can wire up your own reporting.

## Usage in frameworks

### Vue 3

```vue
<template>
  <div ref="viewerRef" style="height: 600px" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { createViewer } from 'xq-doc-viewer'

const viewerRef = ref()
let viewer = null

onMounted(async () => {
  viewer = createViewer({
    target: viewerRef.value,
    file: '/demo.pdf',
    theme: 'light',
    locale: 'en',
  })
  await viewer.mount()
})

onBeforeUnmount(() => {
  viewer?.destroy()
})
</script>
```

### React

```tsx
import { useEffect, useRef } from 'react'
import { createViewer, Viewer } from 'xq-doc-viewer'

function DocViewer({ file }: { file: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const viewer = createViewer({
      target: containerRef.current,
      file,
      theme: 'light',
    })
    viewer.mount()
    viewerRef.current = viewer

    return () => {
      viewer.destroy()
      viewerRef.current = null
    }
  }, [file])

  return <div ref={containerRef} style={{ height: 600 }} />
}
```

### CDN / IIFE

```html
<div id="viewer" style="height: 600px"></div>
<script src="xq-doc-viewer.iife.js"></script>
<script>
  const viewer = XQDocViewer.createViewer({
    target: '#viewer',
    file: '/demo.pdf',
  })
  viewer.mount()
</script>
```

## Build artifacts

| File | Description |
|------|-------------|
| `dist/xq-doc-viewer.js` | ESM entry |
| `dist/xq-doc-viewer.cjs` | CommonJS entry |
| `dist/index.d.ts` | TypeScript declarations |
| `dist/*.js` | Format-specific lazy-loaded chunks |

## License

MIT
