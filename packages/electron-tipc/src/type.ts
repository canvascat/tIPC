export type PromisifyFn<T extends AnyFunction> =
  ReturnType<T> extends Promise<any>
    ? T
    : (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>;

export type RPCFn<
  T extends AnyFunction,
  M extends "invoke" | "send"
> = M extends "invoke" ? PromisifyFn<T> : (...args: Parameters<T>) => void;

export type AnyFunction = (...args: any[]) => any;

import { Observable } from "rxjs";
import type * as procedure from "./procedure";

export type Procedure = typeof procedure;

export type ProcedureAny<T extends keyof Procedure = keyof Procedure> =
  ReturnType<Procedure[T]>;

export type ProcedureType = ProcedureAny["type"];

export type ProcedureRecord = {
  [key: string]: ProcedureAny | ProcedureRecord;
};

export interface TIPCEventMap {
  message: unknown[];
  send: [path: string[], args: unknown[]];
  invoke: [path: string[], args: unknown[]];
  subscribe: [path: string[], subscribeId: string];
  unsubscribe: [subscribeId: string];
  subscription: [subscribeId: string, data: unknown];
}

export interface TIPCMessage<
  K extends keyof TIPCEventMap = keyof TIPCEventMap
> {
  payload: K;
  args: TIPCEventMap[K];
}

export type AllTIPCInvoke = TIPCMessage<"invoke">;

type WithEvent<T> = T & {
  event: Electron.IpcMainEvent & Electron.IpcMainInvokeEvent;
};

export type AllTIPCMessage =
  | TIPCMessage<"message">
  | TIPCMessage<"unsubscribe">
  | TIPCMessage<"send">
  | TIPCMessage<"subscribe">;
export type AllTIPCMessageWithEvent =
  | WithEvent<TIPCMessage<"message">>
  | WithEvent<TIPCMessage<"unsubscribe">>
  | WithEvent<TIPCMessage<"send">>
  | WithEvent<TIPCMessage<"subscribe">>;

type ObservableValue<T> = T extends Observable<infer K> ? K : never;

type Subscribe<T> = (listener: (value: T) => void) =>  () => void

export type TIPCFunctions<T> = T extends ProcedureAny<"subscription">
  ? Readonly<{ subscribe: Subscribe<ObservableValue<ReturnType<T>>> }>
  : T extends ProcedureAny<"on">
    ? Readonly<{ emit: (...args: Parameters<T>) => void }>
    : T extends ProcedureAny<"handle">
      ? Readonly<{ invoke: (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> }>
      : Readonly<{ [K in keyof T]: TIPCFunctions<T[K]> }>;
