import { ArrowRightLeft, ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

import { formatCaptureAge } from '@/lib/date'
import { cn } from '@/lib/utils'
import { ItemPersonMark } from '@/features/sharing/components/ItemPersonMark'
import { useItemPerson } from '@/features/sharing/hooks/useSharing'

import { eventWhen } from '../events'
import { kindMark } from '../kind'
import { itemPrice } from '../prices'
import { STATUS_LABELS } from '../status'
import type { Item, MovedItem } from '../types'
import { ItemControl } from './ItemControl'
import { rowHighlight, useItemActions } from './itemActionsContext'
import { RowTitle } from './RowTitle'
import { SublistRow } from './SublistRow'
import { SwipeableRow } from './SwipeableRow'

interface OutOfMindSectionProps {
  items: readonly Item[]
  /** Solo en «En mente»: lo que salió de ella hacia otra lista (diseño 05). */
  moved?: readonly MovedItem[]
  /** Abierta al entrar (cerrada en «En mente» cuando no queda nada pendiente, diseño 05 E3). */
  defaultOpen: boolean
  /** Con el filtro «Hechas» es lo único que se ve: siempre abierta, sin plegar. */
  collapsible?: boolean
  className?: string
}

type Entry =
  { kind: 'done'; item: Item; at: number } | { kind: 'moved'; moved: MovedItem; at: number }

/**
 * «Fuera de la cabeza» (02 §Estados): lo terminado, al final, tachado y atenuado, con el
 * contador. Tocar el checkbox lo devuelve a pendiente: hecho no es borrado; tocar la fila abre el
 * detalle. En «En mente» también sale lo movido a otra lista, con el icono de mover y «movida a
 * Casa · lunes». El diseño atenúa la fila entera al 60 %, pero así el título no llega a AA; se
 * atenúa el checkbox y el título va en `subtle` (4,6:1).
 */
export function OutOfMindSection({
  items,
  moved = [],
  defaultOpen,
  collapsible = true,
  className,
}: OutOfMindSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const listId = useId()
  const expanded = !collapsible || open

  // Lo hecho y lo movido, juntos y lo último primero (`items` ya viene así ordenado).
  const entries: Entry[] = [
    ...items.map((item, index) => ({
      kind: 'done' as const,
      item,
      at: item.completedAt?.getTime() ?? -index,
    })),
    ...moved.map((entry) => ({
      kind: 'moved' as const,
      moved: entry,
      at: entry.movedAt.getTime(),
    })),
  ].sort((a, b) => b.at - a.at)

  const label = (
    <>
      Fuera de la cabeza{' '}
      <span className="font-semibold text-subtle-foreground">· {entries.length}</span>
    </>
  )

  return (
    <section aria-label="Fuera de la cabeza" className={cn('flex flex-col', className)}>
      <FoldHeading
        open={collapsible ? open : undefined}
        controls={listId}
        onToggle={() => {
          setOpen((current) => !current)
        }}
      >
        {label}
      </FoldHeading>
      {expanded && (
        <ul id={listId} className="flex flex-col gap-0.5">
          {entries.map((entry) =>
            entry.kind === 'done' ? (
              entry.item.kind === 'sublist' ? (
                <SublistRow key={entry.item.id} item={entry.item} done />
              ) : (
                <DoneRow key={entry.item.id} item={entry.item} />
              )
            ) : (
              <MovedRow key={entry.moved.id} moved={entry.moved} />
            ),
          )}
        </ul>
      )}
    </section>
  )
}

/**
 * Cabecera de 36 px de una sección plegable de lo terminado, con el chevron que gira. Sin `open`,
 * no se pliega: solo el texto.
 */
export function FoldHeading({
  open,
  controls,
  onToggle,
  children,
}: {
  open: boolean | undefined
  controls: string
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <h2 className="text-sm tracking-normal text-muted-foreground">
      {open === undefined ? (
        <span className="flex h-9 items-center px-1">{children}</span>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={controls}
          onClick={onToggle}
          className="flex h-9 items-center gap-1.5 rounded-lg px-1 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronDown
            aria-hidden
            className={cn('size-3.5 transition-transform duration-200', !open && '-rotate-90')}
            strokeWidth={2.2}
          />
          {children}
        </button>
      )}
    </h2>
  )
}

const ROW =
  'relative flex min-h-10 animate-in items-center gap-3.5 rounded-[18px] px-4 py-1 duration-200 fade-in md:gap-4 md:rounded-2xl md:px-[18px] md:py-2'

/**
 * Una fila terminada: tachada, con el control de su tipo atenuado; `aside`, a la derecha (en Hoy,
 * su lista). Si no es del tipo por defecto de la lista, lleva su estado («Cable HDMI · Comprado»,
 * diseño 12), porque el título solo no dice cómo terminó. Una compra con precio dice debajo cómo
 * terminó y, si se compró, por cuánto («Comprado · 12 €», diseño 16, A1 y D2). `meta` es una
 * línea más debajo (en «Hecho ese día» de Hoy, su lista); con `muted: false`, el control no se
 * atenúa (diseño 17, C4).
 */
export function DoneRow({
  item,
  aside,
  meta,
  muted = true,
}: {
  item: Item
  aside?: ReactNode
  meta?: ReactNode
  muted?: boolean
}) {
  const actions = useItemActions()
  const price = itemPrice(item)
  const paid = price
    ? item.status === 'bought'
      ? `${STATUS_LABELS[item.status]} · ${price.text}`
      : STATUS_LABELS[item.status]
    : null
  // Un evento dice cuándo fue o que se canceló (diseño 17, E1: «Sáb 12 sep · 21:30»).
  const when =
    item.kind === 'event'
      ? item.status === 'cancelled'
        ? STATUS_LABELS[item.status]
        : item.dueAt && eventWhen(item)
      : null
  const status =
    !paid && !when && kindMark(item.kind, actions.list.kind) ? STATUS_LABELS[item.status] : null
  // Si lo completó el otro, su inicial (diseño 20, M2).
  const person = useItemPerson(item)
  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(ROW, 'bg-background hover:bg-fill', rowHighlight(actions, item))}
    >
      <ItemControl
        item={item}
        onToggle={() => {
          actions.toggle(item)
        }}
        className={cn('z-10', muted && 'opacity-60')}
      />
      <div className="min-w-0 flex-1">
        <RowTitle
          item={item}
          className="truncate text-[15px] font-normal text-subtle-foreground line-through"
        >
          {status ? `${item.title} · ${status}` : undefined}
        </RowTitle>
        {(paid ?? when ?? person) && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            {person && <ItemPersonMark person={person} item={item} />}
            {paid ?? when}
          </p>
        )}
        {meta}
      </div>
      {aside}
    </SwipeableRow>
  )
}

/** Lo que salió de «En mente»: no se toca desde aquí (vive en su lista), solo se recuerda. */
function MovedRow({ moved }: { moved: MovedItem }) {
  return (
    <li className={ROW}>
      <span
        aria-hidden
        className="grid size-6 shrink-0 place-items-center rounded-full border border-border bg-fill opacity-60"
      >
        <ArrowRightLeft className="size-3 text-muted-foreground" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] text-subtle-foreground line-through">
        {moved.title}
      </span>
      <span className="text-xs whitespace-nowrap text-subtle-foreground">
        movida a {moved.listName} · {formatCaptureAge(moved.movedAt)}
      </span>
    </li>
  )
}
