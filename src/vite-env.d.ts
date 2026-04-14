declare module '*.css?inline' {
  const content: string
  export default content
}

declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  const WorkerMessageHandler: unknown
  export { WorkerMessageHandler }
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

declare module 'ofd-xml-parser' {
  const parser: {
    parse(content: string, options?: Record<string, unknown>): Record<string, unknown>
  }
  export default parser
}

declare module '@lapo/asn1js' {
  export class ASN1 {
    static decode(der: unknown, offset?: number): Record<string, unknown>
  }
}

declare module '@lapo/asn1js/hex' {
  export class Hex {
    static decode(val: string): unknown
  }
}

declare module '@lapo/asn1js/base64' {
  export class Base64 {
    static unarmor(val: string): unknown
    static decode(val: string): unknown
  }
}

declare module 'jsrsasign' {
  const rsa: {
    KJUR: {
      crypto: {
        Signature: new (options: Record<string, unknown>) => {
          init(cert: unknown): void
          updateHex(msg: unknown): void
          verify(sig: string): boolean
        }
      }
    }
  }
  export default rsa
}

declare module 'sm-crypto' {
  export const sm2: {
    doVerifySignature(msg: unknown, sigValueHex: string, publicKey: string, options: Record<string, unknown>): boolean
  }
}

declare module 'js-md5' {
  const md5: (data: unknown) => string
  export default md5
}

declare module 'js-sha1' {
  const sha1: (data: unknown) => string
  export default sha1
}
