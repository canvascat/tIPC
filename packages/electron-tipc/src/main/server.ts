import { webContents, ipcMain, app } from "electron";
import { channel } from "../const";
import type { AllTIPCInvoke, AllTIPCMessage, AllTIPCMessageWithEvent, TIPCMessage } from "../type";
import { filter, fromEvent, map, Subscription } from "rxjs";
import * as procedure from "./procedure";
import {
	CreateContextOptions,
	createContext as defaultCreateContext,
	type CreateContextOptions as DefaultContext,
} from "./context";

export type ProcedureResult<Context> = ReturnType<typeof procedure.create<Context>>;

export type AnyFunction<
	Context = any,
	T extends keyof ProcedureResult<Context> = keyof ProcedureResult<Context>,
> = ReturnType<ProcedureResult<Context>[T]>;

type Functions<Context> = {
	[key: string]: AnyFunction<Context> | Functions<Context>;
};

function getFunction<Context>(fn: Functions<Context> | AnyFunction<Context>, path: string[]) {
	const pathCopy = [...path];
	while (fn && pathCopy.length && typeof fn !== "function") {
		fn = fn[pathCopy.shift()!]!;
	}
	if (fn && typeof fn === "function" && pathCopy.length === 0) return fn;
	return null;
}

interface Options<Context> {
	functions: Functions<Context>;
	createContext?: (options: CreateContextOptions) => Context;
}

export const createTIPCServer = <Context = DefaultContext>(options: Options<Context>) => {
	const { functions } = options;
	const createContext =
		options.createContext || (defaultCreateContext as (options: CreateContextOptions) => Context);

	async function handleInvoke(event: Electron.IpcMainInvokeEvent, path: string[], args: any[]) {
		try {
			const fn = getFunction(functions, path);
			if (!fn || fn.type !== "invoke") {
				throw new Error(`Procedure "${path.join(".")}" is not invokable`);
			}
			const senderId = event.sender.id;
			const context = createContext({ senderId, type: fn.type, path, args });
			return await fn.apply(context, args);
		} catch (error) {
			console.error(`TIPC invoke error [${path.join(".")}]:`, error);
			throw error;
		}
	}

	/** subscribeId -> { subscribe: Subscription, senderId: number } */
	const subscriptions = new Map<string, { subscribe: Subscription; senderId: number }>();

	function unsubscribe(subscribeId: string) {
		const subscription = subscriptions.get(subscribeId);
		if (subscription) {
			subscription.subscribe.unsubscribe();
			subscriptions.delete(subscribeId);
		}
	}

	const messageObservable = fromEvent<AllTIPCMessageWithEvent>(
		ipcMain,
		channel.message,
		(event, msg: AllTIPCMessage) => ({ event, ...msg }),
	);
	const messageSubscription = messageObservable
		.pipe(filter((msg) => msg.payload === "send"))
		.subscribe((msg) => {
			const [path, args] = msg.args;
			const fn = getFunction(functions, path);
			if (!fn || fn.type !== "emit") throw new Error(`Procedure send ${path} not found`);
			const senderId = msg.event.sender.id;
			const context = createContext({ senderId, type: fn.type, path, args });
			fn.apply(context, args);
		});
	messageSubscription.add(
		messageObservable
			.pipe(
				filter((msg) => msg.payload === "unsubscribe"),
				map((msg) => msg.args[0]),
			)
			.subscribe(unsubscribe),
	);
	messageSubscription.add(
		messageObservable.pipe(filter((msg) => msg.payload === "subscribe")).subscribe((msg) => {
			const [path, subscribeId] = msg.args;
			const senderId = msg.event.sender.id;
			const fn = getFunction(functions, path);
			if (!fn || fn.type !== "subscribe")
				throw new Error(`Procedure subscription ${path} not found`);
			const context = createContext({
				senderId,
				type: fn.type,
				path,
				args: [],
			});
			const observable = fn.apply(context, []);

			const subscribe = observable.subscribe((data) => {
				const target = webContents.fromId(senderId);
				if (target) {
					target.send(channel.message, {
						payload: "subscription",
						args: [subscribeId, data],
					} satisfies TIPCMessage<"subscription">);
				} else {
					unsubscribe(subscribeId);
				}
			});
			subscriptions.set(subscribeId, { subscribe, senderId });
		}),
	);

	ipcMain.handle(channel.invoke, (event, message: AllTIPCInvoke) => {
		switch (message.payload) {
			case "invoke":
				return handleInvoke(event, ...message.args);
			default:
				throw new Error(`Unknown payload ${message}`);
		}
	});

	function handleRendererClosed(_event: Electron.Event, webContents: Electron.WebContents) {
		const senderId = webContents.id;

		for (const [subscribeId, subscription] of subscriptions) {
			if (subscription.senderId !== senderId) continue;
			subscription.subscribe.unsubscribe();
			subscriptions.delete(subscribeId);
		}
	}

	app.on("render-process-gone", handleRendererClosed);

	return () => {
		ipcMain.removeHandler(channel.invoke);
		messageSubscription.unsubscribe();
		app.off("render-process-gone", handleRendererClosed);
	};
};
