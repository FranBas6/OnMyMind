import { formatCents } from '@/lib/money'

import { othersLabel, type PriceTotals } from '../prices'

/**
 * El total de lo pendiente, a la derecha de la cabecera de una lista o de una sublista (diseño 16,
 * A1–A3 y D1): «TOTAL · 627 €», y otras monedas en una línea gris debajo («y 49 US$ aparte»). Sin
 * ninguna compra pendiente con precio no sale (A4).
 */
export function PriceTotal({ totals }: { totals: PriceTotals }) {
  const others = othersLabel(totals.others)
  if (totals.euros === 0 && !others) return null
  return (
    <div className="shrink-0 text-right">
      <p className="text-[11px] font-bold tracking-[0.08em] text-subtle-foreground uppercase">
        Total
      </p>
      <p className="font-display text-[26px] leading-none font-extrabold tracking-[-0.03em] md:text-[28px]">
        <span className="sr-only">pendiente: </span>
        {formatCents(totals.euros)}
      </p>
      {others && <p className="mt-1 text-xs text-subtle-foreground">{others}</p>}
    </div>
  )
}
