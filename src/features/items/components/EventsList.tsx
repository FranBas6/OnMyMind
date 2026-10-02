import { useId } from 'react'

import { groupEvents, type EventGroup } from '../events'
import { filterEvents, type EventFilter } from '../filters'
import type { Item } from '../types'
import { EventRow } from './EventRow'
import { ItemRow } from './ItemRow'
import { EventsEmpty } from './ItemsEmptyState'
import { OutOfMindSection } from './OutOfMindSection'

interface EventsListProps {
  /** Lo que sigue en la cabeza (`splitItems`), con lo recién cancelado aún en su sitio. */
  active: Item[]
  /** «Fuera de la cabeza»: lo pasado y lo cancelado. */
  outOfMind: Item[]
  /** Todo lo de la lista o sublista: los filtros miran también lo que ya está fuera. */
  all: readonly Item[]
  filter: EventFilter
  empty: boolean
  isDesktop: boolean
}

/**
 * Una lista de eventos (pantalla 10 y diseño 17, E1–E7 y D1): agrupada por días, con «Sin fecha»
 * arriba y lo lejano por meses; debajo, «Fuera de la cabeza» con lo pasado y lo cancelado. Los
 * filtros enseñan lo que viene, lo que ya pasó (lo más reciente arriba) y lo cancelado, cada uno con
 * su vacío. Si se cuela algo que no es un evento (una tarea movida aquí), va arriba, en su fila.
 */
export function EventsList({ active, outOfMind, all, filter, empty, isDesktop }: EventsListProps) {
  if (empty) {
    return (
      <EventsEmpty title="Aún no hay nada aquí.">
        Escribe {isDesktop ? 'arriba' : 'abajo'} y ponle día en su ficha. Sin día, se queda arriba
        en «Sin fecha».
      </EventsEmpty>
    )
  }

  if (filter === 'all') {
    const others = active.filter((item) => item.kind !== 'event')
    const events = active.filter((item) => item.kind === 'event')
    return (
      <>
        {others.length > 0 && (
          <ul aria-label="Ítems" className="flex flex-col gap-2">
            {others.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
        <Groups groups={groupEvents(events)} />
        {outOfMind.length > 0 && <OutOfMindSection items={outOfMind} defaultOpen={false} />}
      </>
    )
  }

  const shown = filterEvents(all, filter)
  if (shown.length === 0) {
    return filter === 'upcoming' ? (
      <EventsEmpty title="Nada a la vista.">
        Lo que añadas con día saldrá aquí, ordenado por días.
      </EventsEmpty>
    ) : filter === 'past' ? (
      <EventsEmpty title="Nada ha pasado aún.">
        Lo que ya pasó baja aquí solo, al acabar su día.
      </EventsEmpty>
    ) : (
      <EventsEmpty title="Nada cancelado.">
        Lo que canceles se queda aquí, por si vuelve.
      </EventsEmpty>
    )
  }
  return <Groups groups={groupEvents(shown, new Date(), { newestFirst: filter === 'past' })} />
}

function Groups({ groups }: { groups: EventGroup<Item>[] }) {
  return (
    <div className="flex flex-col gap-[18px]">
      {groups.map((group) => (
        <Group key={group.key} group={group} />
      ))}
    </div>
  )
}

/** Un día (o un mes, o «Sin fecha») con su etiqueta, como las secciones de Hoy. */
function Group({ group }: { group: EventGroup<Item> }) {
  const labelId = useId()
  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <h2
        id={labelId}
        className="px-1 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase"
      >
        {group.label}
      </h2>
      <ul aria-label={group.label} className="flex flex-col gap-2">
        {group.items.map((item) => (
          <EventRow key={item.id} item={item} byMonth={group.byMonth} />
        ))}
      </ul>
    </section>
  )
}
