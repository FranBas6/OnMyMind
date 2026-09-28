import {
  checkboxState,
  RowTitle,
  rowHighlight,
  StatusCheckbox,
  SwipeableRow,
  useItemActions,
} from '@/features/items'
import { cn } from '@/lib/utils'

import { resultMeta, type SearchResult } from '../search'
import { Highlight } from './Highlight'

/**
 * Un resultado (pantalla 13 y diseño 08): la fila de tarea con el término resaltado, el fragmento
 * de la nota si la coincidencia está ahí, y el estado con su fecha («En curso · Mañana»). Lo
 * terminado va tachado en `subtle`. En escritorio, rejilla con el estado a la derecha. Se toca,
 * se completa y se desliza como en su lista.
 */
export function SearchResultRow({ result, now }: { result: SearchResult; now: Date }) {
  const actions = useItemActions()
  const { item, titleRanges, snippet, done } = result
  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(
        'group relative flex min-h-14 animate-in items-start gap-3.5 rounded-[18px] border border-border-soft bg-card px-4 py-[13px] duration-200 fade-in hover:border-border hover:shadow-card md:grid md:grid-cols-[24px_minmax(0,1fr)_auto] md:items-center md:rounded-2xl md:py-3 md:pr-[18px] md:pl-[18px]',
        rowHighlight(actions, item),
      )}
    >
      <StatusCheckbox
        state={checkboxState(item.status)}
        label={item.title}
        onToggle={() => {
          actions.toggle(item)
        }}
        className="z-10 mt-px md:mt-0"
      />
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
        <p className="mt-[5px] text-xs font-semibold text-muted-foreground md:mt-0 md:text-[13px] md:whitespace-nowrap">
          {resultMeta(item, actions.list, now)}
        </p>
      </div>
    </SwipeableRow>
  )
}
