/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
	useTabs: true,
	overrides: [
		{
			files: ["**/*.{ts,mts,cts,tsx}"],
			options: {
				plugins: ["@prettier/plugin-oxc"],
				parser: "oxc-ts",
			},
		},
	],
};

export default config;
