import type { ListKind } from '@/features/lists'

import { checkboxState } from '../status'
import type { Item } from '../types'
import { DateChip } from './DateChip'
import { PriorityChip } from './PriorityChip'
import { StatusCheckbox } from './StatusCheckbox'

export interface RowProps {
  item: Item
  kind: ListKind
  onToggle: (item: Item) => void
}

/**
 * Fila de una tarea (pantalla 4 v1 y D1). En móvil, el título y debajo los chips de prioridad y
 * fecha; en escritorio, una rejilla con los chips en sus columnas a la derecha, alineados entre
 * filas (un hueco vacío cuando falta uno). En fase 1 también es la fila básica de Compras y
 * Eventos, sin chips: sus pantallas llegan en la fase 2.
 */
export function TaskRow({ item, kind, onToggle }: RowProps) {
  const priority = kind === 'tasks' ? item.priority : null
  const dueAt = kind === 'tasks' ? item.dueAt : null

  return (
    <li className="flex min-h-14 animate-in items-start gap-3.5 rounded-[18px] border border-border-soft bg-card px-4 py-3.5 duration-200 fade-in md:grid md:grid-cols-[24px_minmax(0,1fr)_auto_auto] md:items-center md:gap-4 md:rounded-2xl md:px-[18px]">
      <StatusCheckbox
        state={checkboxState(item.status)}
        label={item.title}
        onToggle={() => {
          onToggle(item)
        }}
        className="mt-px md:mt-0"
      />
      <div className="min-w-0 flex-1 md:contents">
        <p className="text-base leading-[1.3] font-medium wrap-break-word">{item.title}</p>
        {(priority !== null || dueAt !== null) && (
          <div className="mt-1.5 flex items-center gap-2 md:contents">
            {priority ? <PriorityChip priority={priority} /> : <span className="hidden md:block" />}
            {dueAt ? <DateChip date={dueAt} /> : <span className="hidden md:block" />}
          </div>
        )}
      </div>
    </li>
  )
}
