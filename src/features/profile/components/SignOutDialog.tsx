import { useIsMutating } from '@tanstack/react-query'
import { AlertDialog } from 'radix-ui'

import { authErrorMessage, FormError, useSignOut } from '@/features/auth'
import { useOnline } from '@/hooks/useOnline'
import { isPendingChange } from '@/lib/flushMutations'
import { cn } from '@/lib/utils'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDesktop: boolean
}

/**
 * «¿Cerrar sesión?» (diseño 09, P8 y D6): es lo único de Perfil que te saca de la app. En móvil,
 * con aspecto de hoja y «Cerrar sesión» arriba; en escritorio, diálogo de 440 px. Mientras se
 * envía lo pendiente, el botón dice «Cerrando sesión…». Sin red y con cambios sin enviar, lo
 * avisa en vez de prometer que se enviarán.
 */
export function SignOutDialog({ open, onOpenChange, isDesktop }: SignOutDialogProps) {
  const signOut = useSignOut()
  const online = useOnline()
  // Los cambios por enviar, sin contar el propio cerrar sesión.
  const pending = useIsMutating({ predicate: isPendingChange })
  const willLose = !online && pending > 0

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
          <AlertDialog.Title className={cn('text-[22px] tracking-[-0.02em]', !isDesktop && 'mt-2')}>
            ¿Cerrar sesión?
          </AlertDialog.Title>
          <AlertDialog.Description
            className={cn(
              'text-[15px] leading-normal text-muted-foreground',
              isDesktop ? '-mt-2' : '-mt-1.5',
            )}
          >
            {willLose
              ? 'No hay conexión y hay cambios sin enviar: si sales ahora, se perderán.'
              : 'Tus listas se quedan en la cuenta. Lo que aún no se haya sincronizado se enviará antes de salir.'}
          </AlertDialog.Description>
          {signOut.error && <FormError message={authErrorMessage(signOut.error)} />}
          <div
            className={cn(
              'flex gap-2.5',
              isDesktop ? 'mt-1.5 justify-end' : 'mt-2 flex-col-reverse',
            )}
          >
            <AlertDialog.Cancel
              disabled={signOut.isPending}
              className={cn(
                'bg-fill font-display font-bold text-foreground outline-none hover:bg-border focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50',
                isDesktop ? 'h-12 rounded-[14px] px-5 text-[15px]' : 'h-13 rounded-2xl text-base',
              )}
            >
              Cancelar
            </AlertDialog.Cancel>
            {/* No es un `Action`: el diálogo se queda abierto mientras se envía lo pendiente. */}
            <button
              type="button"
              disabled={signOut.isPending}
              onClick={() => {
                signOut.mutate()
              }}
              className={cn(
                'bg-destructive font-display font-bold text-destructive-foreground outline-none hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-70',
                isDesktop
                  ? 'h-12 rounded-[14px] px-[22px] text-[15px]'
                  : 'h-13 rounded-2xl text-base',
              )}
            >
              {signOut.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
