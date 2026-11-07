import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'EdgeCasino',
      formats: ['es'],
      fileName: 'edge-casino',
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: 'edge-casino.[ext]',
      },
    },
  },
  plugins: [
    dts({
      include: ['src'],
      rollupTypes: true,
    }),
  ],
});
