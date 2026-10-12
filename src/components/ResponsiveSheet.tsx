import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'

import { KeyboardSheetContent } from '@/components/KeyboardSheet'
import { cn } from '@/lib/utils'

interface ResponsiveSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDesktop: boolean
  title: string
  /** A la derecha del título en móvil («Cancelar», diseño 18, P7). */
  headerAction?: ReactNode
  /** Encima del título (el de Face ID en «Clave creada», diseño 26, C2d). */
  icon?: ReactNode
  /** En escritorio, «Esc» y la ✕ a la derecha del título (diseño 26, D3 y D9). */
  closeHint?: boolean
  children: ReactNode
}

/**
 * Hoja en móvil, diálogo en escritorio: las de Datos y Cuenta de Perfil (diseño 18, P7–P10 y D7)
 * y la de compartir una lista (diseño 20). En móvil, hoja pegada al teclado con el
 * título arriba; en escritorio, el diálogo de 440 px de las confirmaciones (460 px con `closeHint`,
 * como los de la clave privada, diseño 26).
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  isDesktop,
  title,
  headerAction,
  icon,
  closeHint = false,
  children,
}: ResponsiveSheetProps) {
  const heading = (
    <Dialog.Title
      className={cn(
        'font-display font-extrabold tracking-[-0.02em]',
        isDesktop ? 'text-[22px]' : 'text-2xl',
      )}
    >
      {title}
    </Dialog.Title>
  )
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        {isDesktop ? (
          <Dialog.Content
            aria-describedby={undefined}
            className={cn(
              'fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-[28px] border border-border bg-background p-7 text-foreground shadow-dialog outline-none',
              closeHint ? 'w-[460px]' : 'w-[440px]',
            )}
          >
            {icon}
            {closeHint ? (
              <div className="flex items-center justify-between gap-3">
                {heading}
                <span className="flex items-center gap-2">
                  <kbd className="rounded-[5px] bg-fill px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
                    Esc
                  </kbd>
                  <Dialog.Close
                    aria-label="Cerrar"
                    className="grid size-7 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-fill hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <X aria-hidden className="size-[18px]" strokeWidth={2.2} />
                  </Dialog.Close>
                </span>
              </div>
            ) : (
              heading
            )}
            {children}
          </Dialog.Content>
        ) : (
          <KeyboardSheetContent title={title} className="flex flex-col gap-4 pb-8">
            {icon}
            <div className="flex items-center justify-between gap-3">
              <p aria-hidden className="font-display text-2xl font-extrabold tracking-[-0.02em]">
                {title}
              </p>
              {headerAction}
            </div>
            {children}
          </KeyboardSheetContent>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  )
}
