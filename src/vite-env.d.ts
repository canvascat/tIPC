/// <reference types="vite-plus/client" />

interface Window {
	// expose in the `electron/preload/index.ts`
	ipcRenderer: import("../electron/preload/index").ExposeIpcRenderer;
}
