import { fromEvent, merge } from "rxjs";
import { procedure } from "../trpc";
import { BrowserWindow } from "electron";

export const maximize = procedure.on(function () {
	const senderId = this.senderId;
	console.debug("maximize", senderId);
	BrowserWindow.fromId(senderId)?.maximize();
});

export const unmaximize = procedure.on(function () {
	BrowserWindow.fromId(this.senderId)?.unmaximize();
});

export const event = {
	maximize: procedure.subscription(function () {
		const win = BrowserWindow.fromId(this.senderId);
		if (!win) throw new Error("Window not found");
		return merge(
			fromEvent(win, "maximize", () => true),
			fromEvent(win, "unmaximize", () => false),
		);
	}),
};
