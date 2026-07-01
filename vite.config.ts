import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync } from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function copyPdfjsWorker() {
  return {
    name: 'copy-pdfjs-worker',
    closeBundle() {
      const outAssets = resolve(__dirname, 'dist/webview/assets');
      mkdirSync(outAssets, { recursive: true });
      copyFileSync(
        resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
        resolve(outAssets, 'pdf.worker.min.mjs'),
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), copyPdfjsWorker()],
  // Webview source lives in src/webview/
  root: resolve(__dirname, 'src/webview'),
  // Use relative paths so VS Code webview URIs resolve correctly
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist/webview'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Predictable filenames so extension.ts can reference them by name
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
