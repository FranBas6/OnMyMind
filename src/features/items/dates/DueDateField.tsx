import { Calendar, ChevronRight } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState } from 'react'

import { BottomSheet } from '@/components/sheets/BottomSheet'
import { formatDueDateLong } from '@/lib/dates/date'
import { cn } from '@/lib/utils'

import { isFinalStatus } from '../status'
import type { Item } from '../types'
import { DueDatePicker } from '@/components/controls/DueDatePicker'

interface DueDateFieldProps {
  item: Item
  isDesktop: boolean
  onChange: (dueAt: Date | null) => void
  /** «Fecha límite» en una tarea; «Fecha de pago» o «Empieza a cobrar» en un pago (diseño 30). */
  label?: string
  /** Cómo se escribe la fecha, si no es la de una tarea («Venció el mar 10 nov», en rojo). */
  display?: { text: string; urgent: boolean } | null
  /** Sin fecha: «Sin fecha» en terciario o, en una compra, «Añadir» en `primary` (F2). */
  empty?: 'none' | 'add'
}

/**
 * Fila «Fecha límite» (diseño 06): «Hoy, 25 sep» en rojo si es hoy o antes, «Sin fecha» en
 * terciario, y la fecha sola si la tarea está hecha. Abre el selector: una hoja encima del
 * detalle en móvil (con «Listo») y un popover bajo la fila en escritorio. La de un pago (6.4) es la
 * misma con su nombre y su texto.
 */
export function DueDateField({
  item,
  isDesktop,
  onChange,
  label: title = 'Fecha límite',
  display,
  empty = 'none',
}: DueDateFieldProps) {
  const [open, setOpen] = useState(false)
  const done = isFinalStatus(item.status)
  const label =
    display !== undefined
      ? display
      : item.dueAt
        ? formatDueDateLong(item.dueAt, { relative: !done })
        : null

  const row = (
    <button
      type="button"
      onClick={() => {
        setOpen(true)
      }}
      className={cn(
        'flex h-13 w-full items-center justify-between gap-3 px-4 text-[15px] outline-none hover:bg-fill/50 focus-visible:bg-fill',
        open && isDesktop && 'bg-brand-tint hover:bg-brand-tint',
      )}
    >
      <span className="flex items-center gap-2.5 font-medium">
        <Calendar aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />
        {title}
      </span>
      {!label && empty === 'add' ? (
        <span className="font-semibold text-primary">Añadir</span>
      ) : (
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
      )}
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
            aria-label={title}
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
      <BottomSheet nested open={open} onOpenChange={setOpen} title={title}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-xl font-extrabold tracking-[-0.02em]">{title}</p>
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
