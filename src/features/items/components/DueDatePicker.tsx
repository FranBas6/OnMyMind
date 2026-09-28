import { addDays, format, isSameDay, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale'

import { formatMonthCaption } from '@/lib/date'
import { cn } from '@/lib/utils'

interface DueDatePickerProps {
  value: Date | null
  onChange: (date: Date | null) => void
}

/**
 * Selector de fecha límite (diseño 06, T5 y D5): atajos «Hoy» (tinte índigo), «Mañana» y «Quitar
 * fecha» (rojo) encima del calendario; la semana empieza en lunes; hoy con borde índigo y el día
 * elegido relleno; los días pasados en gris, pero se pueden elegir (una tarea puede estar
 * atrasada). Devuelve el día a las 00:00 locales: la hora no importa en una fecha límite.
 */
export function DueDatePicker({ value, onChange }: DueDatePickerProps) {
  const today = startOfDay(new Date())
  const pick = (date: Date | null) => {
    onChange(date ? startOfDay(date) : null)
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-2">
        <Shortcut
          active={value !== null && isSameDay(value, today)}
          onClick={() => {
            pick(today)
          }}
          className="border-brand-tint bg-brand-tint text-primary-strong"
        >
          Hoy
        </Shortcut>
        <Shortcut
          active={value !== null && isSameDay(value, addDays(today, 1))}
          onClick={() => {
            pick(addDays(today, 1))
          }}
        >
          Mañana
        </Shortcut>
        {value !== null && (
          <Shortcut
            onClick={() => {
              pick(null)
            }}
            className="text-error"
          >
            Quitar fecha
          </Shortcut>
        )}
      </div>

      <DayPicker
        mode="single"
        locale={es}
        weekStartsOn={1}
        selected={value ?? undefined}
        defaultMonth={value ?? today}
        onSelect={(date) => {
          if (date) pick(date)
        }}
        modifiers={{ past: { before: today } }}
        formatters={{
          formatCaption: formatMonthCaption,
          formatWeekdayName: (date) => format(date, 'EEEEE').toUpperCase(),
        }}
        components={{
          Chevron: ({ orientation }) =>
            orientation === 'left' ? (
              <ChevronLeft aria-hidden className="size-[18px]" strokeWidth={2.2} />
            ) : (
              <ChevronRight aria-hidden className="size-[18px]" strokeWidth={2.2} />
            ),
        }}
        classNames={{
          root: 'relative',
          months: 'flex flex-col',
          month: 'flex flex-col gap-2',
          month_caption: 'flex h-9 items-center justify-center',
          caption_label: 'font-display text-[15px] font-bold',
          nav: 'absolute inset-x-1 top-0 flex h-9 items-center justify-between',
          button_previous:
            'grid size-9 place-items-center rounded-xl text-muted-foreground outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50',
          button_next:
            'grid size-9 place-items-center rounded-xl text-muted-foreground outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50',
          month_grid: 'w-full border-collapse',
          weekdays: 'flex gap-1',
          weekday:
            'flex h-6 flex-1 items-center justify-center text-[11px] font-bold text-subtle-foreground',
          week: 'mt-1 flex gap-1',
          day: 'flex-1 p-0 text-center',
          day_button:
            'mx-auto flex h-[42px] w-full items-center justify-center rounded-xl text-sm font-semibold outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-9',
          today: '[&>button]:border-2 [&>button]:border-primary',
          selected:
            '[&>button]:bg-primary [&>button]:font-bold [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
          outside: 'invisible',
        }}
        modifiersClassNames={{ past: '[&>button]:font-medium [&>button]:text-subtle-foreground' }}
      />
    </div>
  )
}

function Shortcut({
  active = false,
  onClick,
  className,
  children,
}: {
  active?: boolean
  onClick: () => void
  className?: string
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-[13px] font-semibold whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-8 md:px-3 md:text-xs',
        className,
      )}
    >
      {children}
    </button>
  )
}
