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
        name: 'Figurinhas Copa 2026',
        short_name: 'Figurinhas',
        description: 'Acompanhe seu álbum da Copa 2026',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'portrait',
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
