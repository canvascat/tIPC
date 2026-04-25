import type { IpcRenderer } from "electron";
import { filter, fromEvent } from "rxjs";
import { channel } from "./const";
import { createFlatProxy, createRecursiveProxy } from "./create-proxy";
import type {
	AllTIPCInvoke,
	AllTIPCMessage,
	TIPCFunctions,
	TIPCSerializedError,
	TIPCSubscribeOptions,
	TIPCSubscriptionMessage,
} from "./type";
import type { FunctionType } from "./main/procedure";

export function createTIPCClient<RemoteFunctions>(
	ipcRenderer: Pick<
		IpcRenderer,
		"addListener" | "removeListener" | "send" | "invoke"
	>,
) {
	function deserializeError(error: TIPCSerializedError) {
		const result = new Error(error.message);
		result.name = error.name || "Error";
		result.stack = error.stack;
		return result;
	}

	const observable = fromEvent<TIPCSubscriptionMessage>(
		ipcRenderer,
		channel.message,
		(_event, message) => message,
	);

	const postMessage = (message: AllTIPCMessage) =>
		ipcRenderer.send(channel.message, message);

	const invoke = (path: string[], ...args: any[]) =>
		ipcRenderer.invoke(channel.invoke, {
			payload: "invoke",
			args: [path, args],
		} satisfies AllTIPCInvoke);
	const sendMessage = (path: string[], ...args: any[]) =>
		postMessage({ payload: "send", args: [path, args] });
	const getValue = (path: string[]) =>
		ipcRenderer.invoke(channel.invoke, {
			payload: "get",
			args: [path],
		} satisfies AllTIPCInvoke);

	const subscribe = (
		path: string[],
		args: unknown[],
		listener: (data: any) => void,
		options?: TIPCSubscribeOptions,
	) => {
		const subscribeId = crypto.randomUUID().replaceAll("-", "");
		const sub = observable
			.pipe(filter((msg) => msg.args[0] === subscribeId))
			.subscribe((msg) => {
				switch (msg.payload) {
					case "subscription":
						listener(msg.args[1]);
						break;
					case "subscriptionError":
						options?.onError?.(deserializeError(msg.args[1]));
						sub.unsubscribe();
						break;
					case "subscriptionComplete":
						options?.onComplete?.();
						sub.unsubscribe();
						break;
				}
			});

		postMessage({ payload: "subscribe", args: [path, subscribeId, args] });

		return () => {
			sub.unsubscribe();
			postMessage({ payload: "unsubscribe", args: [subscribeId] });
		};
	};

	const createCall = (method: FunctionType, path: string[]) => {
		switch (method) {
			case "emit":
				return (...args: any[]) => sendMessage(path, ...args);
			case "invoke":
				return (...args: any[]) => invoke(path, ...args);
			case "subscribe":
				return (...args: any[]) => {
					const lastArg = args.at(-1);
					const hasOptions = typeof lastArg !== "function";
					const listener = hasOptions ? args.at(-2) : lastArg;
					const subscriptionArgs = hasOptions
						? args.slice(0, -2)
						: args.slice(0, -1);
					if (typeof listener !== "function") {
						throw new TypeError("TIPC subscription requires a listener");
					}
					return subscribe(
						path,
						subscriptionArgs,
						listener,
						hasOptions ? lastArg : undefined,
					);
				};
			case "get":
				return () => getValue(path);
			default:
				throw new Error(`Unknown method: ${method}`);
		}
	};

	const proxy = createRecursiveProxy<TIPCFunctions<RemoteFunctions>>(
		({ path, args }) => {
			const pathCopy = [...path];
			const method = pathCopy.pop() as FunctionType;

			return createCall(method, pathCopy)(...args);
		},
	);

	const tipc = createFlatProxy<TIPCFunctions<RemoteFunctions>>(
		(path) => proxy[path],
	);

	return tipc;
}
