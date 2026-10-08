import { Bell, Calendar, Check, List, Repeat, Undo2, X } from 'lucide-react'
import type { MouseEvent } from 'react'

import { cn } from '@/lib/utils'

import { lineDate, pastedLinesHeading, type PastedRow } from '../pastedLines'
import type { ItemKind } from '../status'
import { compactWrittenDateLabel } from '../writtenDate'

// Tocar dentro de la caja no le quita el foco al campo: en iOS se cerraría el teclado.
const keepFocus = (event: MouseEvent) => {
  event.preventDefault()
}

/**
 * Lo pegado, una cosa por línea (4.3, diseño 23, B1, B2, B4 y B5): la caja con «7 cosas, una por
 * línea» y «Como una sola», que vuelve al texto tal cual. Cada línea, sin su viñeta, con la marca de
 * su tipo (cuadrada en una compra) y un ✕ de 44 px. Una línea quitada se queda tachada con ↺ hasta
 * guardar, por si fue sin querer. «[x] » va marcada y dice «se añade hecha». En tareas y eventos, la
 * fecha escrita de cada línea sale en su pastilla corta, que se toca para deshacerla.
 */
export function PastedLinesBox({
  rows,
  overflow,
  kind,
  onToggleRemoved,
  onToggleDate,
  onSingle,
  className,
}: {
  rows: readonly PastedRow[]
  /** Las que no caben (más de 50). */
  overflow: number
  /** El tipo con el que se van a añadir: la forma de la marca y si se leen fechas. */
  kind: ItemKind | null
  onToggleRemoved: (index: number) => void
  onToggleDate: (index: number) => void
  onSingle: () => void
  className?: string
}) {
  const count = rows.filter((row) => !row.removed).length
  const square = kind === 'shopping'

  return (
    <section
      aria-label="Lo pegado, una cosa por línea"
      data-vaul-no-drag
      className={cn('rounded-[18px] border border-border-soft bg-fill/50 pb-1', className)}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
        <p className="flex items-center gap-2 text-[13px] font-bold">
          <List aria-hidden className="size-4 text-primary" strokeWidth={2.4} />
          {pastedLinesHeading(count)}
        </p>
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={onSingle}
          className="rounded-md text-[13px] font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Como una sola
        </button>
      </div>
      <ul className="max-h-[22.5rem] overflow-y-auto overscroll-contain">
        {rows.map((row, index) => {
          const dated = row.removed ? null : lineDate(row, kind)
          const title = dated && !row.dateUndone ? dated.parsed.title : row.title
          return (
            <li
              key={index}
              className="flex min-h-[45px] items-center gap-3 pl-4 [&+li>div]:border-t [&+li>div]:border-border-soft"
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-[22px] shrink-0 place-items-center border-2',
                  square ? 'rounded-[6px]' : 'rounded-full',
                  row.removed
                    ? 'border-border'
                    : row.done
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-control',
                )}
              >
                {row.done && !row.removed && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <div className="flex min-h-[45px] min-w-0 flex-1 items-center gap-2 self-stretch">
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[15px]',
                    row.removed && 'text-subtle-foreground line-through',
                    row.done && !row.removed && 'text-muted-foreground',
                  )}
                >
                  {title}
                  {row.done && !row.removed && (
                    <span className="text-[12.5px] font-semibold"> · se añade hecha</span>
                  )}
                </span>
                {dated && kind && (
                  <LineDatePill
                    label={compactWrittenDateLabel(dated.written, kind)}
                    undone={row.dateUndone}
                    onToggle={() => {
                      onToggleDate(index)
                    }}
                  />
                )}
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => {
                    onToggleRemoved(index)
                  }}
                  aria-label={row.removed ? `Recuperar «${row.title}»` : `Quitar «${row.title}»`}
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {row.removed ? (
                    <Undo2 aria-hidden className="size-4" strokeWidth={2.2} />
                  ) : (
                    <X aria-hidden className="size-4" strokeWidth={2.2} />
                  )}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {overflow > 0 && (
        <p className="px-4 pt-1 pb-2 text-[12.5px] leading-normal text-muted-foreground">
          {overflow === 1 ? 'No cabe 1 más' : `No caben ${String(overflow)} más`}: se añaden como
          mucho 50 de una vez.
        </p>
      )}
    </section>
  )
}

/** La pastilla corta de una línea (B5): «Mañana · 🔔 10:00»; deshecha, «Sin fecha». */
function LineDatePill({
  label,
  undone,
  onToggle,
}: {
  label: ReturnType<typeof compactWrittenDateLabel>
  undone: boolean
  onToggle: () => void
}) {
  const text = `${label.day}${label.time ? ` · ${label.time}` : ''}`
  if (undone) {
    return (
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={onToggle}
        aria-label={`Sin fecha. Volver a entender ${text}`}
        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-control px-2.5 text-[12.5px] font-semibold whitespace-nowrap text-muted-foreground outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Undo2 aria-hidden className="size-3.5" strokeWidth={2.2} />
        Sin fecha
      </button>
    )
  }
  return (
    <button
      type="button"
      onMouseDown={keepFocus}
      onClick={onToggle}
      aria-label={`${text}. Quitar la fecha`}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-brand-tint px-2.5 text-[12.5px] font-semibold whitespace-nowrap text-primary-strong outline-none hover:bg-brand-tint/80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {label.repeats ? (
        <Repeat aria-hidden className="size-3.5" strokeWidth={2.2} />
      ) : (
        <Calendar aria-hidden className="size-3.5" strokeWidth={2.2} />
      )}
      {label.day}
      {label.time && (
        <>
          <span aria-hidden className="opacity-50">
            ·
          </span>
          {label.bell && <Bell aria-hidden className="size-3" strokeWidth={2.4} />}
          {label.time}
        </>
      )}
    </button>
  )
}
