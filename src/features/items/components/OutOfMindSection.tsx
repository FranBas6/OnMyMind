import { ArrowRightLeft, ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

import { useLongPress } from '@/hooks/useLongPress'
import { formatCaptureAge } from '@/lib/date'
import { cn } from '@/lib/utils'

import { checkboxState } from '../status'
import type { Item, MovedItem } from '../types'
import { rowHighlight, useItemActions } from './itemActionsContext'
import { RowTitle } from './RowTitle'
import { StatusCheckbox } from './StatusCheckbox'

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
      <h2 className="text-sm tracking-normal text-muted-foreground">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => {
              setOpen((current) => !current)
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg px-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronDown
              aria-hidden
              className={cn('size-3.5 transition-transform duration-200', !open && '-rotate-90')}
              strokeWidth={2.2}
            />
            {label}
          </button>
        ) : (
          <span className="flex h-9 items-center px-1">{label}</span>
        )}
      </h2>
      {expanded && (
        <ul id={listId} className="flex flex-col gap-0.5">
          {entries.map((entry) =>
            entry.kind === 'done' ? (
              <DoneRow key={entry.item.id} item={entry.item} />
            ) : (
              <MovedRow key={entry.moved.id} moved={entry.moved} />
            ),
          )}
        </ul>
      )}
    </section>
  )
}

const ROW =
  'relative flex min-h-10 animate-in items-center gap-3.5 rounded-[18px] px-4 py-1 duration-200 fade-in md:gap-4 md:rounded-2xl md:px-[18px] md:py-2'

function DoneRow({ item }: { item: Item }) {
  const actions = useItemActions()
  const longPress = useLongPress(() => {
    actions.openMenu(item)
  })
  return (
    <li {...longPress} className={cn(ROW, rowHighlight(actions, item))}>
      <StatusCheckbox
        state={checkboxState(item.status)}
        label={item.title}
        onToggle={() => {
          actions.toggle(item)
        }}
        className="z-10 opacity-60"
      />
      <RowTitle
        item={item}
        className="truncate text-[15px] font-normal text-subtle-foreground line-through"
      />
    </li>
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
