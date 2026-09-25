import { useMatches } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  children: ReactNode
}

/**
 * Estructura de las pantallas privadas. Móvil (< 768 px): una columna y barra inferior fija.
 * Escritorio: sidebar de 272 px y contenido centrado a 760 px (880 px si la ruta declara
 * `staticData: { wide: true }`, como Inicio). Se pinta solo una de las dos
 * navegaciones para no duplicar enlaces en el DOM ni en el orden de tabulación.
 */
export function AppShell({ children }: AppShellProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const wide = useMatches({ select: (matches) => matches.some((match) => match.staticData.wide) })

  if (isDesktop) {
    return (
      <div className="grid min-h-dvh grid-cols-[272px_minmax(0,1fr)] bg-background text-foreground">
        <Sidebar />
        <main className="min-w-0 px-12 py-9">
          <div className={cn('mx-auto w-full', wide ? 'max-w-[880px]' : 'max-w-[760px]')}>
            {children}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Abajo: barra de 56 px + indicador de inicio + aire para el FAB (1.10). */}
      <main className="pt-[calc(env(safe-area-inset-top)+0.75rem)] pr-[max(env(safe-area-inset-right),1.25rem)] pb-[calc(env(safe-area-inset-bottom)+7rem)] pl-[max(env(safe-area-inset-left),1.25rem)]">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
