import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Project-page GitHub Pages deploys live under /Gomi-Kore/, so the deploy
// workflow sets GITHUB_PAGES=true for that build only; local dev/preview and
// a future custom-domain/Vercel deploy stay at the root path.
const base = process.env.GITHUB_PAGES === 'true' ? '/Gomi-Kore/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,json}'],
      },
      manifest: {
        id: base,
        name: 'ごみコレ | Gomi-Kore',
        short_name: 'ごみコレ',
        description: '今日のゴミ、聞かなくても分かる。札幌市のごみ収集日カレンダー。',
        lang: 'ja',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#fafaf8',
        theme_color: '#1f7a4d',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
