import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Playground: test pages for the library. `npm run dev`, then open /sandbox.html (player) or /sandbox-live.html (live mode).
// The pages import `../src`, so the repo root must be allowed.
export default defineConfig({
  root: 'playground',
  server: { port: 5174, fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] } },
});
