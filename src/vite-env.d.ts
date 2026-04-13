declare module '*.css?inline' {
  const content: string
  export default content
}

declare module 'pptxtojson' {
  interface PptxSlide {
    fill?: { type: string; value: string }
    elements: Record<string, unknown>[]
    note?: string
  }
  interface PptxResult {
    slides: PptxSlide[]
    themeColors: string[]
    size: { width: number; height: number }
  }
  export function parse(buffer: ArrayBuffer): Promise<PptxResult>
}

declare module 'easyofd' {
  class EasyOFD {
    constructor(id: string, element: HTMLElement)
    loadFromBlob(blob: Blob): void
    GetAllPageNo(): number
    FirstPage(): void
    NextPage(): void
    PrePage(): void
    LastPage(): void
    SetPage(page: number): void
    Draw(): void
    ZoomIn(): void
    ZoomOut(): void
    SetPhyViewZoom(scale: number): void
    scaleCanvas(): void
    FinshDocRead(): void
  }
  export default EasyOFD
}
