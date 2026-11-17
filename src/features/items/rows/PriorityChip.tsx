import { cn } from '@/lib/utils'

import { PRIORITY_LABELS, type Priority } from '../fields'

const PRIORITY_CLASS: Record<Priority, string> = {
  high: 'bg-priority-high-bg text-priority-high',
  medium: 'bg-priority-medium-bg text-priority-medium',
  low: 'bg-priority-low-bg text-priority-low',
}

/** Chip de prioridad (Alta en rojo, Media en ámbar, Baja en gris), siempre con su texto. */
export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        'rounded-lg px-2 py-[3px] text-xs leading-4 font-semibold whitespace-nowrap',
        PRIORITY_CLASS[priority],
      )}
    >
      <span className="sr-only">Prioridad </span>
      {PRIORITY_LABELS[priority]}
    </span>
  )
}
