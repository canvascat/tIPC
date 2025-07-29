import * as procedure from "./procedure";
import type { CreateContextOptions as DefaultContext } from "./context";

function create<Context>() {
	return { procedure: procedure.create<Context>() };
}

/**
 * @example
 * const t =initTIPC.create()
 * const t = initTIPC.context<ReturnType<typeof createContext>>().create()
 */
export const initTIPC = {
	context: <Context>() => ({ create: () => create<Context>() }),
	create: () => create<DefaultContext>(),
};

export { createTIPCServer } from "./server";
export type { CreateContextOptions } from "./context";
