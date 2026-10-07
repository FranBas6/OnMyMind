import type { LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Botón con borde y un icono, de los de dentro de una hoja: «Copiar enlace» y «Enviar otra vez» al
 * compartir una lista (diseño 20, S4) y «Copiar enlace» del Calendario del iPhone (diseño 21, C2).
 * `highlighted` lo pone en índigo («Copiado»).
 */
export function OutlineButton({
  icon: Icon,
  highlighted = false,
  className,
  children,
  ...props
}: ComponentProps<'button'> & {
  icon: LucideIcon
  highlighted?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-2 text-[14px] font-semibold outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:text-subtle-foreground',
        highlighted && 'text-primary',
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className="size-4 shrink-0" strokeWidth={2.2} />
      <span className="truncate">{children}</span>
    </button>
  )
}
