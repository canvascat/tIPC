import type { EventSourceLike, inferTrackedOutput } from '@trpc/server/unstable-core-do-not-import'
import type { IpcRenderer, IpcRendererEvent } from 'electron'
import { makeAsyncResource, run } from '@trpc/server/unstable-core-do-not-import'

type Deserialize = (value: any) => any
interface ConsumerConfig<Context extends Record<string, unknown> = never> {
  data: unknown
  error: unknown
  context: Context
}

interface ConsumerStreamResult<TConfig extends ConsumerConfig> {
  data: inferTrackedOutput<TConfig['data']>
  context: inferTrackedOutput<TConfig['context']>
}
export interface SubscriptionStreamConsumerOptions<TConfig extends ConsumerConfig> {
  signal: AbortSignal
  deserialize?: Deserialize
  ipcRenderer: Pick<IpcRenderer, 'on' | 'off'>
  subscribe?: (listener: (result: ConsumerStreamResult<TConfig>) => void) => () => void
}

interface MessageEvent {
  id?: string
  data: unknown
}

export function subscriptionStreamConsumer<TConfig extends ConsumerConfig>(
  opts: SubscriptionStreamConsumerOptions<TConfig>,
): AsyncIterable<ConsumerStreamResult<TConfig>> {
  const { deserialize = v => v } = opts

  const signal = opts.signal

  let closeHandleMessage: (() => void) | null = null

  const createStream = () =>
    new ReadableStream<ConsumerStreamResult<TConfig>>({
      async start(controller) {
        const ipcRenderer = opts.ipcRenderer
        const handleMessage = (_event: IpcRendererEvent, _msg: any) => {
          const msg = _msg as EventSourceLike.MessageEvent

          const chunk = deserialize(JSON.parse(msg.data))

          const def: MessageEvent = {
            data: chunk,
          }
          if (msg.lastEventId) {
            def.id = msg.lastEventId
          }
          controller.enqueue({
            data: def as inferTrackedOutput<TConfig['data']>,
            context: {} as inferTrackedOutput<TConfig['context']>,
          })
        }

        ipcRenderer.on('message', handleMessage)
        closeHandleMessage = () => ipcRenderer.off('message', handleMessage)

        const onAbort = () => {
          try {
            closeHandleMessage?.()
            controller.close()
          }
          catch {
            // ignore errors in case the controller is already closed
          }
        }
        if (signal.aborted) {
          onAbort()
        }
        else {
          signal.addEventListener('abort', onAbort)
        }
      },
      cancel() {
        closeHandleMessage?.()
      },
    })

  const getStreamResource = () => {
    let stream = createStream()
    let reader = stream.getReader()

    async function dispose() {
      await reader.cancel()
      closeHandleMessage = null
    }

    return makeAsyncResource(
      {
        read() {
          return reader.read()
        },
        async recreate() {
          await dispose()

          stream = createStream()
          reader = stream.getReader()
        },
      },
      dispose,
    )
  }

  return run(async function* () {
    await using stream = getStreamResource()

    while (true) {
      const promise = stream.read()

      const result = await promise

      if (result.done) {
        return result.value
      }
      yield result.value
    }
  })
}
