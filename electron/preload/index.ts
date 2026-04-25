import { ipcRenderer, contextBridge } from "electron";

export type ExposeIpcRenderer = Pick<
	Electron.IpcRenderer,
	"invoke" | "send" | "addListener" | "removeListener"
>;

const exposeIpcRenderer: ExposeIpcRenderer = {
	invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
	send: (channel, ...args) => ipcRenderer.send(channel, ...args),
	addListener: (channel, listener) =>
		ipcRenderer.addListener(channel, listener),
	removeListener: (channel, listener) =>
		ipcRenderer.removeListener(channel, listener),
};

contextBridge.exposeInMainWorld("ipcRenderer", exposeIpcRenderer);
