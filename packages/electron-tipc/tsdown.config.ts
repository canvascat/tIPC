import { defineConfig } from 'tsdown';
import pkg from './package.json';

export default defineConfig({
  target: ['node16'],
  entry: [
    'src/main.ts',
    'src/preload.ts',
    'src/renderer.ts',
  ],
  dts: {
    sourcemap: true,
    tsconfig: './tsconfig.build.json',
  },
  format: ['cjs', 'esm'],
  outExtensions: (ctx) => ({
    dts: ctx.format === 'cjs' ? '.d.cts' : '.d.mts',
    js: ctx.format === 'cjs' ? '.cjs' : '.mjs',
  }),
  external: Object.keys(pkg.peerDependencies || {})
});