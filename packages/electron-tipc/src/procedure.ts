import type { Observable } from "rxjs";
import type { AnyFunction } from "./type";

export function invoke<T extends AnyFunction>(listener: T) {
  const _listener = async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => listener(...args);
  _listener.type = 'invoke' as const;
  return _listener;
}

export function send<T extends AnyFunction>(listener: T) {
  const _listener = (...args: Parameters<T>): void => {
    listener(...args);
  }
  _listener.type = 'send' as const;
  return _listener;
}

export function subscription<T>(listener: () => Observable<T>) {
  const _listener = () => listener()
  _listener.type = 'subscription' as const;
  return _listener;
}