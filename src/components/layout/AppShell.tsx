import { useMatches } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'

import { Fab } from '@/components/Fab'
import { OfflineBanner } from '@/components/OfflineBanner'
import { useCapture } from '@/features/capture'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

import { BottomNav } from './BottomNav'
import {
  LayoutWidthsContext,
  MAX_APP_WIDTH,
  SIDEBAR_WIDTH,
  useLayoutWidthsState,
} from './layoutWidths'
import { ResizeHandle } from './ResizeHandle'
import { Sidebar } from './Sidebar'
import { SidePanelContext } from './sidePanel'

interface AppShellProps {
  children: ReactNode
}

/**
 * Estructura de las pantallas privadas. Móvil (< 768 px): una columna y barra inferior fija.
 * Escritorio: sidebar (272 px, que se ensancha arrastrando su borde hasta 400) y el contenido, que
 * crece con la ventana hasta 1040 px (antes, 760 y 880 en las rutas `wide`; Fran, 2026-11-16). En
 * pantallas de más de 1760 px, la app entera se queda centrada y los paneles no se van a los bordes. Con `addBar`, el móvil deja sitio solo para la barra
 * (el detalle de lista pega su campo encima). Se pinta solo una de las dos
 * navegaciones para no duplicar enlaces en el DOM ni en el orden de tabulación. En escritorio hay
 * una tercera columna, vacía salvo cuando una pantalla abre ahí su panel lateral (`sidePanel.ts`).
 */
export function AppShell({ children }: AppShellProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const addBar = useMatches({
    select: (matches) => matches.some((match) => match.staticData.addBar),
  })
  const noFab = useMatches({
    select: (matches) => matches.some((match) => match.staticData.noFab),
  })
  const [panel, setPanel] = useState<HTMLElement | null>(null)
  const capture = useCapture()
  const widths = useLayoutWidthsState()

  if (isDesktop) {
    return (
      <LayoutWidthsContext value={widths}>
        <SidePanelContext value={panel}>
          <div className="min-h-dvh bg-background text-foreground">
            <div
              className="mx-auto grid min-h-dvh"
              style={{
                maxWidth: MAX_APP_WIDTH,
                gridTemplateColumns: `${String(widths.sidebar)}px minmax(0,1fr) auto`,
              }}
            >
              <div className="sticky top-0 h-dvh">
                <Sidebar />
                <ResizeHandle
                  label="Ancho de la barra lateral"
                  edge="end"
                  value={widths.sidebar}
                  min={SIDEBAR_WIDTH.min}
                  max={widths.sidebarMax}
                  onChange={widths.setSidebar}
                  onReset={() => {
                    widths.setSidebar(SIDEBAR_WIDTH.initial)
                  }}
                />
              </div>
              <main className="min-w-0 px-12 py-9">
                <div className="mx-auto w-full max-w-[1040px]">{children}</div>
              </main>
              <div ref={setPanel} className="sticky top-0 h-dvh" />
            </div>
          </div>
        </SidePanelContext>
      </LayoutWidthsContext>
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
        {/* Sin red, una banda encima de la cabecera de cada pantalla (diseño 10, I4). */}
        <OfflineBanner variant="page" />
        {children}
      </main>
      {/* En el detalle de lista el campo de añadir sustituye al + (06 §Layout); Buscar no lo lleva. */}
      {!addBar && !noFab && (
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
