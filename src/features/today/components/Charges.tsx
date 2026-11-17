import { Repeat } from 'lucide-react'

import {
  isAutoPayment,
  ListScope,
  paymentRepeatLabel,
  RowPrice,
  RowTitle,
  useItemActions,
} from '@/features/items'
import { LIST_COLOR_BG } from '@/features/lists'
import { cn } from '@/lib/utils'

import type { TodayCharge, TodayItem } from '../today'

/**
 * «Cobros» en un día que viene (6.5, Fran 2026-11-16): lo que se cobra ese día, todos los meses,
 * como los eventos que se repiten. Es información: la fila no tiene casilla; su título abre la ficha. Lo que
 * se cobra solo dice «Se cobra solo»; las veces siguientes de lo que se paga a mano, «Lo pagas tú».
 */
export function Charges({ charges }: { charges: readonly TodayCharge[] }) {
  return (
    <section aria-labelledby="hoy-cobros" className="flex flex-col gap-2.5">
      <h2
        id="hoy-cobros"
        className="px-1 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase"
      >
        Cobros
      </h2>
      <ul aria-label="Cobros" className="flex flex-col gap-2.5">
        {charges.map(({ item, list }) => (
          <li key={item.id}>
            <ListScope list={list}>
              <ChargeRow item={item} />
            </ListScope>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ChargeRow({ item }: { item: TodayItem }) {
  const actions = useItemActions()
  const { list } = actions
  const route = item.parent ? `${list.name} › ${item.parent.title}` : list.name
  const repeat = paymentRepeatLabel(item, { bare: true })
  // La fila es `relative`: el título (`RowTitle`) es el botón que abre la ficha y se estira a toda
  // ella (`after:absolute inset-0`). Sin `relative`, se estiraba a toda la pantalla y cualquier clic
  // en el centro abría la ficha del cobro (bug del 2026-11-16).
  return (
    <div className="relative flex min-h-14 w-full items-center gap-3.5 rounded-[18px] border border-border-soft bg-card px-4 py-3 hover:border-border hover:shadow-card md:gap-4 md:rounded-2xl md:pr-4 md:pl-[18px]">
      <span
        aria-hidden
        className={cn('w-[3px] self-stretch rounded-full', LIST_COLOR_BG[list.color])}
      />
      <span className="min-w-0 flex-1">
        <RowTitle item={item} />
        {/* Primero quién paga y cada cuánto; la ruta, al final, se corta si no cabe. */}
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground md:text-[13px]">
          <span className="shrink-0">{isAutoPayment(item) ? 'Se cobra solo' : 'Lo pagas tú'}</span>
          {repeat && (
            <>
              <span aria-hidden>·</span>
              <Repeat aria-hidden className="size-3 shrink-0" strokeWidth={2.4} />
              <span className="shrink-0">{repeat}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span className="truncate">{route}</span>
        </span>
      </span>
      <RowPrice item={item} className="self-center" />
    </div>
  )
}
