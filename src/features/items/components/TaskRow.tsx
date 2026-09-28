import { cn } from '@/lib/utils'

import { checkboxState } from '../status'
import type { Item } from '../types'
import { DateChip } from './DateChip'
import { rowHighlight, useItemActions } from './itemActionsContext'
import { ItemRowDotsMenu } from './ItemRowMenu'
import { PriorityChip } from './PriorityChip'
import { RowTitle } from './RowTitle'
import { StatusCheckbox } from './StatusCheckbox'
import { SwipeableRow } from './SwipeableRow'

/**
 * Fila de una tarea (pantalla 4 v1 y D1). En móvil, el título y debajo los chips de prioridad y
 * fecha; en escritorio, una rejilla con los chips en sus columnas a la derecha, alineados entre
 * filas (un hueco vacío cuando falta uno), y el ··· del menú al final (diseño 06, D8). Tocar la
 * fila abre el detalle; mantenerla pulsada, el menú; deslizarla, sus acciones (`SwipeableRow`). En fase 1 también es la fila básica de
 * Compras y Eventos, sin chips: sus pantallas llegan en la fase 2.
 */
export function TaskRow({ item }: { item: Item }) {
  const actions = useItemActions()
  const { list, isDesktop } = actions
  const priority = list.kind === 'tasks' ? item.priority : null
  const dueAt = list.kind === 'tasks' ? item.dueAt : null
  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(
        'group relative flex min-h-14 animate-in items-start gap-3.5 rounded-[18px] border border-border-soft bg-card px-4 py-3.5 duration-200 fade-in md:grid md:grid-cols-[24px_minmax(0,1fr)_auto_auto_32px] md:items-center md:gap-4 md:rounded-2xl md:py-3 md:pr-3 md:pl-[18px]',
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
        <RowTitle item={item} />
        {(priority !== null || dueAt !== null) && (
          <div className="mt-1.5 flex items-center gap-2 md:contents">
            {priority ? <PriorityChip priority={priority} /> : <span className="hidden md:block" />}
            {dueAt ? <DateChip date={dueAt} /> : <span className="hidden md:block" />}
          </div>
        )}
      </div>
      {isDesktop && <ItemRowDotsMenu item={item} />}
    </SwipeableRow>
  )
}
