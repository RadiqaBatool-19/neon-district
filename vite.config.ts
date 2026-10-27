import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No manualChunks: forcing three/r3f into named chunks pulled shared React
// internals (scheduler) into them, which made the landing page download three.js.
// Rollup's default route-based splitting keeps 3D code out of `/`.
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1400,
  },
});
