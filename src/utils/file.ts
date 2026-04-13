import type { FileSource } from '../core/types'

export function getFileExtension(filename: string): string {
  const cleaned = filename.split('?')[0].split('#')[0]
  const ext = cleaned.split('.').pop()?.toLowerCase()
  return ext ?? ''
}

export async function fileToArrayBuffer(source: FileSource): Promise<ArrayBuffer> {
  if (source instanceof ArrayBuffer) return source
  if (source instanceof Blob) return source.arrayBuffer()
  // string URL — fetch it
  const resp = await fetch(source)
  return resp.arrayBuffer()
}

export async function fileToUrl(source: FileSource): Promise<string> {
  if (typeof source === 'string') return source
  if (source instanceof File || source instanceof Blob) {
    return URL.createObjectURL(source)
  }
  // ArrayBuffer → Blob → URL
  const blob = new Blob([source])
  return URL.createObjectURL(blob)
}
