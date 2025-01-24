import EventEmitter, { on } from 'node:events'

interface EventsMap {
  [key: string]: (...args: any[]) => any
}

declare interface IterableEventEmitter<Events extends EventsMap> {
  on: <TEv extends keyof Events>(event: TEv, listener: Events[TEv]) => this
  off: <TEv extends keyof Events>(event: TEv, listener: Events[TEv]) => this
  once: <TEv extends keyof Events>(event: TEv, listener: Events[TEv]) => this
  emit: <TEv extends keyof Events>(event: TEv, ...args: Parameters<Events[TEv]>) => boolean
}

// eslint-disable-next-line ts/no-unsafe-declaration-merging
class IterableEventEmitter<Events extends EventsMap> extends EventEmitter {
  public toIterable<TEv extends (keyof Events) & string>(
    event: TEv,
    opts: NonNullable<Parameters<typeof on>[2]>,
  ): AsyncIterable<Parameters<Events[TEv]>> {
    return on(this, event, opts) as any
  }
}

export default IterableEventEmitter
