import { format } from 'date-fns'
import { Repeat } from 'lucide-react'

import { recurrenceLabel, type Completion } from '@/features/items'
import type { List } from '@/features/lists'
import { LIST_COLOR_BG } from '@/lib/listColors'
import { cn } from '@/lib/utils'

/**
 * La línea de una vez hecha de algo que se repite (diseño 21): hoy, cuándo vuelve y a qué hora se
 * hizo («↻ Vuelve el viernes 9 · 8:40», B12); otro día, su regla, la lista y la hora («↻ Mar y vie
 * · Casa · 8:40», B13).
 */
export function CompletionMeta({
  completion,
  list,
  past,
}: {
  completion: Completion
  list: List
  past: boolean
}) {
  const { item, doneAt } = completion
  const time = format(doneAt, 'H:mm')
  return (
    <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-subtle-foreground">
      <Repeat aria-hidden className="size-3 shrink-0" strokeWidth={2.4} />
      {past ? (
        <>
          <span className="truncate">{recurrenceLabel(item.recurrence, true)}</span>
          <span aria-hidden>·</span>
          <span
            aria-hidden
            className={cn('size-2 shrink-0 rounded-[3px]', LIST_COLOR_BG[list.color])}
          />
          <span className="truncate">
            {list.name} · {time}
          </span>
        </>
      ) : (
        <span className="truncate">
          {item.dueAt ? `Vuelve el ${format(item.dueAt, 'EEEE d')}` : 'Hecha'} · {time}
        </span>
      )}
    </p>
  )
}
