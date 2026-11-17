import { differenceInCalendarDays, format, isSameMonth, isSameYear } from 'date-fns'
import { Check, Gift, Landmark } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Switch } from '@/components/controls/Switch'
import { useCurrentUser } from '@/features/profile'
import { personName } from '@/features/sharing'
import { PersonInitial } from '@/features/sharing'
import { useListSharing } from '@/features/sharing'
import { formatCents } from '@/lib/money'

import { inTrial, isRecurringPayment, paymentDateLong } from './payments'
import type { Item, ItemPatch, Payment } from '../types'
import { DueDateField } from '../dates/DueDateField'
import { RepeatField } from '../dates/RepeatField'

const SECTION_LABEL = 'text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase'
const BOX =
  'divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-card'

/**
 * La caja «Pago» de una compra (diseño 30, F1, F2, F6 y P1), justo debajo del precio. Sin fecha, una
 * sola fila, «Fecha de pago · Añadir»: una compra normal solo crece una línea. Con fecha, «Repetir»
 * y el aviso, como en la tarea; si se repite, «Es una prueba», que cambia la fecha por «Empieza a
 * cobrar» y dice debajo que aún no cuenta.
 */
export function PaymentBox({
  item,
  isDesktop,
  reminder,
  onChange,
  onTrial,
}: {
  item: Item
  isDesktop: boolean
  /** La fila del aviso y su línea de debajo (`useReminderField`). */
  reminder: { row: ReactNode; note: ReactNode }
  onChange: (patch: ItemPatch) => void
  /** «Es una prueba»: la ficha propone también el aviso de dos días antes. */
  onTrial: (trial: boolean) => void
}) {
  const now = new Date()
  const dated = item.dueAt !== null
  const recurring = isRecurringPayment(item)
  const trial = item.trial && recurring
  return (
    <section aria-label="Pago" className="flex flex-col gap-2">
      <p className={SECTION_LABEL}>Pago</p>
      <div className={BOX}>
        <DueDateField
          item={item}
          isDesktop={isDesktop}
          label={trial ? 'Empieza a cobrar' : 'Fecha de pago'}
          display={paymentDateLong(item, now)}
          empty="add"
          onChange={(dueAt) => {
            onChange({ dueAt })
          }}
        />
        {dated && <RepeatField item={item} isDesktop={isDesktop} onChange={onChange} />}
        {dated && recurring && (
          <label className="flex h-13 w-full cursor-pointer items-center justify-between gap-3 px-4 text-[15px]">
            <span className="flex items-center gap-2.5 font-medium">
              <Landmark aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />
              Se cobra solo
            </span>
            <Switch
              label="Se cobra solo"
              checked={item.autoPay}
              onCheckedChange={(autoPay) => {
                onChange({ autoPay })
              }}
            />
          </label>
        )}
        {dated && recurring && (
          <label className="flex h-13 w-full cursor-pointer items-center justify-between gap-3 px-4 text-[15px]">
            <span className="flex items-center gap-2.5 font-medium">
              <Gift aria-hidden className="size-4 text-primary" strokeWidth={2} />
              Es una prueba
            </span>
            <Switch label="Es una prueba" checked={item.trial} onCheckedChange={onTrial} />
          </label>
        )}
        {dated && reminder.row}
      </div>
      {item.dueAt && inTrial(item, now) && (
        <p className="flex gap-1.5 px-1 text-[13px] leading-snug text-muted-foreground">
          <Gift aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
          Aún no cuenta en el total. Si te das de baja antes del{' '}
          {isSameMonth(item.dueAt, now) && isSameYear(item.dueAt, now)
            ? format(item.dueAt, 'd')
            : format(item.dueAt, 'd MMM')}
          , no pagas nada.
        </p>
      )}
      {/* Qué hace «Se cobra solo» (6.5), en una línea gris como la de la prueba. */}
      {dated && recurring && !inTrial(item, now) && (
        <p className="px-1 text-[13px] leading-snug text-muted-foreground">
          {item.autoPay
            ? 'El día del cobro se apunta solo como pagado y pasa al siguiente.'
            : 'Saldrá en Hoy el día del cobro para que lo pagues tú.'}
        </p>
      )}
      {dated && reminder.note}
    </section>
  )
}

/** Cuántos pagos se ven antes de «Ver los N» (F1). */
const SHOWN = 3

/**
 * «Pagos» (diseño 30, F1, F5 y B4): los últimos, con su fecha y lo pagado; «Ver los N» enseña el
 * resto. En una lista compartida, quién pagó cada vez, con su inicial en vez del check.
 */
export function PaymentHistory({ item, payments }: { item: Item; payments: readonly Payment[] }) {
  const [all, setAll] = useState(false)
  const { shared, people } = useListSharing(item.listId)
  const me = useCurrentUser()
  if (payments.length === 0) return null
  const now = new Date()
  const shown = all ? payments : payments.slice(0, SHOWN)
  return (
    <section aria-label="Pagos" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className={SECTION_LABEL}>Pagos</p>
        {!all && payments.length > SHOWN && (
          <button
            type="button"
            onClick={() => {
              setAll(true)
            }}
            className="rounded-md text-[13px] font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Ver los {payments.length}
          </button>
        )}
      </div>
      <ul className={BOX}>
        {shown.map((payment) => {
          const person =
            shared && payment.paidBy
              ? (people.find((entry) => entry.userId === payment.paidBy) ?? null)
              : null
          const mine = payment.paidBy === null || payment.paidBy === me.id
          // Lo que apuntó la base porque se cobra solo (6.5): «Cobrado».
          const who = payment.auto
            ? 'Cobrado'
            : !shared
              ? 'Pagado'
              : mine
                ? 'Pagaste'
                : `Pagado por ${personName(person?.displayName)}`
          return (
            <li key={payment.id} className="flex h-12 items-center gap-3 px-4 text-[15px]">
              {shared && person ? (
                <PersonInitial name={person.displayName} isOwner={person.isOwner} size="xs" />
              ) : (
                <span className="grid size-[18px] shrink-0 place-items-center rounded-[6px] bg-success-bg text-success">
                  <Check aria-hidden className="size-3" strokeWidth={3} />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">
                {who} · {paidDay(payment.paidAt, now)}
              </span>
              {payment.priceCents !== null && (
                <span className="font-display font-extrabold">
                  {formatCents(payment.priceCents, payment.currency ?? 'EUR')}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** «hoy, 15 nov», «3 nov», «3 nov 2025». */
function paidDay(day: Date, now: Date): string {
  const date = format(day, isSameYear(day, now) ? 'd MMM' : 'd MMM yyyy')
  return differenceInCalendarDays(now, day) === 0 ? `hoy, ${date}` : date
}
