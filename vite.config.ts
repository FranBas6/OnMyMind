/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Cuándo se hizo esta versión: la app la enseña en Perfil («Versión del 28 sep»). La misma fecha
 * se publica en `/version.json`, fuera del precache, para saber de cuándo es la versión nueva
 * antes de actualizar («Publicada hoy · la tuya es del 28 sep»).
 */
const BUILD_TIME = new Date().toISOString()

function versionFile(): Plugin {
  const body = JSON.stringify({ builtAt: BUILD_TIME })
  return {
    name: 'onmymind-version-file',
    // En `pnpm dev` también, para que «Buscar actualización» de Perfil se pueda probar en local.
    configureServer(server) {
      server.middlewares.use('/version.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json')
        response.end(body)
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: body,
      })
    },
  }
}

export default defineConfig({
  define: {
    __APP_BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  plugins: [
    versionFile(),
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
      // `prompt`: una versión nueva espera a que le digas «Actualizar» (no recarga sola en mitad
      // de una captura). El registro lo hace la app con `useRegisterSW` (`src/app/pwa.tsx`).
      registerType: 'prompt',
      injectRegister: false,
      // Sin `includeAssets` ni los iconos del manifest por su cuenta: `globPatterns` (abajo) ya
      // precachea los logos que hacen falta (iconos del manifest, favicon, apple-touch-icon y los
      // SVG), y añadirlos también por aquí los repetía en el precache.
      includeManifestIcons: false,
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
        // (El manifest lo añade el plugin por su cuenta.)
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Las variantes grandes del logo (wordmarks, 1024, marcas de 512) no hacen falta offline;
        // los iconos del manifest, el favicon y el apple-touch-icon sí (08 A.6).
        globIgnores: [
          'logos/png/onmymind-logo*.png',
          'logos/png/app-icon-1024.png',
          'logos/png/mark-*.png',
        ],
        navigateFallback: '/index.html',
        // La vuelta de OAuth (`/auth/callback`) tiene que llegar a la red, no al `index.html`
        // precacheado (08 A.7).
        navigateFallbackDenylist: [/^\/auth\//],
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
    // Valores ficticios: el cliente de Supabase lanza si faltan al importarse. Los tests no
    // hablan con Supabase (la sesión se inyecta en el contexto del router).
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
