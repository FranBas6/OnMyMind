import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Las piezas de las hojas de la clave privada (diseño 26): «Cancelar» arriba a la derecha en el
 * móvil, el botón grande de 52 px y, en escritorio, los botones abajo a la derecha.
 */

/** «Cancelar», a la derecha del título en el móvil. */
export function HeaderCancel() {
  return (
    <Dialog.Close className="rounded-md text-[15px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
      Cancelar
    </Dialog.Close>
  )
}

interface ActionProps {
  children: ReactNode
  disabled?: boolean
  /** El rojo de lo que no se deshace («Enviarme el código», C5b). */
  destructive?: boolean
  type?: 'submit' | 'button'
  onClick?: () => void
}

/** El botón principal: en el móvil, a todo lo ancho; en escritorio, abajo a la derecha. */
export function MainAction({
  children,
  disabled = false,
  destructive = false,
  type = 'submit',
  onClick,
  isDesktop,
}: ActionProps & { isDesktop: boolean }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 rounded-[14px] font-display font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:bg-fill disabled:text-muted-foreground',
        isDesktop ? 'h-11 px-[18px] text-[15px]' : 'h-13 w-full text-base',
        destructive
          ? 'bg-destructive text-destructive-foreground hover:brightness-95'
          : 'bg-primary text-primary-foreground hover:bg-primary-hover',
      )}
    >
      {children}
    </button>
  )
}

/** En escritorio, «Cancelar» y el botón principal, abajo a la derecha. */
export function DesktopActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 flex items-center justify-end gap-2">
      <Dialog.Close className="h-11 rounded-[14px] px-4 font-display text-[15px] font-bold text-muted-foreground outline-none hover:bg-fill hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
        Cancelar
      </Dialog.Close>
      {children}
    </div>
  )
}

/** La caja gris de lo que conviene saber, con lo importante en negrita. */
export function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[14px] bg-fill px-3.5 py-3 text-[13.5px] leading-[1.45] text-foreground">
      {children}
    </div>
  )
}

/** El párrafo de explicación bajo el título. */
export function Lead({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-[1.45] text-muted-foreground">{children}</p>
}

/** Un enlace en texto índigo («Probar con Face ID», «He olvidado la clave»). */
export function TextAction({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      {children}
    </button>
  )
}
