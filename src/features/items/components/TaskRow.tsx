import { formatEventDate } from '@/lib/date'
import { cn } from '@/lib/utils'

import { kindMark } from '../kind'
import type { Item } from '../types'
import { DateChip } from './DateChip'
import { ItemControl } from './ItemControl'
import { rowHighlight, useItemActions } from './itemActionsContext'
import { ItemRowDotsMenu } from './ItemRowMenu'
import { itemPrice } from '../prices'
import { PriorityChip } from './PriorityChip'
import { hasThumb } from '../photos'
import { LinkMeta, RowPrice, RowThumb } from './RowMedia'
import { RowTitle } from './RowTitle'
import { SwipeableRow } from './SwipeableRow'

const META = 'text-xs font-semibold whitespace-nowrap text-muted-foreground md:text-[13px]'

/** La rejilla de escritorio: con miniatura, una columna de 44 px; con precios, la de 96 px. */
const GRID = {
  plain: 'md:grid-cols-[24px_minmax(0,1fr)_auto_auto_32px]',
  thumb: 'md:grid-cols-[24px_44px_minmax(0,1fr)_auto_auto_32px]',
  prices: 'md:grid-cols-[24px_minmax(0,1fr)_auto_auto_96px_32px]',
  thumbPrices: 'md:grid-cols-[24px_44px_minmax(0,1fr)_auto_auto_96px_32px]',
} as const

/**
 * Fila de tarea (pantalla 4 v1 y D1), que también es la de las compras y los eventos hasta sus
 * pantallas (2.1 y 2.3). El tipo es del ítem, no de la lista (diseño 12): cambia el control de la
 * izquierda (`ItemControl`) y lo de debajo del título. La tarea lleva sus chips de prioridad y
 * fecha; el evento, su día y su hora; y si no hay nada que enseñar y el ítem no es del tipo por
 * defecto de su lista, el nombre del tipo («Compra»). En escritorio, una rejilla con eso en sus
 * columnas a la derecha, alineadas entre filas, y el ··· del menú al final (diseño 06, D8). Con
 * foto, su miniatura tras el control; con enlace, su dominio en la meta (diseño 15). Una compra con
 * precio lo lleva a la derecha, y en escritorio en la última columna, que reservan todas las filas
 * de una lista con precios (diseño 16, A1 y D2). Tocar
 * la fila abre el detalle; mantenerla pulsada, el menú; deslizarla, sus acciones (`SwipeableRow`).
 */
export function TaskRow({ item }: { item: Item }) {
  const actions = useItemActions()
  const { list, isDesktop } = actions
  const task = item.kind === 'task'
  const priority = task ? item.priority : null
  const dueAt = task ? item.dueAt : null
  const eventDate =
    item.kind === 'event' && item.dueAt ? formatEventDate(item.dueAt, item.allDay) : null
  const mark =
    priority === null && dueAt === null && eventDate === null
      ? kindMark(item.kind, list.kind)
      : null
  const first = priority ? (
    <PriorityChip priority={priority} />
  ) : mark ? (
    <span className={META}>{mark}</span>
  ) : null
  const second = dueAt ? (
    <DateChip date={dueAt} />
  ) : eventDate ? (
    <span className={cn(META, 'md:min-w-16 md:text-right')}>
      <span className="sr-only">Fecha: </span>
      {eventDate}
    </span>
  ) : null
  const thumb = hasThumb(item)
  const link = item.url ? <LinkMeta url={item.url} item={item} className={META} /> : null
  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(
        'group relative flex min-h-14 animate-in items-start gap-3.5 rounded-[18px] border border-border-soft bg-card px-4 py-3.5 duration-200 fade-in hover:border-border hover:shadow-card md:grid md:items-center md:gap-4 md:rounded-2xl md:py-3 md:pr-3 md:pl-[18px]',
        actions.prices ? (thumb ? GRID.thumbPrices : GRID.prices) : thumb ? GRID.thumb : GRID.plain,
        rowHighlight(actions, item),
      )}
    >
      <ItemControl
        item={item}
        onToggle={() => {
          actions.toggle(item)
        }}
        className="z-10 mt-px md:mt-0"
      />
      <RowThumb item={item} />
      <div className="min-w-0 flex-1 md:contents">
        {/* En escritorio el enlace va bajo el título; las columnas de la derecha no cambian. */}
        <div className="min-w-0">
          <RowTitle item={item} />
          {link && <p className="mt-0.5 hidden md:flex">{link}</p>}
        </div>
        {first || second || link ? (
          <div className="mt-1.5 flex min-w-0 items-center gap-2 md:contents">
            {first ?? <span className="hidden md:block" />}
            {link && <span className="flex min-w-0 md:hidden">{link}</span>}
            {second ?? <span className="hidden md:block" />}
          </div>
        ) : (
          // Sin nada debajo del título, sus dos columnas siguen ahí: lo de la derecha no se mueve.
          <>
            <span className="hidden md:block" />
            <span className="hidden md:block" />
          </>
        )}
      </div>
      <RowPrice item={item} className="md:w-full" />
      {actions.prices && !itemPrice(item) && <span className="hidden md:block" />}
      {isDesktop && <ItemRowDotsMenu item={item} />}
    </SwipeableRow>
  )
}
