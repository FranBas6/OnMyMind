import { ArrowRightLeft, ChevronDown } from 'lucide-react'

import { formatCaptureAge } from '@/lib/date'
import { cn } from '@/lib/utils'

import { checkboxState } from '../status'
import type { Item } from '../types'
import { rowHighlight, useItemActions } from './itemActionsContext'
import { hasThumb } from '../photos'
import { LinkMeta, RowThumb } from './RowMedia'
import { RowTitle } from './RowTitle'
import { StatusCheckbox } from './StatusCheckbox'
import { SwipeableRow } from './SwipeableRow'

/**
 * Fila de «En mente» (diseño 05, E1 y D1): el título y la antigüedad de la captura («hace 2 h»,
 * «ayer», «martes»), debajo en móvil y a la derecha en escritorio, sin prioridad ni fecha. A la
 * derecha, «Mover a…», la acción principal de la inbox: en móvil un botón de 40 px con el icono;
 * en escritorio, con texto. Tocar la fila abre el detalle; mantenerla pulsada, el menú; deslizarla,
 * sus acciones. Con foto, su miniatura tras el checkbox; con enlace, su dominio delante de la
 * antigüedad (diseño 15, L1 y D1).
 */
export function InboxRow({ item }: { item: Item }) {
  const actions = useItemActions()
  const thumb = hasThumb(item)
  const link = item.url ? <LinkMeta url={item.url} item={item} /> : null
  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(
        'relative flex min-h-12 animate-in items-center gap-3 rounded-[18px] border border-border-soft bg-card py-2 pr-2.5 pl-4 duration-200 fade-in hover:border-border hover:shadow-card md:grid md:min-h-15 md:gap-4 md:rounded-2xl md:py-2.5 md:pl-[18px]',
        thumb
          ? 'md:grid-cols-[24px_44px_minmax(0,1fr)_auto_auto]'
          : 'md:grid-cols-[24px_minmax(0,1fr)_auto_auto]',
        rowHighlight(actions, item),
      )}
    >
      <StatusCheckbox
        state={checkboxState(item.status)}
        label={item.title}
        onToggle={() => {
          actions.toggle(item)
        }}
        className="z-10"
      />
      <RowThumb item={item} />
      <div className="min-w-0 flex-1 md:contents">
        <div className="min-w-0">
          <RowTitle item={item} />
          {link && (
            <p className="mt-0.5 hidden text-[13px] font-semibold text-muted-foreground md:flex">
              {link}
            </p>
          )}
        </div>
        <p className="mt-[3px] flex min-w-0 items-center gap-1.5 text-xs whitespace-nowrap text-subtle-foreground md:mt-0 md:text-[13px]">
          {link && (
            <span className="flex min-w-0 items-center gap-1.5 font-semibold text-muted-foreground md:hidden">
              {link}
              <span aria-hidden>·</span>
            </span>
          )}
          <span className="sr-only">Capturada </span>
          {formatCaptureAge(item.createdAt)}
        </p>
      </div>
      <button
        type="button"
        aria-label={actions.isDesktop ? undefined : `Mover «${item.title}» a…`}
        onClick={(event) => {
          actions.startMove(item, event.currentTarget)
        }}
        className="relative z-10 flex size-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-tint font-display text-[13px] font-bold whitespace-nowrap text-primary-strong outline-none hover:bg-primary/20 focus-visible:ring-[3px] focus-visible:ring-ring/50 md:w-auto md:pr-3.5 md:pl-3"
      >
        <ArrowRightLeft aria-hidden className="size-[18px] md:size-4" strokeWidth={2.2} />
        <span className="hidden md:inline">Mover a…</span>
        <ChevronDown aria-hidden className="hidden size-3.5 md:block" strokeWidth={2.2} />
      </button>
    </SwipeableRow>
  )
}
