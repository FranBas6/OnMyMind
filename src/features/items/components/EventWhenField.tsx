import { format, set, startOfDay } from 'date-fns'
import { Calendar, Check, ChevronRight, Clock, Repeat } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState, type ComponentProps, type ReactNode } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { Switch } from '@/components/Switch'
import { showUndoToast } from '@/lib/undoToast'
import { cn } from '@/lib/utils'

import {
  eventTime,
  followingLabel,
  isPastEvent,
  isRecurrence,
  longDay,
  occurrence,
  parseTime,
  pastLabel,
  RECURRENCE_LABELS,
  RECURRENCES,
  recurrenceHint,
  type Recurrence,
} from '../events'
import type { Item, ItemPatch } from '../types'
import { DueDatePicker } from './DueDatePicker'

/** La hora que se pone al quitar «Todo el día»: luego se cambia. */
const DEFAULT_HOUR = 10

interface EventWhenFieldProps {
  item: Item
  isDesktop: boolean
  /** Los días con eventos de su lista: puntos en el calendario (F3). */
  marked: readonly Date[]
  onChange: (patch: ItemPatch) => void
}

/**
 * «Cuándo» de un evento (diseño 17, F1–F12 y D1–D2), justo bajo el título: es lo que importa de un
 * evento. Una caja con Día, «Todo el día», Hora y Repetir y, si se repite, «Siguiente: sábado 25
 * oct». Sin día solo hay «Añadir día»: la hora y la repetición salen al ponerlo. En el iPhone el
 * día se elige en una hoja con el calendario de siempre y la hora con la rueda del sistema; en
 * escritorio, un popover con el calendario y un campo de hora que acepta «21», «2130» o «21:30».
 * Quitar la fecha se deshace desde el aviso. Lo pasado y lo cancelado lo dicen encima.
 */
export function EventWhenField({ item, isDesktop, marked, onChange }: EventWhenFieldProps) {
  const [dayOpen, setDayOpen] = useState(false)
  const [repeatOpen, setRepeatOpen] = useState(false)
  const now = new Date()
  const at = occurrence(item, now)
  const time = eventTime(item)
  const cancelled = item.status === 'cancelled'
  const past = !cancelled && isPastEvent(item, now)
  const recurrence = isRecurrence(item.recurrence) ? item.recurrence : null

  const setDay = (day: Date | null) => {
    if (!day) {
      removeDate()
      return
    }
    // Se queda con su hora; un día nuevo, sin hora, es de todo el día.
    if (item.dueAt && !item.allDay) {
      onChange({
        dueAt: set(day, { hours: item.dueAt.getHours(), minutes: item.dueAt.getMinutes() }),
        allDay: false,
      })
    } else onChange({ dueAt: startOfDay(day), allDay: true })
  }
  const setAllDay = (allDay: boolean) => {
    const day = startOfDay(item.dueAt ?? now)
    onChange(
      allDay
        ? { dueAt: day, allDay: true }
        : { dueAt: set(day, { hours: DEFAULT_HOUR }), allDay: false },
    )
  }
  const setTime = ({ hours, minutes }: { hours: number; minutes: number }) => {
    onChange({ dueAt: set(startOfDay(item.dueAt ?? now), { hours, minutes }), allDay: false })
  }
  const removeDate = () => {
    const before: ItemPatch = {
      dueAt: item.dueAt,
      allDay: item.allDay,
      recurrence: item.recurrence,
    }
    setDayOpen(false)
    onChange({ dueAt: null, allDay: false, recurrence: null })
    showUndoToast({
      message: 'Fecha quitada',
      onUndo: () => {
        onChange(before)
      },
    })
  }
  const setRecurrence = (next: Recurrence | null) => {
    onChange({ recurrence: next })
    if (isDesktop) setRepeatOpen(false)
  }

  const dayRow = (
    <Row
      icon={Calendar}
      label="Día"
      onClick={() => {
        setDayOpen(true)
      }}
      highlighted={isDesktop && dayOpen}
    >
      {at ? (
        <Value>{longDay(at, now)}</Value>
      ) : (
        <span className="font-semibold text-primary">Añadir día</span>
      )}
    </Row>
  )

  const allDayRow = (
    <div className="flex h-13 items-center justify-between gap-3 px-4 pl-11">
      <span className="text-[15px] font-medium">Todo el día</span>
      <Switch checked={item.allDay} onCheckedChange={setAllDay} label="Todo el día" />
    </div>
  )

  // En el iPhone, la rueda del sistema: el campo nativo va encima de la fila, invisible.
  const nativeTimeRow = (
    <label className="relative flex h-13 cursor-pointer items-center justify-between gap-3 px-4 text-[15px]">
      <span className="flex items-center gap-2.5 font-medium">
        <Clock aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />
        Hora
      </span>
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <Value>{time}</Value>
        <ChevronRight aria-hidden className="size-4 text-subtle-foreground" strokeWidth={2} />
      </span>
      <input
        type="time"
        step={300}
        aria-label="Hora"
        value={time ?? ''}
        onChange={(event) => {
          const parsed = parseTime(event.target.value)
          if (parsed) setTime(parsed)
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  )

  const timeRow = isDesktop ? (
    <Row
      icon={Clock}
      label="Hora"
      onClick={() => {
        setDayOpen(true)
      }}
    >
      <Value>{time}</Value>
    </Row>
  ) : (
    nativeTimeRow
  )

  const repeatRow = (
    <Row
      icon={Repeat}
      label="Repetir"
      onClick={() => {
        setRepeatOpen(true)
      }}
      highlighted={isDesktop && repeatOpen}
    >
      <span className="text-muted-foreground">
        {recurrence ? RECURRENCE_LABELS[recurrence] : 'No se repite'}
      </span>
    </Row>
  )

  const picker = (
    // Uno que se repite se abre en la vez que toca, la misma que dice la fila «Día».
    <DueDatePicker
      value={at}
      marked={marked}
      onChange={(day) => {
        setDay(day)
      }}
    />
  )

  const daySheet = isDesktop ? (
    <Popover.Root open={dayOpen} onOpenChange={setDayOpen}>
      <Popover.Anchor asChild>{dayRow}</Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          aria-label="Cuándo"
          className="z-50 flex w-[var(--radix-popover-trigger-width)] min-w-[340px] flex-col gap-3 rounded-[18px] border border-border-soft bg-popover p-3.5 text-popover-foreground shadow-popover outline-none"
        >
          {picker}
          {item.dueAt && (
            <DesktopTime
              key={`${String(item.dueAt.getTime())}-${String(item.allDay)}`}
              time={time}
              allDay={item.allDay}
              onTime={setTime}
              onAllDay={setAllDay}
              onDone={() => {
                setDayOpen(false)
              }}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  ) : (
    <>
      {dayRow}
      <BottomSheet nested open={dayOpen} onOpenChange={setDayOpen} title="Cuándo">
        <SheetHeader
          title="Cuándo"
          onDone={() => {
            setDayOpen(false)
          }}
        />
        {picker}
        {item.dueAt && (
          <div className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-card [&>*]:pl-4">
            {allDayRow}
            {!item.allDay && nativeTimeRow}
          </div>
        )}
      </BottomSheet>
    </>
  )

  const repeatOptions = (
    <RepeatOptions value={recurrence} day={at ?? now} onChange={setRecurrence} />
  )
  const repeatPicker = isDesktop ? (
    <Popover.Root open={repeatOpen} onOpenChange={setRepeatOpen}>
      <Popover.Anchor asChild>{repeatRow}</Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          aria-label="Repetir"
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-[18px] border border-border-soft bg-popover p-2 text-popover-foreground shadow-popover outline-none"
        >
          {repeatOptions}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  ) : (
    <>
      {repeatRow}
      <BottomSheet nested open={repeatOpen} onOpenChange={setRepeatOpen} title="Repetir">
        <SheetHeader
          title="Repetir"
          onDone={() => {
            setRepeatOpen(false)
          }}
        />
        {repeatOptions}
      </BottomSheet>
    </>
  )

  const following = followingLabel(item, now)

  return (
    <section aria-label="Cuándo" className="flex flex-col gap-2">
      <p className="text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase">Cuándo</p>
      {cancelled && (
        <p className="rounded-xl bg-priority-high-bg px-3.5 py-3 text-[13px] leading-normal font-semibold text-error">
          Cancelado. No sale en Hoy ni cuenta como próximo.
        </p>
      )}
      {past && (
        <p className="rounded-xl bg-fill px-3.5 py-2.5 text-[13px] font-semibold text-muted-foreground">
          {pastLabel(item, now)}
        </p>
      )}
      <div className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-card">
        {daySheet}
        {item.dueAt && (
          <>
            {allDayRow}
            {!item.allDay && timeRow}
            {repeatPicker}
          </>
        )}
      </div>
      {!item.dueAt && (
        <p className="text-[13px] leading-normal text-muted-foreground">
          Sin día sale arriba en su lista, en «Sin fecha», y no llega a Hoy.
        </p>
      )}
      {following && (
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Repeat aria-hidden className="size-3.5" strokeWidth={2.2} />
          {following}
        </p>
      )}
    </section>
  )
}

/**
 * Una fila de «Cuándo». Pasa la `ref` y el resto de props al botón: en escritorio es el ancla del
 * popover (`Popover.Anchor asChild`), que sin ella no sabe dónde ponerse.
 */
function Row({
  icon: Icon,
  label,
  highlighted = false,
  children,
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'children'> & {
  icon: typeof Calendar
  label: string
  highlighted?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'flex h-13 w-full items-center justify-between gap-3 px-4 text-[15px] outline-none hover:bg-fill/50 focus-visible:bg-fill',
        highlighted && 'bg-brand-tint hover:bg-brand-tint',
        className,
      )}
    >
      <span className="flex items-center gap-2.5 font-medium">
        <Icon aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />
        {label}
      </span>
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        {children}
        <ChevronRight aria-hidden className="size-4 text-subtle-foreground" strokeWidth={2} />
      </span>
    </button>
  )
}

function Value({ children }: { children: ReactNode }) {
  return <span className="font-semibold">{children}</span>
}

/** La cabecera de las hojas del evento (F3, F7): el título y «Listo» a la derecha. */
function SheetHeader({ title, onDone }: { title: string; onDone: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="font-display text-xl font-extrabold tracking-[-0.02em]">{title}</p>
      <button
        type="button"
        onClick={onDone}
        className="h-9 rounded-lg px-1 font-display text-[15px] font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Listo
      </button>
    </div>
  )
}

/** «Repetir» (F7): «No se repite» y cada repetición con lo que significa para ese día. */
function RepeatOptions({
  value,
  day,
  onChange,
}: {
  value: Recurrence | null
  day: Date
  onChange: (recurrence: Recurrence | null) => void
}) {
  const options: { value: Recurrence | null; label: string; hint: string | null }[] = [
    { value: null, label: 'No se repite', hint: null },
    ...RECURRENCES.map((recurrence) => ({
      value: recurrence,
      label: RECURRENCE_LABELS[recurrence],
      hint: recurrenceHint(recurrence, day),
    })),
  ]
  return (
    <div role="radiogroup" aria-label="Repetir" className="flex flex-col gap-0.5">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              onChange(option.value)
            }}
            className={cn(
              'flex h-13 items-center justify-between gap-3 rounded-2xl px-3 text-left text-[15px] font-medium outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-11 md:rounded-xl',
              selected && 'bg-brand-tint font-semibold text-primary-strong hover:bg-brand-tint',
            )}
          >
            <span>
              {option.label}
              {option.hint && (
                <span
                  className={cn(
                    'font-normal',
                    selected ? 'text-primary-strong' : 'text-muted-foreground',
                  )}
                >
                  {' '}
                  · {option.hint}
                </span>
              )}
            </span>
            {selected && <Check aria-hidden className="size-4" strokeWidth={2.4} />}
          </button>
        )
      })}
    </div>
  )
}

/**
 * La hora en el popover de escritorio (D2): un campo que acepta «21», «2130» o «21:30» y guarda con
 * ↩ o al salir, y «Todo el día» al lado.
 */
function DesktopTime({
  time,
  allDay,
  onTime,
  onAllDay,
  onDone,
}: {
  time: string | null
  allDay: boolean
  onTime: (time: { hours: number; minutes: number }) => void
  onAllDay: (allDay: boolean) => void
  onDone: () => void
}) {
  const [text, setText] = useState(time ?? '')
  const [invalid, setInvalid] = useState(false)
  const commit = () => {
    if (text.trim() === '') return true
    const parsed = parseTime(text)
    setInvalid(parsed === null)
    if (!parsed) return false
    const next = format(set(new Date(), parsed), 'HH:mm')
    setText(next)
    if (next !== time || allDay) onTime(parsed)
    return true
  }
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-bold tracking-[0.06em] text-subtle-foreground uppercase">
        Hora
      </p>
      <div className="flex items-center gap-3">
        <input
          type="text"
          inputMode="numeric"
          aria-label="Hora"
          aria-invalid={invalid}
          placeholder="21:30"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setInvalid(false)
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && commit()) onDone()
          }}
          className={cn(
            'h-11 min-w-0 flex-1 rounded-xl border-[1.5px] border-border bg-card px-3 text-base font-semibold outline-none focus:border-primary',
            invalid && 'border-error focus:border-error',
          )}
        />
        <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(event) => {
              onAllDay(event.target.checked)
            }}
            className="size-[18px] accent-primary"
          />
          Todo el día
        </label>
      </div>
      <p className={cn('text-xs', invalid ? 'text-error' : 'text-subtle-foreground')}>
        {invalid
          ? 'Eso no parece una hora.'
          : 'Escribe la hora («21», «2130» o «21:30»). ↩ para guardar.'}
      </p>
    </div>
  )
}
