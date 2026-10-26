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
      },
    },
  ],
});
