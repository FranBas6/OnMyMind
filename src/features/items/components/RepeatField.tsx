import { format, isSameYear, startOfDay } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Repeat } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { cn } from '@/lib/utils'

import {
  DAY_LETTERS,
  DAY_NAMES,
  FREQS,
  firstOccurrence,
  formatRule,
  ORDINAL_NAMES,
  ORDINALS,
  parseRule,
  PRESETS,
  presetHint,
  presetOf,
  presetRule,
  ruleLabel,
  ruleShortLabel,
  simpleRule,
  WEEKDAYS,
  weekdayOf,
  type Freq,
  type Ordinal,
  type Rule,
  type Weekday,
} from '../recurrence'
import type { Item, ItemPatch } from '../types'
import { Row, SheetHeader } from './FieldRow'
import { SegmentedControl } from './SegmentedControl'

const MAX_INTERVAL = 99

const UNIT_NAMES: Record<Freq, [one: string, many: string, tab: string]> = {
  DAILY: ['día', 'días', 'Días'],
  WEEKLY: ['semana', 'semanas', 'Semanas'],
  MONTHLY: ['mes', 'meses', 'Meses'],
  YEARLY: ['año', 'años', 'Años'],
}

/**
 * «Repetir» en la ficha de un evento (en «Cuándo») y de una tarea (entre «Fecha límite» y el
 * aviso), diseño 21, B1–B8 y D3–D4. La fila dice la regla entera («Cada 2 semanas, lunes y
 * jueves», en dos líneas si hace falta). Abre las de siempre (Diaria, Semanal «los viernes»,
 * Mensual «el día 9», Anual «el 9 oct») y «Personalizada…», que cambia la hoja (o el popover) por
 * la suya: cada N días, semanas, meses o años, los días de la semana o un día del mes, con el
 * resumen y la próxima arriba. Se guarda al salir de ella.
 *
 * Al poner una regla, la fecha salta a la primera vez que la cumple (B6); sin fecha, a la próxima
 * desde hoy (B1). Dejar de repetir deja la fecha como está (B14).
 */
export function RepeatField({
  item,
  isDesktop,
  onChange,
}: {
  item: Item
  isDesktop: boolean
  onChange: (patch: ItemPatch) => void
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'options' | 'custom'>('options')
  const [draft, setDraft] = useState<Rule | null>(null)
  const [stopped, setStopped] = useState(false)
  const rule = parseRule(item.recurrence)
  const now = new Date()
  // Desde dónde cuenta una regla nueva: la fecha del ítem o, sin ella, hoy.
  const base = item.dueAt ?? startOfDay(now)
  const preset = rule ? presetOf(rule, item.dueAt) : null

  const save = (next: Rule | null) => {
    if (!next) {
      if (rule) setStopped(true)
      onChange({ recurrence: null })
      return
    }
    const due = firstOccurrence(base, next)
    if (formatRule(next) === item.recurrence && due.getTime() === item.dueAt?.getTime()) return
    // Un evento se queda con su hora (o de todo el día); una tarea, solo con el día.
    const dated: ItemPatch =
      item.kind === 'event' ? { dueAt: due, allDay: item.allDay } : { dueAt: due }
    onChange({
      recurrence: formatRule(next),
      ...(due.getTime() !== item.dueAt?.getTime() && dated),
    })
  }

  const close = () => {
    if (view === 'custom' && draft) save(draft)
    setOpen(false)
    setView('options')
    setDraft(null)
    setStopped(false)
  }
  const openCustom = () => {
    setDraft(rule ?? presetRule('WEEKLY', base))
    setView('custom')
  }
  const backToOptions = () => {
    if (draft) save(draft)
    setView('options')
  }

  const row = (
    <Row
      icon={Repeat}
      label="Repetir"
      onClick={() => {
        setOpen(true)
      }}
      highlighted={isDesktop && open}
      className="h-auto min-h-13 py-2.5"
    >
      {rule ? (
        <span className="max-w-[200px] text-right font-semibold whitespace-normal md:max-w-[240px]">
          {ruleLabel(rule)}
        </span>
      ) : (
        <span className="text-muted-foreground">No se repite</span>
      )}
    </Row>
  )

  const options = (
    <div className="flex flex-col gap-1">
      <div role="radiogroup" aria-label="Repetir" className="flex flex-col gap-0.5">
        <Option
          label="No se repite"
          selected={!rule}
          onClick={() => {
            save(null)
          }}
        />
        {PRESETS.map(({ freq, label }) => (
          <Option
            key={freq}
            label={label}
            hint={presetHint(freq, base, now)}
            selected={preset === freq}
            onClick={() => {
              setStopped(false)
              save(presetRule(freq, base))
              if (isDesktop) close()
            }}
          />
        ))}
        <Option
          label="Personalizada…"
          hint={rule && !preset ? ruleShortLabel(rule) : null}
          selected={rule !== null && !preset}
          more
          onClick={openCustom}
        />
      </div>
      {stopped && !rule && item.kind === 'task' && item.dueAt && (
        <p className="px-3 pt-2 text-[13px] leading-normal text-muted-foreground">
          Se queda con su fecha, el {format(item.dueAt, 'EEEE d')}. Al completarla bajará a «Fuera
          de la cabeza», como cualquier tarea.
        </p>
      )}
    </div>
  )

  const custom = draft && <CustomRepeat rule={draft} base={base} onChange={setDraft} />

  if (isDesktop) {
    return (
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          if (next) setOpen(true)
          else close()
        }}
      >
        <Popover.Anchor asChild>{row}</Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            aria-label={view === 'custom' ? 'Personalizada' : 'Repetir'}
            className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[340px] rounded-[18px] border border-border-soft bg-popover p-2 text-popover-foreground shadow-popover outline-none"
          >
            {view === 'custom' ? <div className="p-1.5">{custom}</div> : options}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <>
      {row}
      <BottomSheet
        nested
        open={open}
        onOpenChange={(next) => {
          if (next) setOpen(true)
          else close()
        }}
        title={view === 'custom' ? 'Personalizada' : 'Repetir'}
      >
        {view === 'custom' ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={backToOptions}
                aria-label="Volver a Repetir"
                className="-ml-1.5 grid size-9 place-items-center rounded-lg text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <ChevronLeft aria-hidden className="size-5" strokeWidth={2.4} />
              </button>
              <p className="flex-1 font-display text-xl font-extrabold tracking-[-0.02em]">
                Personalizada
              </p>
              <button
                type="button"
                onClick={close}
                className="h-9 rounded-lg px-1 font-display text-[15px] font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Listo
              </button>
            </div>
            {custom}
          </>
        ) : (
          <>
            <SheetHeader title="Repetir" onDone={close} />
            <p className="-mt-2 text-[13px] text-muted-foreground">{subtitle(item, now)}</p>
            {options}
          </>
        )}
      </BottomSheet>
    </>
  )
}

/** «Sacar la basura · vence el viernes 9», «Reunión de equipo · lunes 12 a las 10:00» (B2, B3). */
function subtitle(item: Item, now: Date): string {
  if (!item.dueAt) return `${item.title} · sin fecha`
  const day = format(item.dueAt, isSameYear(item.dueAt, now) ? 'EEEE d' : 'EEEE d MMM yyyy')
  if (item.kind === 'task') return `${item.title} · vence el ${day}`
  return item.allDay
    ? `${item.title} · ${day}`
    : `${item.title} · ${day} a las ${format(item.dueAt, 'H:mm')}`
}

function Option({
  label,
  hint = null,
  selected,
  more = false,
  onClick,
}: {
  label: string
  hint?: string | null
  selected: boolean
  /** «Personalizada…» abre otra pantalla: sin elegir, lleva su flecha. */
  more?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex h-13 items-center justify-between gap-3 rounded-2xl px-3 text-left text-[15px] font-medium outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-11 md:rounded-xl',
        selected && 'bg-brand-tint font-semibold text-primary-strong hover:bg-brand-tint',
      )}
    >
      <span>{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        {hint && (
          <span
            className={cn(
              'truncate text-sm font-normal',
              selected ? 'text-primary-strong' : 'text-muted-foreground',
            )}
          >
            {hint}
          </span>
        )}
        {selected ? (
          <Check aria-hidden className="size-4 shrink-0" strokeWidth={2.4} />
        ) : (
          more && <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
        )}
      </span>
    </button>
  )
}

/**
 * La repetición personalizada (B4–B6, D4): el resumen y la próxima, «Cada [N] [unidad]», y según
 * la unidad, los días de la semana o el día del mes.
 */
function CustomRepeat({
  rule,
  base,
  onChange,
}: {
  rule: Rule
  base: Date
  onChange: (rule: Rule) => void
}) {
  const next = firstOccurrence(base, rule)
  const [one, many] = UNIT_NAMES[rule.freq]

  const setFreq = (freq: Freq | null) => {
    if (!freq || freq === rule.freq) return
    // Cada unidad empieza con el día de la fecha: los viernes, el día 9.
    onChange({ ...simpleRule(freq), interval: rule.interval, ...presetParts(freq, base) })
  }
  const toggleDay = (day: Weekday) => {
    const has = rule.weekdays.includes(day)
    // Siempre queda al menos un día marcado.
    if (has && rule.weekdays.length === 1) return
    const weekdays = has ? rule.weekdays.filter((d) => d !== day) : [...rule.weekdays, day]
    onChange({ ...rule, weekdays: WEEKDAYS.filter((d) => weekdays.includes(d)) })
  }
  const nthDefault = { n: nthOf(base), day: weekdayOf(base) }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2.5 rounded-2xl bg-brand-tint px-4 py-3.5 text-primary-strong">
        <Repeat aria-hidden className="mt-1 size-4 shrink-0" strokeWidth={2.4} />
        <div className="min-w-0">
          <p className="font-display text-lg leading-snug font-extrabold tracking-[-0.01em]">
            {ruleLabel(rule)}
          </p>
          <p className="text-[13px]">Próxima: {format(next, 'EEEE d MMM')}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-medium">Cada</span>
        <div className="flex h-11 items-center rounded-2xl bg-fill">
          <button
            type="button"
            aria-label="Menos"
            disabled={rule.interval <= 1}
            onClick={() => {
              onChange({ ...rule, interval: rule.interval - 1 })
            }}
            className="grid size-11 place-items-center rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:text-subtle-foreground"
          >
            <Minus aria-hidden className="size-4" strokeWidth={2.4} />
          </button>
          <span aria-live="polite" className="w-8 text-center font-display text-lg font-extrabold">
            {rule.interval}
          </span>
          <button
            type="button"
            aria-label="Más"
            disabled={rule.interval >= MAX_INTERVAL}
            onClick={() => {
              onChange({ ...rule, interval: rule.interval + 1 })
            }}
            className="grid size-11 place-items-center rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:text-subtle-foreground"
          >
            <Plus aria-hidden className="size-4" strokeWidth={2.4} />
          </button>
        </div>
        <span className="min-w-16 text-right text-[15px] font-medium">
          {rule.interval === 1 ? one : many}
        </span>
      </div>

      <SegmentedControl<Freq>
        label="Unidad"
        options={FREQS.map((freq) => ({ value: freq, label: UNIT_NAMES[freq][2] }))}
        value={rule.freq}
        onChange={setFreq}
      />

      {rule.freq === 'WEEKLY' && (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase">
            Qué días
          </p>
          <div className="flex justify-between gap-1">
            {WEEKDAYS.map((day) => {
              const on = rule.weekdays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={DAY_NAMES[day]}
                  onClick={() => {
                    toggleDay(day)
                  }}
                  className={cn(
                    'grid size-11 place-items-center rounded-full font-display text-[15px] font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    on ? 'bg-primary text-primary-foreground' : 'bg-fill hover:bg-fill/70',
                  )}
                >
                  {DAY_LETTERS[day]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {rule.freq === 'MONTHLY' && (
        <div role="radiogroup" aria-label="Qué día del mes" className="flex flex-col gap-2.5">
          <p className="text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase">
            Qué día del mes
          </p>
          <MonthOption
            selected={rule.nthWeekday === null}
            label="El día del mes"
            onSelect={() => {
              onChange({ ...rule, nthWeekday: null, monthDay: rule.monthDay ?? base.getDate() })
            }}
          >
            <span>El día</span>
            <Select
              label="Día del mes"
              value={String(rule.monthDay ?? base.getDate())}
              options={Array.from({ length: 31 }, (_, i) => [String(i + 1), String(i + 1)])}
              onChange={(value) => {
                onChange({ ...rule, nthWeekday: null, monthDay: Number(value) })
              }}
            />
          </MonthOption>
          <MonthOption
            selected={rule.nthWeekday !== null}
            label="Un día de la semana del mes"
            onSelect={() => {
              onChange({ ...rule, monthDay: null, nthWeekday: rule.nthWeekday ?? nthDefault })
            }}
          >
            <span>El</span>
            <Select
              label="Cuál"
              value={String((rule.nthWeekday ?? nthDefault).n)}
              options={ORDINALS.map((n) => [String(n), ORDINAL_NAMES[n]])}
              onChange={(value) => {
                onChange({
                  ...rule,
                  monthDay: null,
                  nthWeekday: { ...(rule.nthWeekday ?? nthDefault), n: Number(value) as Ordinal },
                })
              }}
            />
            <Select
              label="Día de la semana"
              value={(rule.nthWeekday ?? nthDefault).day}
              options={WEEKDAYS.map((day) => [day, DAY_NAMES[day]])}
              onChange={(value) => {
                onChange({
                  ...rule,
                  monthDay: null,
                  nthWeekday: { ...(rule.nthWeekday ?? nthDefault), day: value as Weekday },
                })
              }}
            />
          </MonthOption>
        </div>
      )}
    </div>
  )
}

/** Lo que cada unidad toma de la fecha al elegirla: el día de la semana o el del mes. */
function presetParts(freq: Freq, base: Date): Partial<Rule> {
  const { weekdays, monthDay } = presetRule(freq, base)
  return { weekdays, monthDay }
}

/** Qué vez es ese día de la semana en su mes: el 9 de octubre es el segundo viernes. */
function nthOf(day: Date): Ordinal {
  const n = Math.ceil(day.getDate() / 7)
  return n > 4 ? -1 : (n as Ordinal)
}

function MonthOption({
  selected,
  label,
  onSelect,
  children,
}: {
  selected: boolean
  label: string
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex min-h-14 items-center gap-3 rounded-2xl border px-3.5 py-2 text-[15px] font-medium',
        selected
          ? 'border-primary bg-brand-tint text-primary-strong'
          : 'border-border-soft bg-card',
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={label}
        onClick={onSelect}
        className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-control outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:border-primary"
      >
        {selected && <span className="size-3 rounded-full bg-primary" />}
      </button>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

/** Un desplegable del sistema con el aspecto de los del diseño (B6). */
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly (readonly [value: string, text: string])[]
  onChange: (value: string) => void
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => {
        onChange(event.target.value)
      }}
      className="h-11 rounded-xl border border-border-soft bg-card px-3 text-base font-semibold text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {options.map(([optionValue, text]) => (
        <option key={optionValue} value={optionValue}>
          {text}
        </option>
      ))}
    </select>
  )
}
