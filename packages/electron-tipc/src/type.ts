export type PromisifyFn<T extends AnyFunction> = ReturnType<T> extends Promise<any>
  ? T
  : (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>

export type RPCFn<T extends AnyFunction, M extends 'invoke' | 'send'> = M extends 'invoke' ? PromisifyFn<T> : (...args: Parameters<T>) => void

export type AnyFunction = (...args: any[]) => any;

import { Observable } from 'rxjs';
import type * as procedure from './procedure';

export type Procedure = typeof procedure

export type ProcedureAny<T extends keyof Procedure = keyof Procedure> = ReturnType<Procedure[T]>

export type ProcedureType = ProcedureAny['type']
 
export type ProcedureRecord = {
  [key: string]: ProcedureAny | ProcedureRecord
}

export type TIPCMessage = {
  type: ProcedureType
  id: string
  path: string
  args: any[]
}
 
export type TIPCFunctions<T> = T extends ProcedureAny<'subscription'> 
  ? ReturnType<T> extends Observable<infer K> ? ((subscribe: (value: K) => void) => (() =>void)) : never
  : T extends ProcedureAny<'send'>
    ? (...args: Parameters<T>) => void
    : T extends ProcedureAny<'invoke'>
      ? (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>
    : Readonly<{
    [K in keyof T]: TIPCFunctions<T[K]>
  }>