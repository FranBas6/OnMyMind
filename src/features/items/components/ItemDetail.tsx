import { ArrowRightLeft, Calendar, ChevronDown, ChevronRight, Trash2, X } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import type { List } from '@/features/lists'
import { formatDueDateLong } from '@/lib/date'
import { LIST_COLOR_BG } from '@/lib/listColors'
import { cn } from '@/lib/utils'

import { itemMoment, upcomingFieldsNote } from '../copy'
import { PRIORITY_LABELS, PRIORITIES, type Priority } from '../fields'
import { checkboxState, isFinalStatus, STATUS_LABELS, STATUSES_BY_KIND } from '../status'
import type { Item, ItemPatch, ItemStatus } from '../types'
import { DueDatePicker } from './DueDatePicker'
import { ItemTitleField, NotesField } from './ItemTextFields'
import { SegmentedControl, type SegmentOption } from './SegmentedControl'
import { StatusCheckbox } from './StatusCheckbox'

const PRIORITY_SELECTED: Record<Priority, string> = {
  high: 'bg-priority-high-bg font-bold text-priority-high',
  medium: 'bg-priority-medium-bg font-bold text-priority-medium',
  // Baja no tiene fondo propio (sería el mismo `fill` del control): una píldora blanca.
  low: 'bg-card font-bold text-foreground shadow-xs',
}

const PRIORITY_OPTIONS: readonly SegmentOption<Priority>[] = PRIORITIES.map((priority) => ({
  value: priority,
  label: PRIORITY_LABELS[priority],
  selectedClassName: PRIORITY_SELECTED[priority],
}))

export interface ItemDetailProps {
  item: Item
  list: List
  isDesktop: boolean
  onToggle: (item: Item) => void
  onUpdate: (item: Item, patch: ItemPatch) => void
  /** Abre «Mover a…»; en escritorio, junto al botón que se ha pulsado. */
  onMove: (item: Item, anchor: HTMLElement) => void
  onDelete: (item: Item) => void
  onClose: () => void
}

/**
 * Contenido del detalle de un ítem (pantalla 11 y diseño 06). Cada campo se guarda por su cuenta
 * al cambiarlo, sin botón «Guardar». Las tareas tienen prioridad y fecha límite; el resto de
 * tipos, en fase 1, la hoja básica: título, notas, estado, mover y borrar, con una línea que
 * anticipa su ficha completa. Sin «Recordatorio» (fase 2).
 */
export function ItemDetail({
  item,
  list,
  isDesktop,
  onToggle,
  onUpdate,
  onMove,
  onDelete,
  onClose,
}: ItemDetailProps) {
  const done = isFinalStatus(item.status)
  const statusOptions = STATUSES_BY_KIND[item.kind].map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
  }))
  const note = upcomingFieldsNote(item.kind)

  const origin = (
    <span className="flex min-w-0 items-center gap-2 text-[13px] text-subtle-foreground">
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', LIST_COLOR_BG[list.color])} />
      <span className="truncate">
        {list.name} · {itemMoment(item)}
      </span>
    </span>
  )

  return (
    <div className="flex min-h-full flex-col gap-4">
      {isDesktop && (
        <div className="flex items-center justify-between gap-3">
          {origin}
          <span className="flex shrink-0 items-center gap-2">
            <kbd className="rounded-[5px] bg-fill px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
              Esc
            </kbd>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-[9px] bg-fill text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X aria-hidden className="size-4" strokeWidth={2.2} />
            </button>
          </span>
        </div>
      )}

      <div className="flex items-start gap-3.5 md:gap-3">
        <StatusCheckbox
          large
          state={checkboxState(item.status)}
          label={item.title}
          onToggle={() => {
            onToggle(item)
          }}
          className="mt-[3px] md:mt-0.5"
        />
        <ItemTitleField
          key={item.id}
          title={item.title}
          done={done}
          onSave={(title) => {
            onUpdate(item, { title })
          }}
          className="text-[23px] md:text-[22px]"
        />
      </div>
      {!isDesktop && <div className="-mt-2 pl-[42px]">{origin}</div>}

      <NotesField
        key={`notes-${item.id}`}
        notes={item.notes}
        onSave={(notes) => {
          onUpdate(item, { notes })
        }}
      />

      {item.kind === 'task' && (
        <>
          <Field label="Prioridad">
            <SegmentedControl
              label="Prioridad"
              options={PRIORITY_OPTIONS}
              value={item.priority}
              allowNone
              onChange={(priority) => {
                onUpdate(item, { priority })
              }}
            />
          </Field>
          <DueDateField
            item={item}
            isDesktop={isDesktop}
            onChange={(dueAt) => {
              onUpdate(item, { dueAt })
            }}
          />
        </>
      )}

      <Field label="Estado">
        <SegmentedControl<ItemStatus>
          label="Estado"
          options={statusOptions}
          value={item.status}
          onChange={(status) => {
            if (status) onUpdate(item, { status })
          }}
        />
      </Field>
      {note && <p className="-mt-1 text-[13px] leading-normal text-muted-foreground">{note}</p>}

      <div className="mt-auto flex h-11 shrink-0 items-center justify-between text-sm font-semibold">
        <button
          type="button"
          onClick={(event) => {
            onMove(item, event.currentTarget)
          }}
          className="-ml-1 flex h-11 items-center gap-2 rounded-xl px-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowRightLeft aria-hidden className="size-4" strokeWidth={2.2} />
          Mover a otra lista
          {isDesktop && <ChevronDown aria-hidden className="size-3.5 opacity-60" />}
        </button>
        <button
          type="button"
          onClick={() => {
            onDelete(item)
          }}
          className="-mr-1 flex h-11 items-center gap-1.5 rounded-xl px-1 text-destructive outline-none hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Trash2 aria-hidden className="size-4" strokeWidth={2.2} />
          Borrar
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

interface DueDateFieldProps {
  item: Item
  isDesktop: boolean
  onChange: (dueAt: Date | null) => void
}

/**
 * Fila «Fecha límite» (diseño 06): «Hoy, 25 sep» en rojo si es hoy o antes, «Sin fecha» en
 * terciario, y la fecha sola si la tarea está hecha. Abre el selector: una hoja encima del
 * detalle en móvil (con «Listo») y un popover bajo la fila en escritorio.
 */
function DueDateField({ item, isDesktop, onChange }: DueDateFieldProps) {
  const [open, setOpen] = useState(false)
  const done = isFinalStatus(item.status)
  const label = item.dueAt ? formatDueDateLong(item.dueAt, { relative: !done }) : null

  const row = (
    <button
      type="button"
      onClick={() => {
        setOpen(true)
      }}
      className={cn(
        'flex h-13 w-full items-center justify-between gap-3 rounded-2xl border border-border-soft bg-card px-4 text-[15px] outline-none hover:border-border hover:bg-fill/50 focus-visible:ring-[3px] focus-visible:ring-ring/50',
        open && isDesktop && 'border-primary',
      )}
    >
      <span className="flex items-center gap-2.5 font-medium">
        <Calendar aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />
        Fecha límite
      </span>
      <span
        className={cn(
          'flex items-center gap-1.5 font-semibold whitespace-nowrap',
          !label && 'font-medium text-subtle-foreground',
          label?.urgent && 'text-error',
        )}
      >
        {label?.text ?? 'Sin fecha'}
        <ChevronRight aria-hidden className="size-4 text-subtle-foreground" strokeWidth={2} />
      </span>
    </button>
  )

  const picker = (
    <DueDatePicker
      value={item.dueAt}
      onChange={(dueAt) => {
        onChange(dueAt)
        // En escritorio, elegir es terminar; en móvil se confirma con «Listo».
        if (isDesktop) setOpen(false)
      }}
    />
  )

  if (isDesktop) {
    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Anchor asChild>{row}</Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            aria-label="Fecha límite"
            className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[320px] rounded-[18px] border border-border-soft bg-popover p-3.5 text-popover-foreground shadow-popover outline-none"
          >
            {picker}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <>
      {row}
      <BottomSheet nested open={open} onOpenChange={setOpen} title="Fecha límite">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-xl font-extrabold tracking-[-0.02em]">Fecha límite</p>
          <p className="truncate text-[13px] text-subtle-foreground">{item.title}</p>
        </div>
        {picker}
        <button
          type="button"
          onClick={() => {
            setOpen(false)
          }}
          className="mt-1 h-13 rounded-2xl bg-primary font-display text-base font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Listo
        </button>
      </BottomSheet>
    </>
  )
}
