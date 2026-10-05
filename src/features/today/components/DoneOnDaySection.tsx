import { useId } from 'react'

import { DoneRow, ListScope } from '@/features/items'
import { LIST_COLOR_BG } from '@/lib/listColors'
import { cn } from '@/lib/utils'

import type { TodayDone } from '../today'

/**
 * «Hecho ese día» (diseño 17, C4 y D6): en un día pasado, lo que se terminó ese día, de cualquier
 * lista; la prueba de que se fue de la cabeza. Abierta, no plegada como «2 hechas hoy». Cada fila
 * tachada lleva debajo su lista con su color, y el checkbox la devuelve a pendiente.
 */
export function DoneOnDaySection({ done }: { done: readonly TodayDone[] }) {
  const labelId = useId()
  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <h2
        id={labelId}
        className="px-1 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase"
      >
        Hecho ese día
      </h2>
      <ul aria-label="Hecho ese día" className="flex flex-col gap-0.5">
        {done.map(({ item, list }) => (
          <ListScope key={item.id} list={list}>
            <DoneRow
              item={item}
              muted={false}
              meta={
                <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-subtle-foreground">
                  <span
                    aria-hidden
                    className={cn('size-2 shrink-0 rounded-[3px]', LIST_COLOR_BG[list.color])}
                  />
                  <span className="truncate">{list.name}</span>
                </p>
              }
            />
          </ListScope>
        ))}
      </ul>
    </section>
  )
}
