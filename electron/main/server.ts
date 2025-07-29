import { createTIPCServer } from "tipc-electron/main";
import * as functions from "./router";

export const setupTIPCServer = () => {
	const dispose = createTIPCServer({ functions });

	return dispose;
};
