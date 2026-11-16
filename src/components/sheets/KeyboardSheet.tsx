import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'

import { useKeyboardInset } from '@/hooks/useKeyboardInset'
import { cn } from '@/lib/utils'

/**
 * Contenido de una hoja de móvil que escribe con el teclado abierto (captura rápida, tu nombre,
 * la contraseña): va pegada encima del teclado. Su `bottom` es lo que tapa el teclado
 * (`useKeyboardInset`, con `visualViewport`); sin teclado, baja al fondo y deja la zona segura
 * del indicador de inicio. Va dentro de un `Dialog.Root` / `Dialog.Portal` de Radix.
 */
export function KeyboardSheetContent({
  title,
  className,
  children,
}: {
  /** Para lectores de pantalla (la hoja no lo enseña como título). */
  title: string
  className?: string
  children: ReactNode
}) {
  const keyboard = useKeyboardInset()
  return (
    <Dialog.Content
      aria-describedby={undefined}
      // El campo ya se enfoca solo (`autoFocus`); sin esto, Radix pondría el foco en otro sitio.
      onOpenAutoFocus={(event) => {
        event.preventDefault()
      }}
      style={{ bottom: keyboard }}
      className={cn(
        'fixed inset-x-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[28px] bg-card px-[22px] pt-2.5 text-foreground shadow-sheet outline-none',
        keyboard === 0 && 'pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      <div aria-hidden className="mx-auto mb-4 h-[5px] w-10 rounded-[3px] bg-border" />
      <Dialog.Title className="sr-only">{title}</Dialog.Title>
      {children}
    </Dialog.Content>
  )
}
