import { AlertDialog } from 'radix-ui'

import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

import { deleteMessage } from '../templates'
import type { List } from '../types'

interface DeleteListDialogProps {
  list: List | undefined
  onOpenChange: (open: boolean) => void
  onConfirm: (list: List) => void
}

/**
 * Confirmación de borrado (diseño 04 Listas, L10 y D7): dice cuántos ítems se pierden. En móvil,
 * con aspecto de hoja inferior y «Borrar» arriba; en escritorio, diálogo de 440 px con los
 * botones abajo a la derecha. Es un `alertdialog`: no se cierra tocando fuera sin querer.
 */
export function DeleteListDialog({ list, onOpenChange, onConfirm }: DeleteListDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  return (
    <AlertDialog.Root open={Boolean(list)} onOpenChange={onOpenChange}>
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
          {list && (
            <>
              <AlertDialog.Title
                className={cn('text-[22px] tracking-[-0.02em]', !isDesktop && 'mt-2')}
              >
                ¿Borrar «{list.name}»?
              </AlertDialog.Title>
              <AlertDialog.Description
                className={cn(
                  'text-[15px] leading-normal text-muted-foreground',
                  isDesktop ? '-mt-2' : '-mt-1.5',
                )}
              >
                {deleteMessage(list)}
              </AlertDialog.Description>
              <div
                className={cn(
                  'flex gap-2.5',
                  isDesktop ? 'mt-1.5 justify-end' : 'mt-2 flex-col-reverse',
                )}
              >
                <AlertDialog.Cancel
                  className={cn(
                    'bg-fill font-display font-bold text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    isDesktop
                      ? 'h-12 rounded-[14px] px-5 text-[15px]'
                      : 'h-13 rounded-2xl text-base',
                  )}
                >
                  Cancelar
                </AlertDialog.Cancel>
                <AlertDialog.Action
                  onClick={() => {
                    onConfirm(list)
                  }}
                  className={cn(
                    'bg-destructive font-display font-bold text-destructive-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    isDesktop
                      ? 'h-12 rounded-[14px] px-[22px] text-[15px]'
                      : 'h-13 rounded-2xl text-base',
                  )}
                >
                  Borrar
                </AlertDialog.Action>
              </div>
            </>
          )}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
