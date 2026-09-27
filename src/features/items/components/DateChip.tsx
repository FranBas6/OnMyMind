import { Calendar } from 'lucide-react'

import { formatDueDate } from '@/lib/date'
import { cn } from '@/lib/utils'

/**
 * Fecha límite de una tarea: «Hoy», «Mañana», «3 oct»; en rojo si es hoy o ya pasó. En móvil va
 * bajo el título con el icono de calendario (pantalla 4); en escritorio, en su columna alineada
 * a la derecha y sin icono (D1).
 */
export function DateChip({ date }: { date: Date }) {
  const { text, urgent } = formatDueDate(date)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap md:min-w-16 md:justify-end md:text-[13px]',
        urgent ? 'text-overdue' : 'text-muted-foreground',
      )}
    >
      <Calendar aria-hidden className="size-3 md:hidden" strokeWidth={2.4} />
      <span className="sr-only">Fecha límite: </span>
      {text}
    </span>
  )
}
