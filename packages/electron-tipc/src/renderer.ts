import type { IpcRenderer } from 'electron'
import { filter, fromEvent, map } from 'rxjs'
import { channel } from './const'
import { createFlatProxy, createRecursiveProxy } from './create-proxy'
import type { AllTIPCInvoke, AllTIPCMessage, ProcedureType, TIPCFunctions, TIPCMessage } from './type'

export function createTIPCClient<RemoteFunctions>(ipcRenderer: Pick<IpcRenderer, 'addListener' | 'removeListener' | 'send' | 'invoke'>) {
  const observable = fromEvent<TIPCMessage<'subscription'>>(ipcRenderer, channel.message, (_event, message) => message)
    .pipe(filter(msg => msg.payload === 'subscription'), map(({ args: [subscribeId, data] }) => ({ subscribeId, data })))

  const postMessage = (message: AllTIPCMessage) => ipcRenderer.send(channel.message, message)

  const invoke = (path: string[], ...args: any[]) => ipcRenderer.invoke(channel.invoke, { payload: 'invoke', args: [path, args] } satisfies AllTIPCInvoke)
  const sendMessage = (path: string[], ...args: any[]) => postMessage({ payload: 'send', args: [path, args] } )

  const subscribe = (path: string[], listener: (data: any) => void) => {
    const subscribeId = crypto.randomUUID().replaceAll('-', '')
    postMessage({ payload: 'subscribe', args: [path, subscribeId] } )
    const sub = observable.pipe(filter(msg => msg.subscribeId === subscribeId), map(msg => msg.data)).subscribe(listener)

    return () => {
      sub.unsubscribe()
      postMessage({ payload: 'unsubscribe', args: [subscribeId] } )
    }
  }

  const createCall = (method: ProcedureType, path: string[]) => {
    switch (method) {
      case 'emit': return (...args: any[]) =>  sendMessage(path, ...args)
      case 'invoke': return (...args: any[]) => invoke(path, ...args)
      case 'subscribe':  return (...args: any[]) => subscribe(path, args[0])
      default: throw new Error(`Unknown method: ${method}`)
    }
  }

  const proxy = createRecursiveProxy<TIPCFunctions<RemoteFunctions>>(
    ({ path, args }) => {
      const pathCopy = [...path]
      const method = pathCopy.pop() as ProcedureType

      return createCall(method, pathCopy)(...args)
    },
  )

  const tipc = createFlatProxy<TIPCFunctions<RemoteFunctions>>((path) => proxy[path])

  return tipc
}
