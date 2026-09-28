import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { ChangePasswordDialog } from './ChangePasswordDialog'
import { SignOutDialog } from './SignOutDialog'

/**
 * «Cuenta» (diseño 09): «Cambiar la contraseña» (añadido por Fran en 1.13, encima) y «Cerrar
 * sesión» en `error`, con su confirmación. «Borrar cuenta» llega en la fase 2.
 */
export function AccountSection({ isDesktop }: { isDesktop: boolean }) {
  const [dialog, setDialog] = useState<'password' | 'signOut' | null>(null)
  const close = () => {
    setDialog(null)
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border-soft bg-card">
        <button
          type="button"
          onClick={() => {
            setDialog('password')
          }}
          className="flex h-13 w-full items-center justify-between gap-3 px-4 text-left text-[15px] font-medium outline-none hover:bg-fill focus-visible:bg-fill"
        >
          Cambiar la contraseña
          <ChevronRight aria-hidden className="size-4 text-subtle-foreground" />
        </button>
        <button
          type="button"
          onClick={() => {
            setDialog('signOut')
          }}
          className="flex h-13 w-full items-center border-t border-border-soft px-4 text-left text-[15px] font-medium text-error outline-none hover:bg-fill focus-visible:bg-fill"
        >
          Cerrar sesión
        </button>
      </div>
      <ChangePasswordDialog open={dialog === 'password'} onClose={close} isDesktop={isDesktop} />
      <SignOutDialog
        open={dialog === 'signOut'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        isDesktop={isDesktop}
      />
    </>
  )
}
