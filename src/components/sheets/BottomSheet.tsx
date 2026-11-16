import type { ReactNode } from 'react'
import { Drawer } from 'vaul'

import { useKeyboardInset, useVisibleHeight } from '@/hooks/useKeyboardInset'
import { cn } from '@/lib/utils'

/** Lo que queda libre por encima de la hoja con el teclado abierto. */
const KEYBOARD_TOP_GAP = 12

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Título para lectores de pantalla (la hoja pinta su propia cabecera visible). */
  title: string
  description?: string
  /** Hoja abierta desde otra hoja (el selector de fecha sobre el detalle): se apila encima. */
  nested?: boolean
  className?: string
  children: ReactNode
}

/**
 * Hoja inferior de móvil (diseño 04 Listas): velo, radio de 28 px arriba, asa de 40 × 5, sombra
 * suave y 40 px de aire abajo (más la zona segura). Se cierra deslizando hacia abajo, tocando
 * el velo o con Escape.
 *
 * Con el teclado abierto (escribir en la ficha de un ítem), la hoja se apoya justo encima de él,
 * no pasa del alto que se ve y deja el aire de abajo: con el teclado, la zona segura no hace
 * falta. Lo calcula la app con `visualViewport`, como la captura (`KeyboardSheet`), y no vaul
 * (`repositionInputs`): en el iPhone su cálculo dejaba una franja blanca entre el texto y el
 * teclado que tapaba lo de abajo (bug de Fran, 2026-10-15).
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  nested = false,
  className,
  children,
}: BottomSheetProps) {
  const Root = nested ? Drawer.NestedRoot : Drawer.Root
  const keyboard = useKeyboardInset()
  const visible = useVisibleHeight()
  return (
    <Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Drawer.Content
          style={
            keyboard > 0
              ? {
                  bottom: keyboard,
                  maxHeight: visible - KEYBOARD_TOP_GAP,
                  paddingBottom: KEYBOARD_TOP_GAP,
                }
              : undefined
          }
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 rounded-t-[28px] bg-card px-[22px] pb-[calc(env(safe-area-inset-bottom)+2.5rem)] text-foreground shadow-sheet outline-none',
            className,
          )}
        >
          <div
            aria-hidden
            className="mx-auto mt-2.5 mb-1.5 h-[5px] w-10 shrink-0 rounded-[3px] bg-border"
          />
          <Drawer.Title className="sr-only">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">{description ?? title}</Drawer.Description>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Root>
  )
}
