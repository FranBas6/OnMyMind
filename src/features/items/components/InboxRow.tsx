import { formatCaptureAge } from '@/lib/date'

import { checkboxState } from '../status'
import type { RowProps } from './TaskRow'
import { StatusCheckbox } from './StatusCheckbox'

/**
 * Fila de «En mente» (diseño 05, E1 y D1): solo el título y la antigüedad de la captura («hace
 * 2 h», «ayer», «martes»), debajo en móvil y a la derecha en escritorio. Sin prioridad ni fecha.
 * El botón «Mover a…» del diseño llega con mover ítems (1.8).
 */
export function InboxRow({ item, onToggle }: RowProps) {
  return (
    <li className="flex min-h-12 animate-in items-center gap-3 rounded-[18px] border border-border-soft bg-card px-4 py-2 duration-200 fade-in md:grid md:min-h-15 md:grid-cols-[24px_minmax(0,1fr)_auto] md:gap-4 md:rounded-2xl md:px-[18px] md:py-2.5">
      <StatusCheckbox
        state={checkboxState(item.status)}
        label={item.title}
        onToggle={() => {
          onToggle(item)
        }}
      />
      <div className="min-w-0 flex-1 md:contents">
        <p className="text-base leading-[1.3] font-medium wrap-break-word">{item.title}</p>
        <p className="mt-[3px] text-xs whitespace-nowrap text-subtle-foreground md:mt-0 md:text-[13px]">
          <span className="sr-only">Capturada </span>
          {formatCaptureAge(item.createdAt)}
        </p>
      </div>
    </li>
  )
}
