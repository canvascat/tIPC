import type { FunctionType } from "./procedure";

export interface CreateContextOptions {
	/** IpcMainInvokeEvent.sender.id */
	senderId: number;
	type: FunctionType;
	path: string[];
	args: any[];
}

export function createContext(options: CreateContextOptions) {
	return options;
}
