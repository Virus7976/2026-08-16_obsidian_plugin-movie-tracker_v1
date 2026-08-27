import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /<repo>/, local dev from /.
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  build: { target: 'es2022', outDir: 'dist', chunkSizeWarningLimit: 1600 },
  worker: { format: 'es' },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // cmaps (.bcmap) are only needed for CJK and exotic encodings, so they are
        // fetched on demand and cached by the worker instead of shipped up front.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,pfb,ttf}'],
      },
      manifest: {
        name: 'PDF to EPUB',
        short_name: 'PDF→EPUB',
        description: 'Turn a PDF into a properly typeset EPUB, entirely on your device.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#12161b',
        theme_color: '#12161b',
        categories: ['books', 'productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        share_target: {
          action: `${base}share-target`,
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { files: [{ name: 'pdf', accept: ['application/pdf', '.pdf'] }] },
        },
        file_handlers: [{ action: base, accept: { 'application/pdf': ['.pdf'] } }],
      },
    }),
  ],
});
