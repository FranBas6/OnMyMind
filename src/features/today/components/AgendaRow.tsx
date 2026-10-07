import { Repeat } from 'lucide-react'

import {
  eventTime,
  hasThumb,
  isEarlierToday,
  ItemRowDotsMenu,
  RowThumb,
  RowTitle,
  rowHighlight,
  SwipeableRow,
  useItemActions,
} from '@/features/items'
import { recurrenceLabel } from '@/features/items/recurrence'
import { useNow } from '@/hooks/useNow'
import { LIST_COLOR_BG } from '@/lib/listColors'
import { cn } from '@/lib/utils'

import type { DayTense, TodayItem } from '../today'

/**
 * Un evento en la «Agenda» de Hoy (diseño 17, H1 y H2): la hora a la izquierda (o «Todo el día»),
 * una barra del color de su lista, el título y, debajo, la lista y la repetición («Agenda · ↻ Cada
 * año»). Uno cuya hora ya pasó va con la hora y el título en gris y la barra más clara; en un día
 * pasado (diseño 17, C4), todos. Va en el `ListScope` de su lista: se toca, se mantiene pulsado y
 * se desliza igual que en ella.
 */
export function AgendaRow({ item, tense = 'today' }: { item: TodayItem; tense?: DayTense }) {
  const actions = useItemActions()
  // La hora de verdad (no el día de Hoy): pasada la suya, la fila se apaga sola.
  const now = new Date(useNow(60_000))
  const { list } = actions
  const time = eventTime(item)
  const earlier = tense === 'past' || (tense === 'today' && isEarlierToday(item, now))
  const route = item.parent ? `${list.name} › ${item.parent.title}` : list.name
  const repeat = recurrenceLabel(item.recurrence, true)
  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(
        'group relative flex min-h-14 animate-in items-center gap-3.5 rounded-[18px] border border-border-soft bg-card px-4 py-3 duration-200 fade-in hover:border-border hover:shadow-card md:grid md:gap-4 md:rounded-2xl md:pr-3 md:pl-[18px]',
        hasThumb(item)
          ? 'md:grid-cols-[56px_3px_44px_minmax(0,1fr)_32px]'
          : 'md:grid-cols-[56px_3px_minmax(0,1fr)_32px]',
        rowHighlight(actions, item),
      )}
    >
      <span className="block w-14 shrink-0 leading-tight">
        {time ? (
          <span
            className={cn(
              'font-display text-[17px] font-extrabold tracking-[-0.01em]',
              earlier && 'text-subtle-foreground',
            )}
          >
            <span className="sr-only">A las </span>
            {time}
          </span>
        ) : (
          <span className="block text-xs leading-tight font-semibold text-muted-foreground">
            Todo
            <br />
            el día
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          'w-[3px] self-stretch rounded-full',
          LIST_COLOR_BG[list.color],
          earlier && 'opacity-40',
        )}
      />
      <RowThumb item={item} />
      <div className="min-w-0 flex-1">
        <RowTitle item={item} className={cn(earlier && 'text-subtle-foreground')} />
        <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground md:text-[13px]">
          <span className="truncate">{route}</span>
          {repeat && (
            <>
              <span aria-hidden>·</span>
              <Repeat aria-hidden className="size-3 shrink-0" strokeWidth={2.4} />
              <span className="truncate">{repeat}</span>
            </>
          )}
        </p>
      </div>
      {actions.isDesktop && <ItemRowDotsMenu item={item} />}
    </SwipeableRow>
  )
}
