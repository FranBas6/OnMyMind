import { ChevronRight } from 'lucide-react'

import {
  hasThumb,
  ItemControl,
  LinkMeta,
  RowThumb,
  RowTitle,
  rowHighlight,
  SublistIcon,
  sublistMeta,
  SwipeableRow,
  useItemActions,
} from '@/features/items'
import { cn } from '@/lib/utils'

import { resultMeta, type SearchResult } from '../search'
import { Highlight } from './Highlight'

/**
 * Un resultado (pantalla 13 y diseño 08): la fila de tarea con el control de su tipo (diseño 12),
 * el término resaltado, el fragmento de la nota si la coincidencia está ahí, y el estado con su
 * fecha («En curso · Mañana»); lo de dentro de una sublista lleva su ruta delante («Viajes ›
 * Lisboa · 12 oct · 07:45», A2). Lo terminado va tachado en `subtle`. En escritorio, rejilla con
 * el estado a la derecha. Se toca, se completa y se desliza como en su lista.
 */
export function SearchResultRow({ result, now }: { result: SearchResult; now: Date }) {
  const actions = useItemActions()
  const { item, titleRanges, snippet, done, parent } = result
  if (item.kind === 'sublist') return <SublistResultRow result={result} />
  const route = parent ? `${actions.list.name} › ${parent.title}` : undefined
  const thumb = hasThumb(item)
  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(
        'group relative flex min-h-14 animate-in items-start gap-3.5 rounded-[18px] border border-border-soft bg-card px-4 py-[13px] duration-200 fade-in hover:border-border hover:shadow-card md:grid md:items-center md:rounded-2xl md:py-3 md:pr-[18px] md:pl-[18px]',
        thumb
          ? 'md:grid-cols-[24px_44px_minmax(0,1fr)_auto]'
          : 'md:grid-cols-[24px_minmax(0,1fr)_auto]',
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
        <div className="min-w-0">
          <RowTitle item={item} className={cn(done && 'text-subtle-foreground line-through')}>
            <Highlight text={item.title} ranges={titleRanges} />
          </RowTitle>
          {snippet && (
            <p className="mt-1 truncate text-[13px] leading-[1.4] text-muted-foreground md:mt-[3px]">
              <Highlight text={snippet.text} ranges={snippet.ranges} />
            </p>
          )}
        </div>
        <p className="mt-[5px] flex min-w-0 flex-wrap items-center gap-x-2 text-xs font-semibold text-muted-foreground md:mt-0 md:text-[13px] md:whitespace-nowrap">
          {item.url && <LinkMeta url={item.url} />}
          <span>{resultMeta(item, now, route)}</span>
        </p>
      </div>
    </SwipeableRow>
  )
}

/**
 * Una sublista como resultado (diseño 12, A2): su icono en el color de la lista, el nombre con lo
 * buscado resaltado, «Sublista · 5 pendientes · En curso» y el chevron; tocarla entra en ella.
 */
function SublistResultRow({ result }: { result: SearchResult }) {
  const actions = useItemActions()
  const { item, titleRanges, done, children } = result
  const paused = item.status === 'paused'
  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(
        'group relative flex min-h-14 animate-in items-center gap-3.5 rounded-[18px] border border-border-soft bg-card py-[13px] pr-3 pl-4 duration-200 fade-in hover:border-border hover:shadow-card md:rounded-2xl md:py-3 md:pl-[18px]',
        rowHighlight(actions, item),
      )}
    >
      <SublistIcon
        color={actions.list.color}
        state={done ? 'done' : paused ? 'paused' : 'active'}
      />
      <div className="min-w-0 flex-1">
        <RowTitle
          item={item}
          className={cn(
            'font-semibold',
            done && 'text-subtle-foreground line-through',
            paused && 'text-muted-foreground',
          )}
        >
          <Highlight text={item.title} ranges={titleRanges} />
        </RowTitle>
        <p className="mt-[5px] text-xs font-semibold text-muted-foreground md:text-[13px]">
          Sublista · {sublistMeta(item, children)}
        </p>
      </div>
      {item.status === 'in_progress' && (
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-in-progress" />
      )}
      <ChevronRight aria-hidden className="size-4 shrink-0 text-control" strokeWidth={2.2} />
    </SwipeableRow>
  )
}
