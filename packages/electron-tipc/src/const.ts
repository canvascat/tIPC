import { ProcedureType } from "./type";

export const channel = {
  invoke: 'ipc:invoke',
  send: 'ipc:send',

  subscription: 'ipc:subscription',
  unsubscribe: 'ipc:unsubscribe',
  message: 'ipc:message',
} as const satisfies Record<ProcedureType | 'unsubscribe' | 'message', string>;