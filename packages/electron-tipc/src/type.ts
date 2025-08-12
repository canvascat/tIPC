import type { Observable } from "rxjs";
import type { AnyFunction } from "./main/server";
export interface TIPCEventMap {
	message: unknown[];
	send: [path: string[], args: unknown[]];
	get: [path: string[]];
	invoke: [path: string[], args: unknown[]];
	subscribe: [path: string[], subscribeId: string];
	unsubscribe: [subscribeId: string];
	subscription: [subscribeId: string, data: unknown];
}

export interface TIPCMessage<
	K extends keyof TIPCEventMap = keyof TIPCEventMap,
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
	| TIPCMessage<"get">
	| TIPCMessage<"subscribe">;
export type AllTIPCMessageWithEvent =
	| WithEvent<TIPCMessage<"message">>
	| WithEvent<TIPCMessage<"unsubscribe">>
	| WithEvent<TIPCMessage<"send">>
	| WithEvent<TIPCMessage<"get">>
	| WithEvent<TIPCMessage<"subscribe">>;

type ObservableValue<T> = T extends Observable<infer K> ? K : never;

type Subscribe<T> = (listener: (value: T) => void) => () => void;

export type TIPCFunctions<T> =
	T extends AnyFunction<any, "subscription">
		? Readonly<{ subscribe: Subscribe<ObservableValue<ReturnType<T>>> }>
		: T extends AnyFunction<any, "on">
			? Readonly<{ emit: (...args: Parameters<T>) => void }>
			: T extends AnyFunction<any, "handle">
				? Readonly<{
						invoke: (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>;
					}>
				: T extends AnyFunction<any, "value">
					? Readonly<{ get: () => ReturnType<T> }>
					: Readonly<{ [K in keyof T]: TIPCFunctions<T[K]> }>;
