import { type IpcMain } from "electron";
import { channel } from "./const";
import { SubscriptionManager } from "./subscription";
import type { ProcedureAny, ProcedureRecord, TIPCMessage } from "./type";


function flattenProcedureRecord(record: ProcedureRecord) {
  function flatten(record: ProcedureRecord | ProcedureAny, prefix: string): Record<string, ProcedureAny & { path: string }> {
    if (typeof record === 'function') return { [prefix]: Object.assign(record, { path: prefix }) }
    const entries = Object.entries(record).map(([key, value]) => flatten(value, prefix ? `${prefix}.${key}` : key))
    return Object.assign({}, ...entries)
  }
  return flatten(record, '')
}

export const createTIPCServer = (record: ProcedureRecord, ipcMain: IpcMain) => {
  const flattened = flattenProcedureRecord(record)

  function handleInvoke(_event: Electron.IpcMainInvokeEvent, message: TIPCMessage) {
    const { type, path, args } = message
    const procedureFn = flattened[path]
    if (!procedureFn) throw new Error(`Procedure ${type} ${path} not found`)
    return procedureFn(...args)
  }
  function handleSend(_event: Electron.IpcMainEvent, message: TIPCMessage) {
    const { type, path, args } = message
    const procedureFn = flattened[path]
    if (!procedureFn) throw new Error(`Procedure ${type} ${path} not found`)
    procedureFn(...args)
  }

  const subscriptionManager = new SubscriptionManager(Object.fromEntries(Object.values(flattened).filter(item => item.type === 'subscription').map(item => [item.path, item])))

  ipcMain.handle(channel.invoke, handleInvoke)
  ipcMain.on(channel.send, handleSend)
  ipcMain.on(channel.subscription, subscriptionManager.onSubscription.bind(subscriptionManager))
  ipcMain.on(channel.unsubscribe, subscriptionManager.onUnsubscribe.bind(subscriptionManager))

  // fromEvent(ipcMain, channel.send, (event: Electron.IpcMainEvent, ...args) => ({ event, args}))
  // fromEvent(ipcMain, channel.subscription, (event: Electron.IpcMainEvent, ...args) => ({ event, args}))
  // fromEvent(ipcMain, channel.unsubscribe, (event: Electron.IpcMainEvent, ...args) => ({ event, args}))
  return () => {
    ipcMain.removeHandler(channel.invoke)
    ipcMain.off(channel.send, handleSend)
    ipcMain.off(channel.subscription, subscriptionManager.onSubscription.bind(subscriptionManager))
    ipcMain.off(channel.unsubscribe, subscriptionManager.onUnsubscribe.bind(subscriptionManager))
  }
}

export * as procedure from './procedure';
