import { procedure } from "../trpc";
import { nativeTheme } from "electron";

export const shouldUseDarkColors = procedure.value(
	() => nativeTheme.shouldUseDarkColors,
);

export const themeSource = procedure.value(() => nativeTheme.themeSource);
