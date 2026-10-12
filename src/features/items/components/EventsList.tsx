import { useId, useState } from 'react'

import { tallyLabel } from '@/features/lists'

import { groupEvents, type EventGroup } from '../events'
import { filterEvents, type EventFilter } from '../filters'
import { countItems } from '../sublists'
import type { Item } from '../types'
import { EventRow } from './EventRow'
import { ItemRow } from './ItemRow'
import { EventsEmpty } from './ItemsEmptyState'
import { FoldHeading, OutOfMindSection } from './OutOfMindSection'

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
 * La vista Agenda de una lista (pantalla 10 y diseño 17, E1–E7 y D1; diseño 25, B10b y D5): lo que
 * tiene día, por días (los eventos y las tareas con fecha) y lo lejano por meses; lo demás (notas,
 * compras, lo que aún no tiene día), arriba en «Sin fecha», plegado. Debajo, «Fuera de la cabeza»
 * con lo pasado, lo hecho y lo cancelado. Los filtros enseñan los eventos que vienen, los que ya
 * pasaron (lo más reciente arriba) y los cancelados, cada uno con su vacío.
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
    const dated = active.filter((item) => item.kind !== 'note' && item.dueAt !== null)
    const undated = active.filter((item) => !dated.includes(item))
    return (
      <>
        {undated.length > 0 && <Undated items={undated} />}
        <Groups groups={groupEvents(dated)} />
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

/**
 * «Sin fecha · 1 nota» (diseño 25, B10b y D5): lo que no tiene día, plegado arriba. Se abre solo
 * cuando entra algo (lo que se acaba de añadir sin día), para que se vea dónde ha ido.
 */
function Undated({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false)
  const [known, setKnown] = useState(items.length)
  const listId = useId()
  if (items.length !== known) {
    setKnown(items.length)
    if (items.length > known) setOpen(true)
  }
  return (
    <section aria-label="Sin fecha" className="-my-1 flex flex-col">
      <FoldHeading
        open={open}
        controls={listId}
        onToggle={() => {
          setOpen((current) => !current)
        }}
      >
        Sin fecha{' '}
        <span className="font-semibold text-subtle-foreground">
          · {tallyLabel('list', { ...countItems(items), done: 0 }, { empty: things(items.length) })}
        </span>
      </FoldHeading>
      {open && (
        <ul id={listId} aria-label="Sin fecha" className="mt-1 flex flex-col gap-2">
          {items.map((item) =>
            item.kind === 'event' ? (
              <EventRow key={item.id} item={item} />
            ) : (
              <ItemRow key={item.id} item={item} />
            ),
          )}
        </ul>
      )}
    </section>
  )
}

const things = (count: number) => `${count} ${count === 1 ? 'cosa' : 'cosas'}`

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
        {group.items.map((item) =>
          item.kind === 'event' ? (
            <EventRow key={item.id} item={item} byMonth={group.byMonth} />
          ) : (
            <ItemRow key={item.id} item={item} />
          ),
        )}
      </ul>
    </section>
  )
}
