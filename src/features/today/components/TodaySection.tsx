import { useId } from 'react'

import { ListScope } from '@/features/items'
import { LIST_COLOR_BG } from '@/lib/listColors'
import { cn } from '@/lib/utils'

import type { TodaySection as Section } from '../today'
import { TodayRow } from './TodayRow'

/**
 * Una lista dentro de Hoy (pantalla 7): la etiqueta de sección con el cuadrado en el color de la
 * lista y sus filas. El diseño pinta también el texto en ese color, pero así no llega a AA en
 * ninguno salvo índigo (el ámbar se queda en 2,2:1): el color va en el cuadrado y el texto en
 * `muted`, como el resto de etiquetas de sección.
 */
export function TodaySection({
  section,
  now,
  otherDay = false,
}: {
  section: Section
  now: Date
  otherDay?: boolean
}) {
  const { list, items } = section
  const labelId = useId()
  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2.5">
      <h2
        id={labelId}
        className="flex items-center gap-2 px-1 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase"
      >
        <span aria-hidden className={cn('size-2.5 rounded-[3px]', LIST_COLOR_BG[list.color])} />
        {list.name}
      </h2>
      <ListScope list={list}>
        <ul aria-label={list.name} className="flex flex-col gap-2.5">
          {items.map((item) => (
            <TodayRow key={item.id} item={item} now={now} otherDay={otherDay} />
          ))}
        </ul>
      </ListScope>
    </section>
  )
}
