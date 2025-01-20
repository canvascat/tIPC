import type { TRPCLink } from '@trpc/client'
import type {
  TRPCErrorShape,
  TRPCResult,
} from '@trpc/server/rpc'
import type {
  AnyClientTypes,
  inferClientTypes,
  InferrableClientTypes,
} from '@trpc/server/unstable-core-do-not-import'
import type { IpcRenderer } from 'electron'
import { TRPCClientError } from '@trpc/client'
import { getTransformer, type TransformerOptions, type TRPCConnectionState } from '@trpc/client/unstable-internals'
import { behaviorSubject, observable } from '@trpc/server/observable'
import { run } from '@trpc/server/unstable-core-do-not-import'
import { raceAbortSignals } from '../internals/signals'
import { subscriptionStreamConsumer } from './stream'

/**
 * Get the result of a value or function that returns a value
 * It also optionally accepts type safe arguments for the function
 */
export function resultOf<T, TArgs extends any[]>(value: T | ((...args: TArgs) => T), ...args: TArgs): T {
  return typeof value === 'function'
    ? (value as (...args: TArgs) => T)(...args)
    : value
}

type SubscriptionLinkOptions<
  TRoot extends AnyClientTypes,
> = {
  ipcRenderer?: Pick<IpcRenderer, 'on' | 'off'>
} & TransformerOptions<TRoot>

export function subscriptionLink<
  TInferrable extends InferrableClientTypes,
>(
  opts: SubscriptionLinkOptions<
    inferClientTypes<TInferrable>
  >,
): TRPCLink<TInferrable> {
  const transformer = getTransformer(opts.transformer)

  return () => {
    return ({ op }) => {
      return observable((observer) => {
        const { type } = op

        /* istanbul ignore if -- @preserve */
        if (type !== 'subscription') {
          throw new Error('httpSubscriptionLink only supports subscriptions')
        }

        const ac = new AbortController()
        const signal = raceAbortSignals(op.signal, ac.signal)
        const ipcRenderer: IpcRenderer = opts.ipcRenderer ?? (globalThis as any).ipcRenderer
        const subscriptionStream = subscriptionStreamConsumer<{
          data: Partial<{
            id?: string
            data: unknown
          }>
          error: TRPCErrorShape
          context: never
        }>({
          signal,
          deserialize: transformer.output.deserialize,
          ipcRenderer,
        })

        const connectionState = behaviorSubject<
          TRPCConnectionState<TRPCClientError<any>>
        >({
          type: 'state',
          state: 'connecting',
          error: null,
        })

        const connectionSub = connectionState.subscribe({
          next(state) {
            observer.next({
              result: state,
            })
          },
        })
        run(async () => {
          for await (const chunk of subscriptionStream) {
            const chunkData = chunk.data

            let result: TRPCResult<unknown>
            if (chunkData.id) {
              result = {
                id: chunkData.id,
                data: chunkData,
              }
            }
            else {
              result = {
                data: chunkData.data,
              }
            }

            observer.next({
              result,
              context: {
                event: chunk.event,
              },
            })
          }

          observer.next({
            result: {
              type: 'stopped',
            },
          })
          observer.complete()
        }).catch((error) => {
          observer.error(TRPCClientError.from(error))
        })

        return () => {
          observer.complete()
          ac.abort()
          connectionSub.unsubscribe()
        }
      })
    }
  }
}
