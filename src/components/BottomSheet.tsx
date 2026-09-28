import type { ReactNode } from 'react'
import { Drawer } from 'vaul'

import { cn } from '@/lib/utils'

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
  return (
    <Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Drawer.Content
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
