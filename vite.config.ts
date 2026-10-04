import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages では https://<user>.github.io/moji-uchi-game/ で配信する
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/moji-uchi-game/' : '/',
  plugins: [
    VitePWA({
      // 新しい版は待たせておき、スタート画面で切り替える（ゲーム中に読み込み直さない。絵とプログラムの版がずれない）
      registerType: 'prompt',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'がっくんのこくご',
        short_name: 'がっくんのこくご',
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
        // 教科書体（Klee One）を一度読んだら端末に保存して、オフラインでも使う
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-files', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
}));
