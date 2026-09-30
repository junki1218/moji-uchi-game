import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages では https://<user>.github.io/moji-uchi-game/ で配信する
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/moji-uchi-game/' : '/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'もじうちゲーム',
        short_name: 'もじうち',
        lang: 'ja',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#FFF7EC',
        theme_color: '#FFB84D',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webp,json,m4a}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
}));
