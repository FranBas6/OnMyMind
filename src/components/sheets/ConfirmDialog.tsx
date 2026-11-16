import { AlertDialog } from 'radix-ui'
import type { ReactNode } from 'react'

import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** El botón rojo: «Borrar», «Borrar sublista y 7 cosas». */
  confirmLabel: string
  onConfirm: () => void
  /** Delante del título, en la misma línea: la inicial de quien se quita (diseño 20, S8). */
  icon?: ReactNode
}

/**
 * Confirmación destructiva (diseño 04 Listas, L10 y D7; diseño 12, S5): título, lo que se pierde y
 * el botón rojo. En móvil, con aspecto de hoja inferior y el botón rojo arriba; en escritorio,
 * diálogo de 440 px con los botones abajo a la derecha. Es un `alertdialog`: no se cierra tocando
 * fuera sin querer.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  icon,
}: ConfirmDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <AlertDialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-background text-foreground outline-none',
            isDesktop
              ? 'top-1/2 left-1/2 w-[440px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 gap-[18px] rounded-[28px] border border-border p-7 shadow-dialog'
              : 'inset-x-0 bottom-0 gap-4 rounded-t-[28px] bg-card px-[22px] pb-[calc(env(safe-area-inset-bottom)+2.5rem)] shadow-sheet',
          )}
        >
          {!isDesktop && (
            <div aria-hidden className="mx-auto mt-2.5 h-[5px] w-10 rounded-[3px] bg-border" />
          )}
          <div className={cn('flex items-center gap-3', !isDesktop && 'mt-2')}>
            {icon}
            <AlertDialog.Title className="text-[22px] tracking-[-0.02em]">
              {title}
            </AlertDialog.Title>
          </div>
          <AlertDialog.Description
            className={cn(
              'text-[15px] leading-normal text-muted-foreground',
              isDesktop ? '-mt-2' : '-mt-1.5',
            )}
          >
            {description}
          </AlertDialog.Description>
          <div
            className={cn(
              'flex gap-2.5',
              isDesktop ? 'mt-1.5 justify-end' : 'mt-2 flex-col-reverse',
            )}
          >
            <AlertDialog.Cancel
              className={cn(
                'bg-fill font-display font-bold text-foreground outline-none hover:bg-border focus-visible:ring-[3px] focus-visible:ring-ring/50',
                isDesktop ? 'h-12 rounded-[14px] px-5 text-[15px]' : 'h-13 rounded-2xl text-base',
              )}
            >
              Cancelar
            </AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={onConfirm}
              className={cn(
                'bg-destructive font-display font-bold text-destructive-foreground outline-none hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/50',
                isDesktop
                  ? 'h-12 rounded-[14px] px-[22px] text-[15px]'
                  : 'h-13 rounded-2xl text-base',
              )}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
