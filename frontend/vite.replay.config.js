import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    outDir: '../site/replay-ui',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, 'replay.html'),
    },
  },
});
