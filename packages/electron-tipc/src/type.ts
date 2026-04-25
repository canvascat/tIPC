import type { Observable } from "rxjs";
import type { AnyFunction } from "./main/server";
export interface TIPCEventMap {
	message: unknown[];
	send: [path: string[], args: unknown[]];
	get: [path: string[]];
	invoke: [path: string[], args: unknown[]];
	subscribe: [path: string[], subscribeId: string, args: unknown[]];
	unsubscribe: [subscribeId: string];
	subscription: [subscribeId: string, data: unknown];
	subscriptionError: [subscribeId: string, error: TIPCSerializedError];
	subscriptionComplete: [subscribeId: string];
}

export interface TIPCSerializedError {
	message: string;
	name?: string;
	stack?: string;
	cause?: unknown;
}

export interface TIPCSubscribeOptions {
	onError?: (error: Error) => void;
	onComplete?: () => void;
}

export interface TIPCMessage<
	K extends keyof TIPCEventMap = keyof TIPCEventMap,
> {
	payload: K;
	args: TIPCEventMap[K];
}

export type AllTIPCInvoke = TIPCMessage<"get"> | TIPCMessage<"invoke">;

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

export type TIPCSubscriptionMessage =
	| TIPCMessage<"subscription">
	| TIPCMessage<"subscriptionError">
	| TIPCMessage<"subscriptionComplete">;

type ObservableValue<T> = T extends Observable<infer K> ? K : never;

type Subscribe<T, Args extends readonly unknown[]> = (
	...args: [
		...Args,
		listener: (value: T) => void,
		options?: TIPCSubscribeOptions,
	]
) => () => void;

export type TIPCFunctions<T> =
	T extends AnyFunction<any, "subscription">
		? Readonly<{
				subscribe: Subscribe<ObservableValue<ReturnType<T>>, Parameters<T>>;
			}>
		: T extends AnyFunction<any, "on">
			? Readonly<{ emit: (...args: Parameters<T>) => void }>
			: T extends AnyFunction<any, "handle">
				? Readonly<{
						invoke: (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>;
					}>
				: T extends AnyFunction<any, "value">
					? Readonly<{ get: () => Promise<ReturnType<T>> }>
					: Readonly<{ [K in keyof T]: TIPCFunctions<T[K]> }>;
