import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

import { PwaProvider } from './pwa'

interface AppProvidersProps {
  queryClient: QueryClient
  children: ReactNode
}

/**
 * Providers globales: datos (Query, con la caché ya restaurada de IndexedDB en `main.tsx`), tema
 * claro/oscuro (clase `.dark`), la app instalable (service worker, `pwa.tsx`), tooltips y toasts.
 */
export function AppProviders({ queryClient, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {/*
        next-themes inyecta un <script> anti-parpadeo pensado para SSR que en una SPA no se
        ejecuta nunca, y React 19 avisa en consola. Marcarlo como bloque de datos lo silencia;
        el anti-parpadeo real está en index.html.
      */}
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        scriptProps={{ type: 'application/json' }}
      >
        <TooltipProvider>
          <PwaProvider>{children}</PwaProvider>
          {/*
            Los avisos de abajo («Deshacer») van a 32 px en escritorio. En móvil, sobre la barra y a
            la izquierda del botón +, centrados con él: dejan libres sus 76 px (diseño 07, C7).
          */}
          <Toaster
            position="top-center"
            offset={{ bottom: 32 }}
            mobileOffset={{
              bottom: 'calc(env(safe-area-inset-bottom) + 76px)',
              left: 20,
              right: 96,
            }}
          />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
