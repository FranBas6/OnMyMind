import { addDays, addMonths, format, isSameMonth, startOfMonth } from 'date-fns'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'

import { monthLabel } from '@/features/items'
import { cn } from '@/lib/utils'

import { useMarkedDays } from '../hooks/useToday'
import { dayKey, dayTense, monthGrid, stripMonth, weekStart } from '../today'

interface DayCalendarProps {
  /** El día que se ve en Hoy. */
  selected: Date
  today: Date
  onSelect: (day: Date) => void
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

/** Lo que tiene que moverse el dedo en horizontal para cambiar de semana. */
const SWIPE_PX = 40

/**
 * El mes que enseña el calendario: empieza en el del día elegido y se mueve con ‹ ›. Si el día
 * cambia desde fuera (la tira, las flechas, «atrás»), vuelve al mes de ese día.
 */
function useVisibleMonth(selected: Date) {
  const [month, setMonth] = useState(() => startOfMonth(selected))
  const [shownFor, setShownFor] = useState(() => dayKey(selected))
  const key = dayKey(selected)
  if (key !== shownFor) {
    setShownFor(key)
    if (!isSameMonth(month, selected)) setMonth(startOfMonth(selected))
  }
  return [month, setMonth] as const
}

/**
 * El calendario de Hoy en el móvil (diseño 17, H1, C1–C5): bajo el título, la tira de la semana
 * del día que se ve, con puntos en los días que tienen algo, que se desliza por semanas. Tocar el
 * mes la abre en el mes entero, con ‹ › para saltar lejos y ⌃ para plegarlo. En otro día,
 * «Volver a hoy».
 */
export function DayStrip({ selected, today, onSelect }: DayCalendarProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useVisibleMonth(selected)
  const away = dayTense(selected, today) !== 'today'
  const backToToday = away && (
    <button
      type="button"
      onClick={() => {
        onSelect(today)
      }}
      className="inline-flex h-8 items-center rounded-2xl bg-brand-tint px-3 text-[13px] font-bold text-primary-strong outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      Volver a hoy
    </button>
  )

  if (open) {
    return (
      <div className="flex flex-col gap-1.5">
        {backToToday && <div className="-mt-1 mb-1 flex justify-end">{backToToday}</div>}
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          today={today}
          onSelect={onSelect}
        />
        <button
          type="button"
          aria-label="Plegar el mes"
          aria-expanded
          onClick={() => {
            setOpen(false)
          }}
          className="-mt-1.5 grid h-7 place-items-center self-center rounded-lg px-3 text-subtle-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronUp aria-hidden className="size-[18px]" strokeWidth={2.2} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-9 items-center justify-between px-1">
        <button
          type="button"
          aria-expanded={false}
          onClick={() => {
            setMonth(startOfMonth(selected))
            setOpen(true)
          }}
          className="-ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg px-1 font-display text-[15px] font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {monthLabel(selected, today)}
          <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" strokeWidth={2.4} />
          <span className="sr-only">: ver el mes entero</span>
        </button>
        {backToToday}
      </div>
      <WeekStrip selected={selected} today={today} onSelect={onSelect} />
    </div>
  )
}

/** La semana del día elegido: siete días, y se pasa a la anterior o a la siguiente deslizando. */
function WeekStrip({ selected, today, onSelect }: DayCalendarProps) {
  const marked = useMarkedDays(stripMonth(selected))
  const start = weekStart(selected)
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  // Tras deslizar, el «click» que llega al soltar no elige el día que había bajo el dedo.
  const swiped = useRef(false)

  const onPointerUp = (event: PointerEvent) => {
    const from = touch.current
    touch.current = null
    if (!from) return
    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    swiped.current = true
    const next = dx < 0
    setDirection(next ? 'next' : 'prev')
    onSelect(addDays(selected, next ? 7 : -7))
  }

  return (
    <div
      onPointerDown={(event) => {
        swiped.current = false
        touch.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        touch.current = null
      }}
      onClickCapture={(event) => {
        if (!swiped.current) return
        swiped.current = false
        event.stopPropagation()
      }}
      className="touch-pan-y overflow-hidden select-none"
    >
      <ul
        key={dayKey(start)}
        aria-label={`Semana del ${format(start, "d 'de' MMMM")}`}
        className={cn(
          'grid grid-cols-7',
          direction && 'animate-in duration-200 fade-in',
          direction === 'next' && 'slide-in-from-right-8',
          direction === 'prev' && 'slide-in-from-left-8',
        )}
      >
        {days.map((day) => (
          <li key={dayKey(day)} className="flex h-16 flex-col items-center justify-center gap-1">
            <span aria-hidden className="text-[11px] font-bold text-subtle-foreground">
              {WEEKDAYS[(day.getDay() + 6) % 7]}
            </span>
            <DayButton
              day={day}
              selected={selected}
              today={today}
              marked={marked.has(dayKey(day))}
              onSelect={onSelect}
              size="strip"
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

interface MonthCalendarProps extends DayCalendarProps {
  month: Date
  onMonthChange: (month: Date) => void
  /** En escritorio, los círculos de 32 px y el número a 14 px (diseño 17, D4). */
  compact?: boolean
}

/**
 * El mes entero (diseño 17, C1, C5 y D4): «Septiembre 2026» con ‹ ›, la semana desde el lunes y los
 * días, los pasados en gris, cada uno con su punto si tiene algo. Elegir un día no lo pliega.
 */
export function MonthCalendar({
  month,
  onMonthChange,
  selected,
  today,
  onSelect,
  compact = false,
}: MonthCalendarProps) {
  const marked = useMarkedDays(month)
  const { start, end } = monthGrid(month)
  const weeks: Date[][] = []
  for (let day = start; day < end; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(day, index)))
  }
  const caption = capitalize(format(month, 'LLLL yyyy'))
  const nav =
    'grid size-9 place-items-center rounded-[10px] text-muted-foreground outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-9 items-center justify-between px-1">
        <h2 aria-live="polite" className="font-display text-base font-bold">
          {caption}
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => {
              onMonthChange(addMonths(month, -1))
            }}
            className={nav}
          >
            <ChevronLeft aria-hidden className="size-[18px]" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => {
              onMonthChange(addMonths(month, 1))
            }}
            className={nav}
          >
            <ChevronRight aria-hidden className="size-[18px]" strokeWidth={2.2} />
          </button>
        </div>
      </div>
      <div
        aria-hidden
        className="grid grid-cols-7 text-center text-[11px] font-bold text-subtle-foreground"
      >
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <table className="w-full table-fixed border-collapse" aria-label={caption}>
        <tbody>
          {weeks.map((week) => (
            <tr key={dayKey(week[0] ?? start)}>
              {week.map((day) => (
                <td key={dayKey(day)} className="h-10 p-0">
                  {isSameMonth(day, month) && (
                    <DayButton
                      day={day}
                      selected={selected}
                      today={today}
                      marked={marked.has(dayKey(day))}
                      onSelect={onSelect}
                      size={compact ? 'compact' : 'month'}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface DayButtonProps {
  day: Date
  selected: Date
  today: Date
  marked: boolean
  onSelect: (day: Date) => void
  size: 'strip' | 'month' | 'compact'
}

/**
 * Un día del calendario (diseño 17): el número en un círculo y su punto debajo. Hoy va en
 * `primary`; el elegido, relleno (en `primary` si es hoy, en `foreground` si es otro). En el mes,
 * los pasados en gris; en la tira, no.
 */
function DayButton({ day, selected, today, marked, onSelect, size }: DayButtonProps) {
  const isToday = dayTense(day, today) === 'today'
  const isSelected = dayKey(day) === dayKey(selected)
  const past = size !== 'strip' && dayTense(day, today) === 'past'
  return (
    <button
      type="button"
      aria-label={`${capitalize(format(day, "EEEE d 'de' MMMM"))}${marked ? ', con cosas' : ''}`}
      aria-pressed={isSelected}
      aria-current={isToday ? 'date' : undefined}
      onClick={() => {
        onSelect(day)
      }}
      className="group mx-auto flex flex-col items-center gap-0.5 rounded-full outline-none"
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full tabular-nums transition-colors group-hover:bg-fill group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50',
          size === 'strip' && 'size-9 font-display text-[15px] font-semibold',
          size === 'month' && 'size-[34px] text-[15px] font-medium',
          size === 'compact' && 'size-8 text-sm font-medium',
          past && 'text-subtle-foreground',
          isToday && 'font-extrabold text-primary',
          isSelected &&
            (isToday
              ? 'bg-primary text-primary-foreground group-hover:bg-primary'
              : 'bg-foreground font-extrabold text-background group-hover:bg-foreground'),
        )}
      >
        {format(day, 'd')}
      </span>
      <span
        aria-hidden
        className={cn(
          'size-1 rounded-full',
          marked ? (isSelected ? 'bg-foreground' : 'bg-subtle-foreground') : 'bg-transparent',
        )}
      />
    </button>
  )
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * La columna del mes en escritorio (diseño 17, D4–D6 y D8), a la derecha del día: el mes, «Volver
 * a hoy» en otro día y la pista de los puntos y las teclas. Cuando se abre un ítem, su ficha
 * ocupa este sitio (decisión de Fran, 2026-10-05).
 */
export function DayAside({ selected, today, onSelect }: DayCalendarProps) {
  const [month, setMonth] = useVisibleMonth(selected)
  return (
    <aside
      aria-label="Calendario"
      className="flex h-dvh w-[340px] flex-col gap-4 overflow-y-auto border-l border-border-soft bg-secondary px-6 py-9"
    >
      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        today={today}
        onSelect={onSelect}
        compact
      />
      {dayTense(selected, today) !== 'today' && (
        <button
          type="button"
          onClick={() => {
            onSelect(today)
          }}
          className="h-10 rounded-xl bg-brand-tint text-sm font-bold text-primary-strong outline-none hover:bg-brand-tint/80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Volver a hoy
        </button>
      )}
      <p className="px-1 text-[12.5px] leading-normal text-subtle-foreground">
        Un punto: ese día hay algo (eventos, lo que vence, lo hecho o lo apuntado). ← → cambian de
        día; T vuelve a hoy.
      </p>
    </aside>
  )
}
