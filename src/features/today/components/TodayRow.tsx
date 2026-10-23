import {
  checkboxState,
  FileMeta,
  hasThumb,
  ItemRowDotsMenu,
  LinkMeta,
  RowThumb,
  RowTitle,
  rowHighlight,
  StatusCheckbox,
  SwipeableRow,
  useItemActions,
} from '@/features/items'
import { cn } from '@/lib/utils'
import { ItemPersonMark } from '@/features/sharing/components/ItemPersonMark'
import { useItemPerson } from '@/features/sharing/hooks/useSharing'

import { todayMeta, type TodayItem } from '../today'

/**
 * Fila de Hoy (pantalla 7): la de tarea, con el checkbox en el color de su lista y la meta en
 * texto («Vence hoy · Prioridad alta») en vez de chips. La atrasada lleva el borde rojo suave y el
 * chip «Atrasada · ayer». En escritorio, la rejilla del detalle de lista con la meta a la derecha
 * y el ···. Con foto, su miniatura; con enlace, su dominio en la meta (diseño 15, H1). Se toca,
 * se mantiene pulsada y se desliza igual que en su lista.
 */
export function TodayRow({
  item,
  now,
  otherDay = false,
}: {
  item: TodayItem
  now: Date
  /** En otro día de Hoy: «Vence ese día» y sin «Atrasada» (diseño 17, C2). */
  otherDay?: boolean
}) {
  const actions = useItemActions()
  const { overdue, detail } = todayMeta(item, now, actions.list.name, { otherDay })
  const thumb = hasThumb(item)
  // Una tarea de una lista compartida que añadió el otro, con su inicial (diseño 20, M6).
  const person = useItemPerson(item)
  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(
        'group relative flex min-h-14 animate-in items-start gap-3.5 rounded-[18px] border bg-card px-4 py-3.5 duration-200 fade-in hover:shadow-card md:grid md:items-center md:gap-4 md:rounded-2xl md:py-3 md:pr-3 md:pl-[18px]',
        thumb
          ? 'md:grid-cols-[24px_44px_minmax(0,1fr)_auto_32px]'
          : 'md:grid-cols-[24px_minmax(0,1fr)_auto_32px]',
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
      <RowThumb item={item} />
      <div className="min-w-0 flex-1 md:contents">
        <RowTitle item={item} />
        <p className="mt-[5px] flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted-foreground md:mt-0 md:justify-end md:text-[13px]">
          {person && (
            <span className="flex items-center">
              <ItemPersonMark person={person} item={item} />
            </span>
          )}
          {overdue && (
            <span className="rounded-lg bg-overdue-bg px-2 py-[3px] leading-4 font-bold whitespace-nowrap text-overdue">
              {overdue}
            </span>
          )}
          {item.url && <LinkMeta url={item.url} item={item} />}
          {detail && <span>{detail}</span>}
          {item.files.length > 0 && (
            <span className="flex items-center gap-2">
              {detail && <span aria-hidden>·</span>}
              <FileMeta item={item} />
            </span>
          )}
        </p>
      </div>
      {actions.isDesktop && <ItemRowDotsMenu item={item} />}
    </SwipeableRow>
  )
}
