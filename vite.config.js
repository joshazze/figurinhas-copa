import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

const repoName = process.env.REPO_NAME || 'figurinhas-copa';
const isPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: isPages ? `/${repoName}/` : '/',
  build: {
    rollupOptions: {
      output: {
        // Isola OCR (onnxruntime + paddle) num chunk com nome reconhecivel
        manualChunks(id) {
          if (id.includes('onnxruntime') || id.includes('gutenye/ocr')) return 'ocr-engine';
        },
        chunkFileNames(chunk) {
          if (chunk.name === 'ocr-engine') return 'assets/ocr-engine-[hash].js';
          return 'assets/[name]-[hash].js';
        }
      }
    }
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Figs — Cromos da Copa 2026',
        short_name: 'Figs',
        description: 'App de bolso pro álbum da Copa 2026. 48 seleções · 980 figurinhas · pacotes, trocas e scan.',
        theme_color: '#050b1f',
        background_color: '#050b1f',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['sports', 'lifestyle', 'utilities'],
        lang: 'pt-BR',
        start_url: isPages ? `/${repoName}/` : '/',
        scope: isPages ? `/${repoName}/` : '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Cache em runtime pros binarios grandes (ORT wasm 26MB, OCR chunk 10MB).
        // Eles so sao baixados quando o user abre o Scan e ficam cacheados.
        globPatterns: ['**/*.{css,html,svg,png,ico,webmanifest}'],
        // Exclui chunks grandes do PWA precache (carregam por demanda)
        globIgnores: ['**/ort-*.{js,wasm}', '**/onnxruntime*', '**/ocr-engine-*.js'],
        maximumFileSizeToCacheInBytes: 500 * 1024,    // 500KB pra precache estrito
        // Permite que o build prossiga mesmo com chunks grandes
        // (eles aparecem no manifest pra runtime cache pegar)
        dontCacheBustURLsMatching: /\.(?:wasm|onnx)$/,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm') || url.pathname.endsWith('.onnx'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-binaries',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-ocr',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            urlPattern: /^https:\/\/unpkg\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'unpkg-cdn' }
          }
        ]
      }
    })
  ]
});
