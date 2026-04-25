import { rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-oxc";
import { defineConfig } from "vite-plus";
import electron from "vite-plugin-electron";
import pkg from "./package.json" with { type: "json" };

const root = path.dirname(fileURLToPath(import.meta.url));

/** 与 `defineConfig(({ command }) => …)` 中的 command 对齐；静态导出供 vp fmt / lint 解析。 */
const command = process.argv.includes("build") ? "build" : "serve";
const isServe = command === "serve";
const isBuild = command === "build";
const sourcemap = isServe || !!process.env.VSCODE_DEBUG;

/** 主进程/预加载打包：dependencies + 作为 devDependency 的 workspace 运行时包。 */
const electronExternals = [
	...Object.keys(
		"dependencies" in pkg && pkg.dependencies ? pkg.dependencies : {},
	),
	"tipc-electron",
	"tipc-electron/main",
	"tipc-electron/renderer",
];

// 仅在 dev/build/preview 时清理，避免 `vp fmt` / `vp check` 等加载配置时误删产物。
const shouldCleanElectronOut =
	(process.argv.includes("dev") ||
		process.argv.includes("build") ||
		process.argv.includes("preview")) &&
	!process.argv.includes("check") &&
	!process.argv.includes("fmt");
if (shouldCleanElectronOut) {
	rmSync("dist-electron", { recursive: true, force: true });
}

// https://vitejs.dev/config/
export default defineConfig({
	lint: {
		plugins: ["react", "typescript", "unicorn", "import", "promise"],
		rules: {
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					destructuredArrayIgnorePattern: "^_",
				},
			],
			"no-console": [
				"warn",
				{
					allow: ["debug", "error", "warn"],
				},
			],
			"unicorn/prefer-node-protocol": "error",
			"unicorn/prefer-module": "error",
			"unicorn/prefer-top-level-await": "warn",
			"unicorn/no-array-for-each": "warn",
			"unicorn/no-null": "off",
			"import/no-duplicates": "error",
			"promise/always-return": "off",
			"promise/no-return-wrap": "error",
			"promise/param-names": "off",
			"promise/catch-or-return": "off",
			"promise/no-nesting": "warn",
			"promise/no-promise-in-callback": "warn",
			"promise/no-callback-in-promise": "warn",
		},
		env: {
			browser: true,
			node: true,
			es2022: true,
		},
		settings: {
			react: {
				version: "19.1.0",
			},
		},
		ignorePatterns: [
			"dist/**",
			"dist-electron/**",
			"node_modules/**",
			"coverage/**",
		],
		overrides: [
			{
				files: ["**/electron/**/*.ts", "**/electron/**/*.js"],
				env: {
					node: true,
					browser: false,
				},
				rules: {
					"no-console": "off",
				},
			},
			{
				files: ["**/*.config.*", "**/vite.config.*", "**/tsdown.config.*"],
				rules: {
					"no-console": "off",
					"@typescript-eslint/no-unused-vars": "off",
				},
			},
			{
				files: ["packages/electron-tipc/**/*.ts"],
				rules: {
					"no-console": "off",
				},
			},
		],
	},
	fmt: {
		useTabs: true,
		printWidth: 80,
		sortPackageJson: false,
		ignorePatterns: [
			"dist-electron",
			"dist",
			"node_modules",
			".vscode",
			".git",
			".gitignore",
			".pnpm-lock.yaml",
		],
	},
	resolve: {
		alias: {
			"@": path.join(root, "src"),
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
						console.debug(
							/* For `.vscode/.debug.script.mjs` */ "[startup] Electron App",
						);
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
							external: electronExternals,
							platform: "node",
						},
					},
				},
			},
			{
				onstart(args) {
					args.reload();
				},

				vite: {
					build: {
						sourcemap: sourcemap ? "inline" : undefined, // #332
						minify: isBuild,
						outDir: "dist-electron/preload",
						rollupOptions: {
							external: electronExternals,
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
});
