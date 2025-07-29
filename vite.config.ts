import { rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-oxc";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import pkg from "./package.json" assert { type: "json" };

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
	rmSync("dist-electron", { recursive: true, force: true });

	const isServe = command === "serve";
	const isBuild = command === "build";
	const sourcemap = isServe || !!process.env.VSCODE_DEBUG;
	return {
		resolve: {
			alias: {
				"@": path.join(__dirname, "src"),
			},
		},
		plugins: [
			react(),
			tailwindcss(),
			electron([
				{
					entry: "electron/main/index.ts",
					onstart(args) {
						if (process.env.VSCODE_DEBUG) {
							console.debug(/* For `.vscode/.debug.script.mjs` */ "[startup] Electron App");
						} else {
							args.startup();
						}
					},
					vite: {
						build: {
							sourcemap,
							minify: isBuild,
							outDir: "dist-electron/main",
							rollupOptions: {
								external: Object.keys("dependencies" in pkg ? pkg.dependencies : {}),
								platform: "node",
							},
						},
					},
				},
				{
					onstart(args) {
						// Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
						// instead of restarting the entire Electron App.
						args.reload();
					},

					vite: {
						build: {
							sourcemap: sourcemap ? "inline" : undefined, // #332
							minify: isBuild,
							outDir: "dist-electron/preload",
							rollupOptions: {
								external: Object.keys("dependencies" in pkg ? pkg.dependencies : {}),
								input: "electron/preload/index.ts",
								output: {
									format: "cjs",
									inlineDynamicImports: true,
									entryFileNames: `[name].mjs`,
									chunkFileNames: `[name].mjs`,
									assetFileNames: "[name].[ext]",
								},
							},
						},
					},
				},
			]),
		],
		server: process.env.VSCODE_DEBUG
			? (() => {
					const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL);
					return {
						host: url.hostname,
						port: +url.port,
					};
				})()
			: undefined,
		clearScreen: false,
	};
});
