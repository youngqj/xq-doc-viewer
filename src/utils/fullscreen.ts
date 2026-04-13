export function requestFullscreen(el: HTMLElement): void {
  const fn =
    el.requestFullscreen ??
    (el as unknown as Record<string, () => Promise<void>>).webkitRequestFullscreen
  fn?.call(el)
}

export function exitFullscreen(): void {
  const fn =
    document.exitFullscreen ??
    (document as unknown as Record<string, () => Promise<void>>).webkitExitFullscreen
  fn?.call(document)
}

export function isFullscreen(): boolean {
  return !!(
    document.fullscreenElement ??
    (document as unknown as Record<string, Element | null>).webkitFullscreenElement
  )
}
