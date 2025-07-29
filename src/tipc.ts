import { createTIPCClient } from "tipc-electron/renderer";
import type * as functions from "@main/router";

const tipc = createTIPCClient<typeof functions>(window.ipcRenderer);

export default tipc;
