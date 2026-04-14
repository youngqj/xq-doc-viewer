interface ParseOfdOptions {
  ofd: File | ArrayBuffer | string | Blob
  success(res: unknown): void
  fail(err: unknown): void
}

export declare function parseOfdDocument(options: ParseOfdOptions): void
export declare function renderOfd(screenWidth: number, ofd: unknown): HTMLDivElement[]
export declare function renderOfdByScale(ofd: unknown): HTMLDivElement[]
export declare function digestCheck(options: unknown): unknown
export declare function setPageScale(scale: number): void
export declare function getPageScale(): number
export declare function calPageBox(screenWidth: number, document: unknown, page: unknown): { x: number; y: number; w: number; h: number }
export declare function calPageBoxScale(document: unknown, page: unknown): { x: number; y: number; w: number; h: number }
export declare function renderPage(pageDiv: HTMLDivElement, page: unknown, tpls: unknown, fontResObj: unknown, drawParamResObj: unknown, multiMediaResObj: unknown): void
