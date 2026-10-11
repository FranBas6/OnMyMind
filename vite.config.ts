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
      // El service worker lo escribimos nosotros (`src/sw/sw.ts`, 2.6) para recibir los push; el
      // plugin lo compila y le inyecta la lista del precache. Hace lo que hacía el generado.
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
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
        // Compartir a OnMyMind desde otra app (4.7): en Android, la app instalada sale en la hoja
        // de compartir y abre `/share`, que lo guarda en «En mente». iOS no lo tiene: allí va el
        // Atajo «Guardar en OnMyMind», que abre la misma ruta.
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
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
      injectManifest: {
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
    // También la lógica pura de las edge functions (Deno), que se prueba igual que la app.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'supabase/functions/**/*.test.ts'],
    css: false,
    // Valores ficticios: el cliente de Supabase lanza si faltan al importarse. Los tests no
    // hablan con Supabase (la sesión se inyecta en el contexto del router).
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      // Las fechas de los tests son de reloj en Madrid (el cambio de hora, la repetición): igual
      // en cualquier máquina.
      TZ: 'Europe/Madrid',
    },
  },
})
