import type { IpcRenderer } from "electron";
import { filter, fromEvent, map } from "rxjs";
import { channel } from "./const";
import { createFlatProxy, createRecursiveProxy } from "./create-proxy";
import type {
	AllTIPCInvoke,
	AllTIPCMessage,
	TIPCFunctions,
	TIPCMessage,
} from "./type";
import type { FunctionType } from "./main/procedure";

export function createTIPCClient<RemoteFunctions>(
	ipcRenderer: Pick<
		IpcRenderer,
		"addListener" | "removeListener" | "send" | "invoke" | "sendSync"
	>,
) {
	const observable = fromEvent<TIPCMessage<"subscription">>(
		ipcRenderer,
		channel.message,
		(_event, message) => message,
	).pipe(
		filter((msg) => msg.payload === "subscription"),
		map(({ args: [subscribeId, data] }) => ({ subscribeId, data })),
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
		ipcRenderer.sendSync(channel.get, {
			payload: "get",
			args: [path],
		} satisfies TIPCMessage<"get">);

	const subscribe = (path: string[], listener: (data: any) => void) => {
		const subscribeId = crypto.randomUUID().replaceAll("-", "");
		postMessage({ payload: "subscribe", args: [path, subscribeId] });
		const sub = observable
			.pipe(
				filter((msg) => msg.subscribeId === subscribeId),
				map((msg) => msg.data),
			)
			.subscribe(listener);

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
				return (...args: any[]) => subscribe(path, args[0]);
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
