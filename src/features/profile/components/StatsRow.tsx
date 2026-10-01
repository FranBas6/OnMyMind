import { useArchivedLists, useLists } from '@/features/lists'
import { useSavings } from '@/features/prices'
import { formatCents } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * Las cifras de Perfil (diseño 09 y 16, C1–C3): lo que ya está fuera de la cabeza, de todas tus
 * listas (también las archivadas), cuántas listas tienes sin contar «En mente» y lo ahorrado (2.2):
 * lo que bajaron tus compras desde su primer precio hasta que las compraste, en verde si hay algo.
 * Las dos primeras salen de los contadores en caché; lo ahorrado lo suma la base (`price_savings`).
 */
export function StatsRow() {
  const lists = useLists()
  const archived = useArchivedLists()
  const savings = useSavings()
  if (!lists.data) return null

  const all = [
    ...(lists.data.inbox ? [lists.data.inbox] : []),
    ...lists.data.lists,
    ...(archived.data ?? []),
  ]
  const done = all.reduce((total, list) => total + list.counters.done, 0)

  return (
    <div className="flex flex-col gap-2 md:max-w-[560px]">
      <dl className="flex gap-2.5 md:gap-3">
        <Stat value={done.toLocaleString('es-ES')} label="fuera de la cabeza" />
        <Stat value={lists.data.lists.length.toLocaleString('es-ES')} label="listas" />
        {savings.data !== undefined && (
          <Stat
            value={formatCents(savings.data)}
            label="ahorrado"
            className={savings.data > 0 ? 'text-price-down' : undefined}
          />
        )}
      </dl>
      {savings.data !== undefined && (
        <p className="px-1 text-[13px] leading-snug text-muted-foreground">
          {savings.data > 0
            ? 'Lo que bajaron tus compras desde su primer precio hasta que las compraste.'
            : 'Cuando compres algo que bajó desde su primer precio, lo verás aquí.'}
        </p>
      )}
    </div>
  )
}

function Stat({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col-reverse rounded-2xl border border-border-soft bg-card px-3.5 py-3">
      <dt className="mt-0.5 text-[12.5px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'truncate font-display text-[22px] font-extrabold tracking-[-0.02em]',
          className,
        )}
      >
        {value}
      </dd>
    </div>
  )
}
