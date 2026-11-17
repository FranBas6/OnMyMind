import { format, isSameYear } from 'date-fns'
import { Gift, Repeat } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'

import { useCurrentUser } from '@/features/profile'
import { ReminderBell } from '@/features/reminders'
import { useItemReminder } from '@/features/reminders'
import { showsBell } from '@/features/reminders'
import { PersonInitial } from '@/features/sharing'
import { useListSharing } from '@/features/sharing'
import { cn } from '@/lib/utils'

import { paymentsOf, useListPayments } from './usePayments'
import { isAutoPayment, isRecurringPayment, paymentRepeatLabel, paymentWhen } from './payments'
import type { Item } from '../types'

const META = 'text-xs font-semibold whitespace-nowrap text-muted-foreground md:text-[13px]'

/**
 * Lo de debajo del título en la fila de un pago pendiente (diseño 30, L1, L2 y B3): «Jue 3 dic · ↻
 * Cada mes · el 3 · 🔔», con «Hoy» en negrita y «Venció el 12» en rojo; de una vez, «Antes del lun
 * 30». En prueba, solo «🎁 Prueba · cobra desde el 20», en índigo. En una lista compartida, al
 * final, quién pagó la última vez («M pagó el 1 nov»). `extra`, lo que va detrás (el clip).
 */
export function PaymentMeta({
  item,
  extra,
  className,
}: {
  item: Item
  extra?: ReactNode
  className?: string
}) {
  const when = paymentWhen(item)
  const paid = useLastPaid(item)
  const reminder = useItemReminder(item.id)
  if (!when) return null
  if (when.tone === 'trial') {
    return (
      <p className={cn('flex min-w-0 items-center gap-1', META, 'text-primary', className)}>
        <Gift aria-hidden className="size-3 shrink-0" strokeWidth={2.4} />
        <span className="truncate">{when.text}</span>
      </p>
    )
  }
  // Lo que se cobra solo ya dice el día en «Se cobra el 2 dic»: solo cada cuánto (6.5).
  const repeat = paymentRepeatLabel(item, { bare: isAutoPayment(item) })
  const parts: ReactNode[] = [
    <span
      key="when"
      className={cn(
        when.tone === 'today' && 'font-bold text-foreground',
        when.tone === 'overdue' && 'text-error',
      )}
    >
      {when.text}
    </span>,
  ]
  if (repeat) {
    parts.push(
      <span key="repeat" className="flex min-w-0 items-center gap-1">
        <Repeat aria-hidden className="size-3 shrink-0" strokeWidth={2.4} />
        <span className="truncate">{repeat}</span>
      </span>,
    )
  }
  if (showsBell(reminder, item)) parts.push(<ReminderBell key="bell" item={item} />)
  if (paid) parts.push(paid)
  if (extra) parts.push(<Fragment key="extra">{extra}</Fragment>)
  return (
    <p className={cn('flex min-w-0 items-center gap-1.5', META, className)}>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <Dot />}
          {part}
        </Fragment>
      ))}
    </p>
  )
}

function Dot() {
  return <span aria-hidden>·</span>
}

/**
 * En una lista compartida, quién pagó la última vez un pago que se repite (B3): su inicial y
 * «pagó el 1 nov», o «pagaste» si fuiste tú.
 */
function useLastPaid(item: Item): ReactNode {
  const { shared, people } = useListSharing(item.listId)
  const me = useCurrentUser()
  const recurring = isRecurringPayment(item)
  const payments = useListPayments(item.listId, shared && recurring)
  if (!shared || !recurring) return null
  const [last] = paymentsOf(payments, item.id)
  if (!last) return null
  const person = people.find((entry) => entry.userId === last.paidBy)
  const mine = last.paidBy === null || last.paidBy === me.id
  const now = new Date()
  const day = format(last.paidAt, isSameYear(last.paidAt, now) ? 'd MMM' : 'd MMM yyyy')
  return (
    <span key="paid" className="flex min-w-0 items-center gap-1">
      {person && <PersonInitial name={person.displayName} isOwner={person.isOwner} size="xs" />}
      <span className="truncate">
        {mine ? 'pagaste' : 'pagó'} el {day}
      </span>
    </span>
  )
}
