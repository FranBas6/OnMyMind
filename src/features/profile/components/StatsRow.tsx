import { useArchivedLists, useLists } from '@/features/lists'

/**
 * Las dos cifras de Perfil (diseño 09): lo que ya está fuera de la cabeza, de todas tus listas
 * (también las archivadas), y cuántas listas tienes sin contar «En mente». Salen de los
 * contadores en caché. «Ahorrados» llega en la fase 2.
 */
export function StatsRow() {
  const lists = useLists()
  const archived = useArchivedLists()
  if (!lists.data) return null

  const all = [
    ...(lists.data.inbox ? [lists.data.inbox] : []),
    ...lists.data.lists,
    ...(archived.data ?? []),
  ]
  const done = all.reduce((total, list) => total + list.counters.done, 0)

  return (
    <dl className="flex gap-2.5 md:max-w-[420px] md:gap-3">
      <Stat value={done} label="fuera de la cabeza" />
      <Stat value={lists.data.lists.length} label="listas" />
    </dl>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-1 flex-col-reverse rounded-2xl border border-border-soft bg-card px-3.5 py-3">
      <dt className="mt-0.5 text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="font-display text-[22px] font-extrabold tracking-[-0.02em]">
        {value.toLocaleString('es-ES')}
      </dd>
    </div>
  )
}
