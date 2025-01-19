import type { Operation, TRPCLink } from '@trpc/client'
import type { TransformerOptions } from '@trpc/client/unstable-internals'
import type { Observer, UnsubscribeFn } from '@trpc/server/observable'
import type {
  AnyRouter,
  inferClientTypes,
  inferRouterError,
  ProcedureType,
  TRPCClientOutgoingMessage,
  TRPCRequestMessage,
  TRPCResponseMessage,
} from '@trpc/server/unstable-core-do-not-import'
import type { IpcRenderer } from 'electron'
import { TRPCClientError } from '@trpc/client'
import { getTransformer } from '@trpc/client/unstable-internals'
import { observable } from '@trpc/server/observable'
import { transformResult } from '@trpc/server/unstable-core-do-not-import'

type IPCCallbackResult<TRouter extends AnyRouter, TOutput> = TRPCResponseMessage<
  TOutput,
  inferRouterError<TRouter>
>

type IPCCallbackObserver<TRouter extends AnyRouter, TOutput> = Observer<
  IPCCallbackResult<TRouter, TOutput>,
  TRPCClientError<TRouter>
>
export function createIPCClient(opts: {
  ipcRenderer: Pick<IpcRenderer, 'on' | 'send'>
  channel: string
}) {
  const { ipcRenderer, channel } = opts
  /**
   * outgoing messages buffer whilst not open
   */
  let outgoing: TRPCClientOutgoingMessage[] = []
  /**
   * pending outgoing requests that are awaiting callback
   */
  type TCallbacks = IPCCallbackObserver<AnyRouter, unknown>
  interface IpcRequest {
    type: ProcedureType
    callbacks: TCallbacks
    op: Operation
    /**
     * The last event id that the client has received
     */
    lastEventId: string | undefined
  }
  const pendingRequests: Record<number | string, IpcRequest>
    = Object.create(null)

  /**
   * tries to send the list of messages
   */
  function dispatch() {
    // using a timeout to batch messages
    setTimeout(() => {
      if (outgoing.length === 1) {
        // single send
        ipcRenderer.send(channel, JSON.stringify(outgoing.pop()))
      }
      else {
        // batch send
        ipcRenderer.send(channel, JSON.stringify(outgoing))
      }
      // clear
      outgoing = []
    })
  }

  function request(opts: {
    op: Operation
    callbacks: TCallbacks
    lastEventId: string | undefined
  }): UnsubscribeFn {
    const { op, callbacks, lastEventId } = opts
    const { type, input, path, id } = op
    const envelope: TRPCRequestMessage = {
      id,
      method: type,
      params: {
        input,
        path,
        lastEventId,
      },
    }

    pendingRequests[id] = {
      type,
      callbacks,
      op,
      lastEventId,
    }
    // enqueue message
    outgoing.push(envelope)
    dispatch()
    return () => {
      const callbacks = pendingRequests[id]?.callbacks
      delete pendingRequests[id]
      outgoing = outgoing.filter(msg => msg.id !== id)

      callbacks?.complete?.()
      if (op.type === 'subscription') {
        outgoing.push({
          id,
          method: 'subscription.stop',
        })
        dispatch()
      }
    }
  }

  return {
    request,
  }
}

export type IPCClient = ReturnType<typeof createIPCClient>

export type IPCLinkOptions<TRouter extends AnyRouter> = {
  client: IPCClient
} & TransformerOptions<inferClientTypes<TRouter>>

export function ipcLink<TRouter extends AnyRouter>(
  opts: IPCLinkOptions<TRouter>,
): TRPCLink<TRouter> {
  const transformer = getTransformer(opts.transformer)
  return () => {
    const { client } = opts
    return ({ op }) => {
      return observable((observer) => {
        const { type, path, id, context } = op

        const input = transformer.input.serialize(op.input)

        const unsubscribeRequest = client.request({
          op: { type, path, input, id, context, signal: null },
          callbacks: {
            error(err) {
              observer.error(err)
              unsubscribeRequest()
            },
            complete() {
              observer.complete()
            },
            next(event) {
              const transformed = transformResult(event, transformer.output)

              if (!transformed.ok) {
                observer.error(TRPCClientError.from(transformed.error))
                return
              }
              observer.next({
                result: transformed.result,
              })

              if (op.type !== 'subscription') {
                // if it isn't a subscription we don't care about next response

                unsubscribeRequest()
                observer.complete()
              }
            },
          },
          lastEventId: undefined,
        })
        return () => {
          unsubscribeRequest()
        }
      })
    }
  }
}
