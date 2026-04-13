type Handler<T = unknown> = (payload: T) => void

export class EventBus<EventMap extends { [K in keyof EventMap]: unknown }> {
  private readonly listeners = new Map<keyof EventMap, Set<Handler>>()

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as Handler)
  }

  off<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): void {
    this.listeners.get(event)?.delete(handler as Handler)
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(payload)
      } catch (err) {
        console.error(`[xq-doc-viewer] Error in event handler for "${String(event)}":`, err)
      }
    })
  }

  removeAll(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }
}
