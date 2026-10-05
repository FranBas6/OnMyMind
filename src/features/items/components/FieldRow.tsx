import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Una fila de una caja de la ficha («Cuándo» de 17, el aviso de 18). Pasa la `ref` y el resto de
 * props al botón: en escritorio es el ancla del popover (`Popover.Anchor asChild`), que sin ella
 * no sabe dónde ponerse.
 */
export function Row({
  icon: Icon,
  iconClassName,
  label,
  highlighted = false,
  children,
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'children'> & {
  icon: LucideIcon
  /** El color del icono (el aviso lo pone en `primary` cuando hay uno, diseño 18). */
  iconClassName?: string
  label: string
  highlighted?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'flex h-13 w-full items-center justify-between gap-3 px-4 text-[15px] outline-none hover:bg-fill/50 focus-visible:bg-fill',
        highlighted && 'bg-brand-tint hover:bg-brand-tint',
        className,
      )}
    >
      <span className="flex items-center gap-2.5 font-medium">
        <Icon
          aria-hidden
          className={cn('size-4 text-muted-foreground', iconClassName)}
          strokeWidth={2}
        />
        {label}
      </span>
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        {children}
        <ChevronRight aria-hidden className="size-4 text-subtle-foreground" strokeWidth={2} />
      </span>
    </button>
  )
}

export function Value({ children }: { children: ReactNode }) {
  return <span className="font-semibold">{children}</span>
}

/** La cabecera de las hojas del evento (F3, F7): el título y «Listo» a la derecha. */
export function SheetHeader({ title, onDone }: { title: string; onDone: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="font-display text-xl font-extrabold tracking-[-0.02em]">{title}</p>
      <button
        type="button"
        onClick={onDone}
        className="h-9 rounded-lg px-1 font-display text-[15px] font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Listo
      </button>
    </div>
  )
}
