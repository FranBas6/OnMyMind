import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { useOnline } from '@/hooks/useOnline'
import { cn } from '@/lib/utils'

import { ChangePasswordDialog } from './ChangePasswordDialog'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { SignOutDialog } from './SignOutDialog'

/**
 * «Cuenta» (diseños 09 y 18, P6 y D5): «Cambiar la contraseña» (añadido por Fran en 1.13),
 * «Cerrar sesión» con su confirmación y, desde la 2.8, «Borrar la cuenta», en rojo y al final:
 * con ella, «Cerrar sesión» deja de ir en rojo, como dibuja el 18. Sin conexión, borrar la cuenta
 * va en gris con «Necesita conexión» (P11).
 */
export function AccountSection({
  isDesktop,
  onExport,
}: {
  isDesktop: boolean
  /** «exporta tus datos», desde la confirmación de borrar. */
  onExport: () => void
}) {
  const [dialog, setDialog] = useState<'password' | 'signOut' | 'delete' | null>(null)
  const online = useOnline()
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
          className="flex h-13 w-full items-center border-t border-border-soft px-4 text-left text-[15px] font-medium outline-none hover:bg-fill focus-visible:bg-fill"
        >
          Cerrar sesión
        </button>
        <button
          type="button"
          disabled={!online}
          onClick={() => {
            setDialog('delete')
          }}
          className={cn(
            'flex h-13 w-full items-center justify-between gap-3 border-t border-border-soft px-4 text-left text-[15px] font-medium outline-none hover:bg-fill focus-visible:bg-fill disabled:hover:bg-transparent',
            online ? 'text-error' : 'text-muted-foreground',
          )}
        >
          Borrar la cuenta
          {!online && (
            <span className="text-[14px] font-normal text-muted-foreground">Necesita conexión</span>
          )}
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
      <DeleteAccountDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        isDesktop={isDesktop}
        onExport={() => {
          close()
          onExport()
        }}
      />
    </>
  )
}
