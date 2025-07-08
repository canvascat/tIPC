import type { IpcRenderer } from 'electron'
import { filter, fromEvent, map } from 'rxjs'
import { channel } from './const'
import { createFlatProxy, createRecursiveProxy } from './create-proxy'
import type { ProcedureType, TIPCFunctions } from './type'

export function createTIPCClient<RemoteFunctions>(ipcRenderer: Pick<IpcRenderer, 'invoke' | 'send' | 'on' | 'off'>) {
  const observable = fromEvent(ipcRenderer, channel.subscription, (_event, message) => message as { type: string, args: any[] })

  const createCall = (method: ProcedureType, path: string[]) => {
    const type = path.join('.')
    switch (method) {
      case 'send':
        return (...args: any[]) => {
          ipcRenderer.send(channel.send, {
            type, args,
          })
        }
      case 'invoke':
        return (...args: any[]) => {
          return ipcRenderer.invoke(channel.invoke, {
            type, args,
          })
        }
      case 'subscription':
        return (...args: any[]) => {
          return observable.pipe(
            filter((data) => data.type === data.type),
            map((data) => data.args)
          ).subscribe(...args).unsubscribe
        }
    }
  }

  const proxy = createRecursiveProxy<TIPCFunctions<RemoteFunctions>>(
    ({ path, args }) => {
      const pathCopy = [...path]
      const method = pathCopy.pop() as ProcedureType

      return createCall(method, pathCopy)(...args)
    },
  )

  const rpc = createFlatProxy<TIPCFunctions<RemoteFunctions>>((method) => {
    if (method === 'then')
      return undefined
    return proxy[method]
  })

  return rpc
}