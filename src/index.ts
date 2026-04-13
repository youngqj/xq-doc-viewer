import { Viewer } from './core/viewer'
import type { ViewerOptions, FileType, FileSource, ViewerEvents, ViewerEventName } from './core/types'
import { registerRenderer } from './core/registry'

export function createViewer(options: ViewerOptions): Viewer {
  return new Viewer(options)
}

export { Viewer, registerRenderer }
export type { ViewerOptions, FileType, FileSource, ViewerEvents, ViewerEventName }
export type {
  ThemeMode,
  ThemeConfig,
  ThemeColors,
  LocaleKey,
  LocaleConfig,
  LocaleMessages,
  ToolbarConfig,
  WatermarkConfig,
  Renderer,
  RendererFactory,
} from './core/types'
