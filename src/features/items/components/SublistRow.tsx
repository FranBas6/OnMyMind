import { ChevronRight, Pause } from 'lucide-react'

import { cn } from '@/lib/utils'

import { useItems } from '../hooks/useItems'
import { childrenOf, sublistMeta } from '../sublists'
import type { Item } from '../types'
import { rowHighlight, useItemActions } from './itemActionsContext'
import { ItemRowDotsMenu } from './ItemRowMenu'
import { RowTitle } from './RowTitle'
import { SublistIcon } from './SublistIcon'
import { SwipeableRow } from './SwipeableRow'

/**
 * Fila de una sublista en su lista (diseño 12, S1, S8 y D4): el icono en el color de la lista, el
 * nombre en 600 y lo suyo debajo («5 pendientes · En curso»), con el punto verde si está en curso,
 * la pausa si está pausada (atenuada) y el chevron: tocarla la abre. Se desliza y tiene su menú
 * como cualquier fila. Hecha, va en «Fuera de la cabeza» sin tarjeta, tachada y con «Hecha · 6
 * dentro». Lo de dentro sale de los ítems de la lista, que ya están en caché.
 */
export function SublistRow({ item, done = false }: { item: Item; done?: boolean }) {
  const actions = useItemActions()
  const { list, isDesktop } = actions
  const { data: items = [] } = useItems(item.listId)
  const paused = item.status === 'paused'
  const meta = sublistMeta(item, childrenOf(items, item.id))

  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(
        'group relative flex animate-in items-center gap-3.5 duration-200 fade-in md:gap-4',
        done
          ? 'min-h-12 rounded-[18px] bg-background px-4 py-2.5 hover:bg-fill md:rounded-2xl md:px-[18px]'
          : 'min-h-14 rounded-[18px] border border-border-soft bg-card py-3.5 pr-3 pl-4 hover:border-border hover:shadow-card md:rounded-2xl md:py-3 md:pl-[18px]',
        rowHighlight(actions, item),
      )}
    >
      <SublistIcon
        color={list.color}
        state={done ? 'done' : paused ? 'paused' : 'active'}
        className="mt-px"
      />
      <div className="min-w-0 flex-1">
        <RowTitle
          item={item}
          className={cn(
            'truncate font-semibold',
            done && 'text-subtle-foreground line-through',
            paused && 'text-muted-foreground',
          )}
        />
        <p
          className={cn(
            'mt-[5px] text-xs font-semibold md:text-[13px]',
            paused ? 'text-subtle-foreground' : 'text-muted-foreground',
          )}
        >
          <span className="sr-only">Sublista: </span>
          {meta}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-2">
        {item.status === 'in_progress' && !done && (
          <span aria-hidden className="size-2 rounded-full bg-in-progress" />
        )}
        {paused && (
          <Pause
            aria-hidden
            className="size-3 fill-current text-subtle-foreground"
            strokeWidth={0}
          />
        )}
        {isDesktop && <ItemRowDotsMenu item={item} />}
        <ChevronRight aria-hidden className="size-4 text-control" strokeWidth={2.2} />
      </span>
    </SwipeableRow>
  )
}
