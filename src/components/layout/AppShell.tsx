import { useMatches } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'

import { Fab } from '@/components/Fab'
import { useCapture } from '@/features/capture'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { SidePanelContext } from './sidePanel'

interface AppShellProps {
  children: ReactNode
}

/**
 * Estructura de las pantallas privadas. Móvil (< 768 px): una columna y barra inferior fija.
 * Escritorio: sidebar de 272 px y contenido centrado a 760 px (880 px si la ruta declara
 * `staticData: { wide: true }`, como Inicio). Con `addBar`, el móvil deja sitio solo para la barra
 * (el detalle de lista pega su campo encima). Se pinta solo una de las dos
 * navegaciones para no duplicar enlaces en el DOM ni en el orden de tabulación. En escritorio hay
 * una tercera columna, vacía salvo cuando una pantalla abre ahí su panel lateral (`sidePanel.ts`).
 */
export function AppShell({ children }: AppShellProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const wide = useMatches({ select: (matches) => matches.some((match) => match.staticData.wide) })
  const addBar = useMatches({
    select: (matches) => matches.some((match) => match.staticData.addBar),
  })
  const [panel, setPanel] = useState<HTMLElement | null>(null)
  const capture = useCapture()

  if (isDesktop) {
    return (
      <SidePanelContext value={panel}>
        <div className="grid min-h-dvh grid-cols-[272px_minmax(0,1fr)_auto] bg-background text-foreground">
          <Sidebar />
          <main className="min-w-0 px-12 py-9">
            <div className={cn('mx-auto w-full', wide ? 'max-w-[880px]' : 'max-w-[760px]')}>
              {children}
            </div>
          </main>
          <div ref={setPanel} className="sticky top-0 h-dvh" />
        </div>
      </SidePanelContext>
    )
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/*
        Abajo: barra de 56 px + indicador de inicio + aire para el FAB (1.10). Con campo de añadir,
        solo la barra: el campo va pegado encima (sticky) y la columna ocupa toda la altura.
      */}
      <main
        className={cn(
          'pt-[calc(env(safe-area-inset-top)+0.75rem)] pr-[max(env(safe-area-inset-right),1.25rem)] pl-[max(env(safe-area-inset-left),1.25rem)]',
          addBar
            ? 'flex min-h-dvh flex-col pb-[calc(env(safe-area-inset-bottom)+3.5rem)]'
            : 'pb-[calc(env(safe-area-inset-bottom)+7rem)]',
        )}
      >
        {children}
      </main>
      {/* En el detalle de lista el campo de añadir sustituye al + (06 §Layout). */}
      {!addBar && (
        <Fab
          onClick={() => {
            capture.open()
          }}
        />
      )}
      <BottomNav />
    </div>
  )
}
