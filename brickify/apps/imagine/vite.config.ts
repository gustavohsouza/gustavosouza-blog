import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@brickify/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@brickify/brick3d': fileURLToPath(new URL('../../packages/brick3d/src/index.ts', import.meta.url)),
    },
  },
  base: './',
});
