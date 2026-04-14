# xq-doc-viewer

零依赖、框架无关的文档预览 SDK。支持 PDF、DOCX、PPTX、Excel、CSV、OFD、图片、视频、音频、纯文本、Markdown 共 11 种格式。

## 特性

- **零依赖安装** — `npm install xq-doc-viewer` 即可，所有渲染库已打包
- **按需加载** — 每种格式独立 chunk，打开 PDF 才加载 PDF 引擎
- **框架无关** — 纯 DOM 实现，可用于 Vue、React、Angular 或原生 HTML
- **内置工具栏** — 缩放、翻页、旋转、全屏、打印、下载
- **主题切换** — 亮色/暗色主题，支持自定义主题色
- **国际化** — 内置中文/英文，支持自定义语言包
- **水印** — 支持文字/图片水印
- **音频可视化** — 播放音频时显示实时音波动画
- **TypeScript** — 完整的类型定义

## 支持格式

| 格式 | 扩展名 |
|------|--------|
| PDF | .pdf |
| Word | .docx |
| PowerPoint | .pptx, .ppt |
| Excel | .xlsx, .xls |
| CSV | .csv |
| OFD | .ofd |
| 图片 | .jpg, .png, .gif, .svg, .webp, .bmp |
| 视频 | .mp4, .webm, .ogg |
| 音频 | .mp3, .wav, .ogg, .aac, .flac |
| 纯文本 | .txt, .log, .json, .xml, .yaml 等 |
| Markdown | .md |

## 安装

```bash
npm install xq-doc-viewer
# 或
pnpm add xq-doc-viewer
# 或
yarn add xq-doc-viewer
```

## 快速开始

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

创建 Viewer 实例。

```ts
const viewer = createViewer({
  // 必填：挂载目标（CSS 选择器或 DOM 元素）
  target: '#viewer',

  // 文件源（URL、File 对象、Blob 或 ArrayBuffer）
  file: '/demo.pdf',

  // 指定文件类型（不传则自动检测）
  type: 'pdf',

  // 工具栏配置（true/false 或精细配置）
  toolbar: true,

  // 主题（'light' | 'dark' 或自定义配置）
  theme: 'light',

  // 语言（'zh-CN' | 'en' 或自定义语言包）
  locale: 'zh-CN',

  // 水印配置
  watermark: {
    text: '内部文件',
    color: 'rgba(0,0,0,0.08)',
    rotate: -30,
  },

  // 容器尺寸
  width: '100%',
  height: '600px',

  // 回调
  onReady: () => console.log('加载完成'),
  onError: (err) => console.error(err),
})
```

### ViewerOptions

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `target` | `string \| HTMLElement` | — | **必填**。挂载容器 |
| `file` | `string \| File \| Blob \| ArrayBuffer` | — | 文件源 |
| `type` | `FileType` | 自动检测 | 指定文件类型 |
| `toolbar` | `boolean \| ToolbarConfig` | `true` | 工具栏配置 |
| `theme` | `'light' \| 'dark' \| ThemeConfig` | `'light'` | 主题 |
| `locale` | `'zh-CN' \| 'en' \| LocaleConfig` | `'zh-CN'` | 语言 |
| `watermark` | `WatermarkConfig` | — | 水印配置 |
| `width` | `string \| number` | `'100%'` | 容器宽度 |
| `height` | `string \| number` | `'100%'` | 容器高度 |
| `onReady` | `() => void` | — | 加载完成回调 |
| `onError` | `(error: Error) => void` | — | 错误回调 |

### Viewer 实例方法

#### 生命周期

```ts
await viewer.mount()         // 挂载到 DOM
viewer.destroy()             // 销毁实例，释放资源
```

#### 切换文件

```ts
// 通过 URL
await viewer.setFile('/path/to/file.docx')

// 通过 File 对象（如拖拽上传）
await viewer.setFile(file)

// 通过 ArrayBuffer（需指定类型）
await viewer.setFile(buffer, 'pdf')
```

#### 导航控制

```ts
viewer.zoom(1.5)             // 设置缩放比例
viewer.rotate(90)            // 旋转（累加）
viewer.gotoPage(3)           // 跳转到第 3 页
viewer.prevPage()            // 上一页
viewer.nextPage()            // 下一页
viewer.fullscreen(true)      // 进入全屏
viewer.print()               // 打印
await viewer.download()      // 下载文件
```

#### 主题和语言

```ts
viewer.setTheme('dark')      // 切换暗色主题
viewer.setLocale('en')       // 切换英文
```

#### 水印

```ts
// 文字水印
viewer.setWatermark({
  text: '机密文件',
  fontSize: 16,
  color: 'rgba(0,0,0,0.1)',
  rotate: -30,
  gap: [100, 100],
})

// 图片水印
viewer.setWatermark({
  image: '/logo.png',
})

// 移除水印
viewer.removeWatermark()
```

#### 状态查询

```ts
viewer.getScale()            // 当前缩放比例
viewer.getRotation()         // 当前旋转角度
viewer.getPage()             // 当前页码
viewer.getTotalPages()       // 总页数
viewer.isFullscreen()        // 是否全屏
```

### 事件

```ts
viewer.on('load', ({ type }) => {
  console.log(`已加载 ${type} 文件`)
})

viewer.on('page-change', ({ page, total }) => {
  console.log(`第 ${page}/${total} 页`)
})

viewer.on('zoom-change', ({ scale }) => {
  console.log(`缩放 ${scale}`)
})

viewer.on('error', ({ error }) => {
  console.error(error)
})

viewer.on('theme-change', ({ theme }) => {})
viewer.on('locale-change', ({ locale }) => {})
viewer.on('watermark-change', ({ config }) => {})
viewer.on('destroy', () => {})

// 取消监听
viewer.off('load', handler)
```

### 自定义渲染器

```ts
import { registerRenderer } from 'xq-doc-viewer'

registerRenderer('pdf', async () => {
  return {
    type: 'pdf',
    mount(container) { /* ... */ },
    async load(source) { /* ... */ },
    destroy() { /* ... */ },
    // 可选
    zoom(scale) { /* ... */ },
    rotate(degrees) { /* ... */ },
    getPageCount() { return 10 },
    gotoPage(page) { /* ... */ },
    getCurrentPage() { return 1 },
    print() { /* ... */ },
  }
})
```

### 工具栏配置

```ts
createViewer({
  target: '#viewer',
  toolbar: {
    zoom: true,       // 缩放按钮
    rotate: true,     // 旋转按钮
    pagination: true, // 翻页按钮
    fullscreen: true, // 全屏按钮
    print: false,     // 隐藏打印
    download: false,  // 隐藏下载
  },
})
```

### 自定义主题色

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

### 自定义语言

```ts
createViewer({
  target: '#viewer',
  locale: {
    messages: {
      zoomIn: '放大',
      zoomOut: '缩小',
      rotateLeft: '左旋',
      rotateRight: '右旋',
      fullscreen: '全屏',
      exitFullscreen: '退出全屏',
      print: '打印',
      download: '下载',
      prevPage: '上一页',
      nextPage: '下一页',
      pageOf: '/',
      loading: '加载中...',
      error: '加载失败',
      dragHint: '拖拽文件到此处预览',
      unsupportedType: '不支持的文件格式',
      pptxSlide: '幻灯片',
      ofdPage: 'OFD 页面',
      watermark: '水印',
    },
  },
})
```

## 在框架中使用

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
    locale: 'zh-CN',
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

## 构建产物

| 文件 | 说明 |
|------|------|
| `dist/xq-doc-viewer.js` | ESM 入口 |
| `dist/xq-doc-viewer.cjs` | CommonJS 入口 |
| `dist/index.d.ts` | TypeScript 类型声明 |
| `dist/*.js` | 按需加载的格式 chunk |

## License

MIT
