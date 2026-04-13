import type { ThemeMode } from '../core/types'

const LIGHT_VARS: Record<string, string> = {
  '--xq-bg-primary': '#ffffff',
  '--xq-bg-secondary': '#f5f5f5',
  '--xq-text-primary': '#1a1a1a',
  '--xq-text-secondary': '#666666',
  '--xq-border': '#e0e0e0',
  '--xq-accent': '#1890ff',
  '--xq-toolbar-bg': '#fafafa',
  '--xq-toolbar-text': '#333333',
}

const DARK_VARS: Record<string, string> = {
  '--xq-bg-primary': '#1e1e1e',
  '--xq-bg-secondary': '#2d2d2d',
  '--xq-text-primary': '#e0e0e0',
  '--xq-text-secondary': '#999999',
  '--xq-border': '#444444',
  '--xq-accent': '#409eff',
  '--xq-toolbar-bg': '#252525',
  '--xq-toolbar-text': '#cccccc',
}

export class ThemeManager {
  private mode: ThemeMode

  constructor(mode: ThemeMode) {
    this.mode = mode
  }

  getMode(): ThemeMode {
    return this.mode
  }

  setMode(mode: ThemeMode): void {
    this.mode = mode
  }

  apply(el: HTMLElement): void {
    const vars = this.mode === 'dark' ? DARK_VARS : LIGHT_VARS
    for (const [key, value] of Object.entries(vars)) {
      el.style.setProperty(key, value)
    }
    el.setAttribute('data-theme', this.mode)
  }
}
