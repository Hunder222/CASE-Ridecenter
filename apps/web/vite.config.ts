import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Bøgegården Stald',
        short_name: 'Stald',
        description: 'Bøgegårdens Ridecenter offline-first staldflade til hestetildeling og fremmøde',
        start_url: '/stald/laas',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#2563eb',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        // Kun ruter under /stald/* og statiske JS/CSS/billeder caches offline.
        // Udeluk /admin/* og /api/* fra service worker cache.
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/stald/],
        navigateFallbackDenylist: [/^\/admin/, /^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/admin') || url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ request }) =>
              request.destination === 'style' ||
              request.destination === 'script' ||
              request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'statiske-aktiver',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 dage
              },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/stald'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'stald-navigation',
              networkTimeoutSeconds: 2,
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Samme origin i browseren, så API'ets session-cookie virker uden CORS.
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.{ts,tsx}'],
    passWithNoTests: true,
  },
});
