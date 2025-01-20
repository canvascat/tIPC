import type { TRPCLink } from '@trpc/client'
import type { TransformerOptions } from '@trpc/client/unstable-internals'
import type { AnyClientTypes, AnyRouter, CombinedDataTransformer } from '@trpc/server/unstable-core-do-not-import'
import type { IpcRenderer } from 'electron'
import { TRPCClientError } from '@trpc/client'
import { getTransformer } from '@trpc/client/unstable-internals'
import { observable } from '@trpc/server/observable'
import { transformResult } from '@trpc/server/unstable-core-do-not-import'

function arrayToDict(array: unknown[]) {
  const dict: Record<number, unknown> = {}
  for (let index = 0; index < array.length; index++) {
    const element = array[index]
    dict[index] = element
  }
  return dict
}

type GetInputOptions = {
  transformer: CombinedDataTransformer
} & ({ input: unknown } | { inputs: unknown[] })

export function getInput(opts: GetInputOptions) {
  return 'input' in opts
    ? opts.transformer.input.serialize(opts.input)
    : arrayToDict(
        opts.inputs.map(_input => opts.transformer.input.serialize(_input)),
      )
}

export type InvokeLinkOptions<TRoot extends AnyClientTypes> = {
  ipcRenderer?: Pick<IpcRenderer, 'invoke'>
} & TransformerOptions<TRoot>

export function invokeLink<TRouter extends AnyRouter = AnyRouter>(
  opts: InvokeLinkOptions<TRouter['_def']['_config']['$types']>,
): TRPCLink<TRouter> {
  const transformer = getTransformer(opts.transformer)
  return () => {
    return ({ op }) => {
      return observable((observer) => {
        const { input, type } = op
        /* istanbul ignore if -- @preserve */
        if (type === 'subscription') {
          throw new Error(
            'Subscriptions are unsupported by `invokeLink` - use `subscriptionLink`',
          )
        }
        const ipcRenderer: IpcRenderer = opts.ipcRenderer ?? (globalThis as any).ipcRenderer
        let meta: any | undefined
        ipcRenderer.invoke('message', getInput({ input, transformer }))
          .then((res) => {
            meta = res.meta
            const transformed = transformResult(
              res.json,
              transformer.output,
            )

            if (!transformed.ok) {
              observer.error(
                TRPCClientError.from(transformed.error, {
                  meta,
                }),
              )
              return
            }
            observer.next({
              context: res.meta,
              result: transformed.result,
            })
            observer.complete()
          })
          .catch((cause) => {
            observer.error(TRPCClientError.from(cause, { meta }))
          })

        return () => {
          // noop
        }
      })
    }
  }
}
