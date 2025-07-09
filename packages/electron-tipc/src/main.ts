import { webContents, ipcMain, app } from "electron";
import { channel } from "./const";
import type { ProcedureAny, ProcedureRecord, AllTIPCInvoke, AllTIPCMessageWithEvent, TIPCMessage } from "./type";
import { filter, fromEvent, map, Subscription } from "rxjs";

function findProcedure(record: ProcedureRecord | ProcedureAny, path: string[]) {
  const pathCopy = [...path]
  while (record && pathCopy.length && typeof record !== 'function') {
    record = record[pathCopy.shift()!]!
  }
  if (record && typeof record === 'function' && pathCopy.length === 0) return record
  throw new Error(`Procedure ${path.join('.')} not found`)
}
 
export const createTIPCServer = (record: ProcedureRecord) => {
  async function handleInvoke(_event: Electron.IpcMainInvokeEvent, path: string[], args: any[]) {
    try {
      const procedureFn = findProcedure(record, path)
      if (procedureFn.type !== 'invoke') {
        throw new Error(`Procedure "${path.join('.')}" is not invokable`)
      }
      return await procedureFn(...args)
    } catch (error) {
      console.error(`TIPC invoke error [${path.join('.')}]:`, error)
      throw error
    }
  }

  /** subscribeId -> { subscribe: Subscription, senderId: number } */
  const subscriptions = new Map<string, { subscribe: Subscription, senderId: number }>()

  function handleSubscribe({ path, subscribeId, senderId }: { path: string[], subscribeId: string, senderId: number }) {
    const procedureFn = findProcedure(record, path)
    if (procedureFn.type !== 'subscribe') throw new Error(`Procedure subscription ${path} not found`)
    const observable = procedureFn()
    const subscribe = observable.subscribe(data => {
      const target = webContents.fromId(senderId)
      if (target) {
        target.send(channel.message, { payload: 'subscription', args: [subscribeId, data] } satisfies TIPCMessage<'subscription'>)
      } else {
        unsubscribe(subscribeId)
      }
    })
    subscriptions.set(subscribeId, { subscribe, senderId })
    return subscribeId;
  }

  function unsubscribe(subscribeId: string) {
    const subscription = subscriptions.get(subscribeId)
    if (subscription) {
      subscription.subscribe.unsubscribe()
      subscriptions.delete(subscribeId)
    }
  }

  const messageObservable = fromEvent<AllTIPCMessageWithEvent>(ipcMain, channel.message, (event, payload, ...args: any) => ({ event, payload, args }))
  const messageSubscription = messageObservable.pipe(filter(msg => msg.payload === 'unsubscribe'), map(msg => msg.args[0])).subscribe(unsubscribe)
  messageSubscription.add(messageObservable.pipe(filter(msg => msg.payload === 'send'), map(msg => msg.args)).subscribe(([path, args]) => {
    const procedureFn = findProcedure(record, path)
    if (procedureFn.type !== 'emit') throw new Error(`Procedure send ${path} not found`)
    procedureFn(...args)
  }))
  messageSubscription.add(messageObservable.pipe(filter(msg => msg.payload === 'subscribe'), map(msg => {
    const [path, subscribeId] = msg.args
    const senderId = msg.event.sender.id
    return { path, subscribeId, senderId }
  })).subscribe(handleSubscribe))

  ipcMain.handle(channel.invoke, (event, message: AllTIPCInvoke) => {
    switch (message.payload) {
      case 'invoke':
        return handleInvoke(event, ...message.args)
      default:
        throw new Error(`Unknown payload ${message}`)
    }
  })

  function handleRendererClosed(_event: Electron.Event, webContents: Electron.WebContents) {
    const senderId = webContents.id
 
    for (const [subscribeId, subscription] of subscriptions) {
      if (subscription.senderId !== senderId) continue
      subscription.subscribe.unsubscribe()
      subscriptions.delete(subscribeId)
    }
  }

  app.on('render-process-gone', handleRendererClosed)

  return () => {
    ipcMain.removeHandler(channel.invoke)
    messageSubscription.unsubscribe()
    app.off('render-process-gone', handleRendererClosed)
  }
}

export * as procedure from './procedure';
