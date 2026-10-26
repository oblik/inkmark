import { build, defineConfig, type InlineConfig } from 'vite';

const entry = 'src/index.ts';

// Second build: one self-contained file with a `Marginalia` global.
const iife: InlineConfig = {
  configFile: false,
  logLevel: 'warn',
  build: {
    emptyOutDir: false,
    lib: { entry, formats: ['iife'], name: 'Marginalia', fileName: () => 'marginalia.iife.js' },
  },
};

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: { entry, formats: ['es'], fileName: () => 'marginalia.js' },
    rolldownOptions: { external: [/^animejs/, /^roughjs/, /^perfect-freehand/] },
  },
  plugins: [
    {
      name: 'marginalia-iife',
      apply: 'build',
      async closeBundle() {
        await build(iife);
      },
    },
  ],
});
