import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = resolve(__dirname, 'playground');

export default defineConfig({
  root,
  publicDir: resolve(__dirname, 'public'),
  server: {
    port: 5210,
    strictPort: true,
  },
  preview: {
    port: 5210,
  },
  build: {
    outDir: resolve(__dirname, 'dist-playground'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        surge: resolve(root, 'surge.html'),
        andar: resolve(root, 'andar.html'),
        helix: resolve(root, 'helix.html'),
        lattice: resolve(root, 'lattice.html'),
        cipher: resolve(root, 'cipher.html'),
        sheep: resolve(root, 'sheep.html'),
      },
    },
  },
});
