import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const plugins = [react()]

  if (mode === 'admin') {
    plugins.push(
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'logo.png', 'logo.svg'],
        manifest: {
          name: 'GetMyPro Admin',
          short_name: 'GMP Admin',
          description: 'GetMyPro backoffice — orders, workers, payments, analytics',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/admin',
          icons: [
            {
              src: 'logo.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Cache all admin app assets
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Network-first for API/supabase calls, cache-first for static assets
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 300 },
                networkTimeoutSeconds: 10,
              },
            },
          ],
          // Don't cache the admin login redirect
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
        },
        devOptions: {
          enabled: false, // keep dev fast; SW only active in builds
        },
      }) as any,
    )
  }

  return {
    plugins,
    server: {
      host: '127.0.0.1',
    },
    build: {
      rollupOptions: {},
    },
    define: {
      'import.meta.env.VITE_PORTAL': JSON.stringify(env.VITE_PORTAL || mode),
    },
  }
})
