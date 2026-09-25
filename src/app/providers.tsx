import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

interface AppProvidersProps {
  queryClient: QueryClient
  children: ReactNode
}

/** Providers globales: datos (Query), tema claro/oscuro (clase `.dark`), tooltips y toasts. */
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
          {children}
          <Toaster position="top-center" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
