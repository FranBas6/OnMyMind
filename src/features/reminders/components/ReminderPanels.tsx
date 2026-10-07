import { addDays, nextMonday, set, startOfDay } from 'date-fns'
import { BellOff, Check, ChevronRight, CircleAlert, Repeat, WifiOff } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { repeats } from '@/features/items/recurrence'
import { DueDatePicker } from '@/features/items/components/DueDatePicker'
import { SheetHeader } from '@/features/items/components/FieldRow'
import type { Item } from '@/features/items/types'
import { cn } from '@/lib/utils'

import type { ReminderChoice } from '../hooks/useReminders'
import type { PushState } from '../push'
import {
  DATED_HOUR,
  optionWhen,
  reminderOptions,
  reminderRowLabel,
  reminderSheetSubtitle,
  reminderShape,
  repeatingReminderNote,
  type Reminder,
} from '../reminders'
import type { PushPromptKind } from './PushPrompt'

/**
 * Las opciones (R6–R8, R11, A7): «Sin aviso», las de su forma con cuándo sonaría cada una a la
 * derecha («Ya pasó» en gris, sin poder elegirse) y «Personalizado…». La elegida en `brand-tint`
 * con su check. Elegir guarda; en el móvil, «Listo» cierra.
 */
export function ReminderOptions({
  item,
  reminder,
  state,
  isDesktop,
  onChoose,
  onCustom,
  onDone,
}: {
  item: Item
  reminder: Reminder | undefined
  state: PushState | undefined
  isDesktop: boolean
  onChoose: (choice: ReminderChoice | null) => void
  onCustom: () => void
  onDone: () => void
}) {
  const options = reminderOptions(item)
  const customChosen =
    reminder !== undefined &&
    !options.some((option) => option.offsetMinutes === reminder.offsetMinutes)
  return (
    <div className="flex flex-col gap-3 md:gap-1">
      {!isDesktop && <SheetHeader title="Aviso" onDone={onDone} />}
      {!isDesktop && (
        <p className="-mt-2 text-[13px] text-muted-foreground">{reminderSheetSubtitle(item)}</p>
      )}
      {state === 'unsupported' && (
        <p className="flex gap-2 rounded-xl bg-fill px-3.5 py-2.5 text-[13px] leading-normal text-muted-foreground">
          <BellOff aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
          Este navegador no puede mostrar avisos. Se guarda igual y sonará donde los tengas
          activados.
        </p>
      )}
      <div role="radiogroup" aria-label="Aviso" className="flex flex-col gap-0.5">
        <Option
          label="Sin aviso"
          selected={reminder === undefined}
          onClick={() => {
            onChoose(null)
          }}
        />
        {options.map((option) => {
          const when = optionWhen(item, option.offsetMinutes)
          return (
            <Option
              key={option.offsetMinutes}
              label={option.label}
              when={when ?? 'Ya pasó'}
              disabled={when === null}
              selected={reminder?.offsetMinutes === option.offsetMinutes}
              onClick={() => {
                onChoose({ offsetMinutes: option.offsetMinutes })
              }}
            />
          )
        })}
        <button
          type="button"
          onClick={onCustom}
          className={cn(
            'flex h-13 items-center justify-between gap-3 rounded-2xl px-3 text-left text-[15px] font-medium outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-11 md:rounded-xl',
            customChosen && 'bg-brand-tint font-semibold text-primary-strong hover:bg-brand-tint',
          )}
        >
          Personalizado…
          <span className="flex items-center gap-1.5 text-[13px]">
            {customChosen && reminderRowLabel(reminder, item)}
            <ChevronRight aria-hidden className="size-4 text-subtle-foreground" strokeWidth={2} />
          </span>
        </button>
      </div>
      {reminderShape(item) === 'undated' && (
        <p className="text-[13px] leading-normal text-muted-foreground md:px-3 md:pb-1">
          Sin fecha solo puedes elegir el día y la hora a mano. Si le pones fecha, salen las
          opciones de siempre.
        </p>
      )}
    </div>
  )
}

function Option({
  label,
  when,
  selected,
  disabled = false,
  onClick,
}: {
  label: string
  when?: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-13 items-center justify-between gap-3 rounded-2xl px-3 text-left text-[15px] font-medium outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:text-subtle-foreground disabled:hover:bg-transparent md:h-11 md:rounded-xl',
        selected && 'bg-brand-tint font-semibold text-primary-strong hover:bg-brand-tint',
      )}
    >
      {label}
      <span className="flex items-center gap-2 text-[13px] font-semibold">
        {when && (
          <span className={selected ? 'text-primary-strong' : 'text-muted-foreground'}>{when}</span>
        )}
        {selected && <Check aria-hidden className="size-4" strokeWidth={2.4} />}
      </span>
    </button>
  )
}

/**
 * «Personalizado…» (R9, R10): atajos, el calendario y la hora (en el iPhone, la rueda del
 * sistema). Un momento que ya pasó deja «Listo» en gris y lo dice en rojo bajo la hora.
 */
export function CustomReminder({
  item,
  reminder,
  isDesktop,
  onDone,
  onBack,
}: {
  item: Item
  reminder: Reminder | undefined
  isDesktop: boolean
  onDone: (remindAt: Date) => void
  onBack: () => void
}) {
  const now = new Date()
  const [value, setValue] = useState<Date>(() => {
    if (reminder?.offsetMinutes === null) return reminder.remindAt
    const day =
      item.dueAt && item.dueAt > now ? startOfDay(item.dueAt) : addDays(startOfDay(now), 1)
    return set(day, { hours: DATED_HOUR })
  })
  const past = value <= now
  const hhmm = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-3.5 md:p-1.5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="font-display text-xl font-extrabold tracking-[-0.02em] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-base"
        >
          Avisar el…
        </button>
        <button
          type="button"
          disabled={past}
          onClick={() => {
            onDone(value)
          }}
          className="h-9 rounded-lg px-1 font-display text-[15px] font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:text-subtle-foreground"
        >
          Listo
        </button>
      </div>
      <DueDatePicker
        value={value}
        clearable={false}
        shortcuts={[{ label: 'Lunes', date: nextMonday(startOfDay(now)) }]}
        onChange={(day) => {
          if (day) setValue(set(day, { hours: value.getHours(), minutes: value.getMinutes() }))
        }}
      />
      <label
        className={cn(
          'relative flex h-13 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border-soft bg-card px-4 text-[15px]',
          isDesktop && 'h-11 rounded-xl',
        )}
      >
        <span className="font-medium">Hora</span>
        <input
          type="time"
          step={300}
          aria-label="Hora del aviso"
          aria-invalid={past}
          value={hhmm}
          onChange={(event) => {
            const [hours, minutes] = event.target.value.split(':').map(Number)
            if (hours === undefined || minutes === undefined || Number.isNaN(hours)) return
            setValue(set(value, { hours, minutes, seconds: 0, milliseconds: 0 }))
          }}
          className={cn(
            'bg-transparent text-right font-semibold outline-none',
            past && 'text-error',
          )}
        />
      </label>
      {past ? (
        <p role="alert" className="flex gap-1.5 text-[13px] leading-normal text-error">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
          Ese momento ya pasó. Elige uno a partir de ahora.
        </p>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          Este aviso se queda en su día aunque cambies la fecha.
        </p>
      )}
    </div>
  )
}

/**
 * La línea de debajo de la caja (R4, R5, R14, A4, A5): sin conexión, lo que falta para que suene
 * aquí (activar, desbloquear o instalar) y, si se repite, el próximo aviso; o que el personalizado
 * se queda en su sitio.
 */
export function ReminderNote({
  item,
  reminder,
  state,
  online,
  device,
  onPrompt,
}: {
  item: Item
  reminder: Reminder
  state: PushState | undefined
  online: boolean
  device: string
  onPrompt: (kind: PushPromptKind) => void
}) {
  const sent = reminder.sentAt !== null && !repeats(item.recurrence)
  const repeating = repeatingReminderNote(reminder, item)
  const lines: ReactNode[] = []
  if (!online) {
    lines.push(
      <Line key="offline" icon={WifiOff}>
        Sin conexión. Está guardado y quedará listo al volver la red.
      </Line>,
    )
  }
  if (!sent && state === 'off') {
    lines.push(
      <Line key="off">
        No sonará en {device} hasta que actives los avisos.{' '}
        <Action
          onClick={() => {
            onPrompt('activate')
          }}
        >
          Activar
        </Action>
      </Line>,
    )
  } else if (!sent && state === 'denied') {
    lines.push(
      <Line key="denied">
        Los avisos están bloqueados en {device}.{' '}
        <Action
          onClick={() => {
            onPrompt('denied')
          }}
        >
          Cómo activarlos
        </Action>
      </Line>,
    )
  } else if (!sent && state === 'needs-install') {
    lines.push(
      <Line key="install">
        Sonará cuando instales la app en {device}.{' '}
        <Action
          onClick={() => {
            onPrompt('install')
          }}
        >
          Cómo instalarla
        </Action>
      </Line>,
    )
  }
  if (repeating) {
    lines.push(
      <Line key="repeat" icon={Repeat}>
        {repeating}
      </Line>,
    )
  } else if (reminder.offsetMinutes === null) {
    lines.push(
      <Line key="custom">
        Personalizado: se queda en ese momento aunque{' '}
        {item.dueAt ? 'cambies la fecha' : 'le pongas fecha'}.
      </Line>,
    )
  }
  return lines.length > 0 ? <div className="flex flex-col gap-1">{lines}</div> : null
}

function Line({ icon: Icon, children }: { icon?: typeof Repeat; children: ReactNode }) {
  return (
    <p className="flex gap-1.5 text-[13px] leading-normal text-muted-foreground">
      {Icon && <Icon aria-hidden className="mt-[3px] size-3.5 shrink-0" strokeWidth={2.2} />}
      <span>{children}</span>
    </p>
  )
}

function Action({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-semibold text-primary outline-none hover:text-primary-hover focus-visible:underline"
    >
      {children}
    </button>
  )
}
