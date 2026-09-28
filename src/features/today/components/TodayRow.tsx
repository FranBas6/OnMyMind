import {
  checkboxState,
  ItemRowDotsMenu,
  RowTitle,
  rowHighlight,
  StatusCheckbox,
  SwipeableRow,
  useItemActions,
  type Item,
} from '@/features/items'
import { cn } from '@/lib/utils'

import { todayMeta } from '../today'

/**
 * Fila de Hoy (pantalla 7): la de tarea, con el checkbox en el color de su lista y la meta en
 * texto («Vence hoy · Prioridad alta») en vez de chips. La atrasada lleva el borde rojo suave y el
 * chip «Atrasada · ayer». En escritorio, la rejilla del detalle de lista con la meta a la derecha
 * y el ···. Se toca, se mantiene pulsada y se desliza igual que en su lista.
 */
export function TodayRow({ item, now }: { item: Item; now: Date }) {
  const actions = useItemActions()
  const { overdue, detail } = todayMeta(item, now)
  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(
        'group relative flex min-h-14 animate-in items-start gap-3.5 rounded-[18px] border bg-card px-4 py-3.5 duration-200 fade-in hover:shadow-card md:grid md:grid-cols-[24px_minmax(0,1fr)_auto_32px] md:items-center md:gap-4 md:rounded-2xl md:py-3 md:pr-3 md:pl-[18px]',
        overdue ? 'border-[1.5px] border-overdue-border' : 'border-border-soft hover:border-border',
        rowHighlight(actions, item),
      )}
    >
      <StatusCheckbox
        state={checkboxState(item.status)}
        label={item.title}
        tone={actions.list.color}
        onToggle={() => {
          actions.toggle(item)
        }}
        className="z-10 mt-px md:mt-0"
      />
      <div className="min-w-0 flex-1 md:contents">
        <RowTitle item={item} />
        <p className="mt-[5px] flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted-foreground md:mt-0 md:justify-end md:text-[13px]">
          {overdue && (
            <span className="rounded-lg bg-overdue-bg px-2 py-[3px] leading-4 font-bold whitespace-nowrap text-overdue">
              {overdue}
            </span>
          )}
          {detail && <span>{detail}</span>}
        </p>
      </div>
      {actions.isDesktop && <ItemRowDotsMenu item={item} />}
    </SwipeableRow>
  )
}
