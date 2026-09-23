/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    // Debe ir antes que el plugin de React: genera src/app/routeTree.gen.ts a partir de src/routes.
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/routes',
      generatedRouteTree: './src/app/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Logos de public/logos (diseño). Los iconos del manifest se precachean automáticamente.
      includeAssets: [
        'logos/svg/omm-mark.svg',
        'logos/png/favicon-32.png',
        'logos/png/apple-touch-icon-180.png',
      ],
      manifest: {
        id: '/',
        name: 'OnMyMind',
        short_name: 'OnMyMind',
        description: 'Sácalo de la cabeza',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#5A4BE6',
        background_color: '#FBFAF7',
        categories: ['productivity', 'lifestyle'],
        icons: [
          { src: '/logos/png/pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/logos/png/pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/logos/png/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell completa + fuentes autoalojadas (woff2) para que funcione offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        // El resto de variantes del logo (wordmarks, 1024…) no hacen falta offline.
        globIgnores: ['logos/**'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
