import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

const repoName = process.env.REPO_NAME || 'figurinhas-copa';
const isPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: isPages ? `/${repoName}/` : '/',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Figurinhas Copa 2026 · Somos 26',
        short_name: 'Copa 2026',
        description: 'Álbum da Copa do Mundo FIFA 2026 — USA · Canadá · México · 48 seleções · 980 figurinhas',
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}']
      }
    })
  ]
});
