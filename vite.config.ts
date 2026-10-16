/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.SHIM_VERSION || pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      // "prompt": a new version waits until the user agrees — we never reload under their feet.
      registerType: 'prompt',
      injectRegister: false, // registered from src/pwa/useOfflineStatus.ts
      filename: 'sw.js',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'theme-init.js'],
      manifest: {
        id: '/',
        name: 'Shim — Small Lists, Smooth Rides.',
        short_name: 'Shim',
        description: 'Turn columns into comma-separated lists and back. 100% local, works offline.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F7F3EA',
        theme_color: '#A8DCCB',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Precache the entire app shell: HTML, JS, CSS, bundled fonts and illustrations.
        globPatterns: ['**/*.{html,js,css,svg,png,ico,woff,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/sw\.js$/, /^\/workbox-/],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // No runtime caching of anything external: Shim makes no external requests.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 0, // keep fonts as real files so they are precached individually
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
