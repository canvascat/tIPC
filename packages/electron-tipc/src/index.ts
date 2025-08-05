import pkg from "../package.json" with { type: "json" };

export const version = pkg.version;

console.info("tipc-electron version: ", version);
console.warn("please use tipc-electron/main at main process");
console.warn("please use tipc-electron/renderer at renderer process");
