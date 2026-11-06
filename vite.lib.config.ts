import { build, defineConfig, type InlineConfig } from 'vite';

const entry = 'src/index.ts';

// Second build: one self-contained file with a `Inkmark` global.
const iife: InlineConfig = {
  configFile: false,
  logLevel: 'warn',
  build: {
    emptyOutDir: false,
    lib: { entry, formats: ['iife'], name: 'Inkmark', fileName: () => 'inkmark.iife.js' },
  },
};

// Third build: the CLI as plain JavaScript for Node. Node does not run .ts files inside node_modules.
// Packages stay external; they come from the user's node_modules.
const cli: InlineConfig = {
  configFile: false,
  logLevel: 'warn',
  build: {
    ssr: 'cli/index.ts',
    outDir: 'dist',
    emptyOutDir: false,
    target: 'node22',
    rolldownOptions: { output: { entryFileNames: 'cli.js', banner: '#!/usr/bin/env node' } },
  },
};

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: { entry, formats: ['es'], fileName: () => 'inkmark.js' },
    rolldownOptions: { external: [/^animejs/, /^roughjs/, /^perfect-freehand/] },
  },
  plugins: [
    {
      name: 'inkmark-iife',
      apply: 'build',
      async closeBundle() {
        await build(iife);
        await build(cli);
      },
    },
  ],
});
