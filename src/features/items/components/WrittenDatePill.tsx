import { Bell, Calendar, Undo2, X } from 'lucide-react'
import type { MouseEvent } from 'react'

import { cn } from '@/lib/utils'

import type { WrittenDateState } from '../hooks/useWrittenDate'
import type { ItemKind } from '../status'
import { writtenDateLabel } from '../writtenDate'

// Tocar la pastilla no le quita el foco al campo: en iOS se cerraría el teclado.
const keepFocus = (event: MouseEvent) => {
  event.preventDefault()
}

/**
 * Lo que se entendió de la fecha escrita (diseño 21, A1–A3 y A5): una pastilla índigo de 40 px con
 * el día («Vie 9 oct · 21:00»; en una tarea, «Vence mié 7» y aparte «🔔 Aviso 10:00») y su ✕. No
 * hay que tocarla para guardar; tocarla entera la deshace, y deshecha pasa a una línea discontinua,
 * «Sin fecha · se guarda tal cual», que al tocarla lo vuelve a entender.
 */
export function WrittenDatePill({
  state,
  kind,
  className,
}: {
  state: WrittenDateState
  kind: ItemKind | null
  className?: string
}) {
  const { understood, undone, toggle } = state
  if (!understood || !kind) return null

  if (undone) {
    return (
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={toggle}
        aria-label="Sin fecha: se guarda tal cual. Volver a entender la fecha"
        className={cn(
          'inline-flex h-10 max-w-full shrink-0 items-center gap-2 self-start rounded-full border-[1.5px] border-dashed border-control px-3.5 text-sm font-semibold whitespace-nowrap text-muted-foreground outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50',
          className,
        )}
      >
        <Undo2 aria-hidden className="size-4 shrink-0" strokeWidth={2.2} />
        Sin fecha · se guarda tal cual
      </button>
    )
  }

  const label = writtenDateLabel(understood.written, kind)
  return (
    <button
      type="button"
      onMouseDown={keepFocus}
      onClick={toggle}
      aria-label={`${label.day}${label.reminder ? `, ${label.reminder}` : ''}. Quitar la fecha`}
      className={cn(
        'inline-flex h-10 max-w-full shrink-0 items-center gap-2 self-start rounded-full bg-brand-tint pr-2 pl-3.5 text-sm font-semibold whitespace-nowrap text-primary-strong outline-none hover:bg-brand-tint/80 focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <Calendar aria-hidden className="size-4 shrink-0" strokeWidth={2.2} />
      <span className="flex min-w-0 items-center gap-1.5 truncate">
        {label.day}
        {label.reminder && (
          <>
            <span aria-hidden className="opacity-50">
              ·
            </span>
            <Bell aria-hidden className="size-3.5 shrink-0" strokeWidth={2.2} />
            {label.reminder}
          </>
        )}
      </span>
      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full opacity-75">
        <X className="size-4" strokeWidth={2.4} />
      </span>
    </button>
  )
}
