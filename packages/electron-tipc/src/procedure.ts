import type { Observable } from "rxjs";
import type { AnyFunction } from "./type";

export function handle<T extends AnyFunction>(listener: T) {
  const _listener = async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => listener(...args);
  _listener.type = 'invoke' as const;
  return _listener;
}

export function on<T extends AnyFunction>(listener: T) {
  const _listener = (...args: Parameters<T>): void => {
    listener(...args);
  }
  _listener.type = 'emit' as const;
  return _listener;
}
// subscribe
export function subscription<T>(listener: () => Observable<T>) {
  const _listener = () => listener()
  _listener.type = 'subscribe' as const;
  return _listener;
}
