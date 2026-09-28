import { PageHeader } from '@/components/layout/PageHeader'
import { ItemWorkspace, useLingering } from '@/features/items'
import { formatHeaderDate } from '@/lib/date'
import { OFFLINE_MESSAGE } from '@/lib/errors'

import { useToday } from '../hooks/useToday'
import { DoneTodaySection } from './DoneTodaySection'
import { TodayEmpty } from './TodayEmpty'
import { TodaySection } from './TodaySection'

/** Lo que tarda una tarea recién completada en irse de su sección, como en el detalle de lista. */
const LINGER_MS = 400

interface TodayViewProps {
  /** El ítem abierto en el detalle (`?item=` de la ruta). */
  openItemId: string | undefined
  onOpenItem: (itemId: string | undefined) => void
}

/**
 * Hoy (02 §Hoy, pantalla 7): la fecha, y por listas lo que vence hoy o está atrasado. Se completa
 * aquí mismo; tocar una fila abre su detalle sin salir de Hoy (hoja en móvil, panel en
 * escritorio). Al final, plegado, lo hecho hoy. Los eventos con hora («Agenda») llegan en fase 2.
 */
export function TodayView({ openItemId, onOpenItem }: TodayViewProps) {
  const { lingering, hold } = useLingering(LINGER_MS)
  const { now, query, groups, listOf } = useToday({ lingering })

  return (
    <ItemWorkspace
      items={query.data}
      listOf={listOf}
      openItemId={openItemId}
      onOpenItem={onOpenItem}
      onFinish={hold}
    >
      <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-7.75rem)] flex-col gap-5 md:min-h-[calc(100dvh-4.5rem)] md:gap-[22px]">
        <PageHeader eyebrow={formatHeaderDate(now)} title="Hoy" />

        {query.isPending && query.fetchStatus === 'paused' && (
          <p className="px-1 py-6 text-center text-[15px] text-muted-foreground">
            {OFFLINE_MESSAGE}
          </p>
        )}
        {query.isError && (
          <p role="alert" className="px-1 text-[15px] text-muted-foreground">
            No hemos podido cargar Hoy. Prueba otra vez en un momento.
          </p>
        )}

        {groups &&
          (groups.sections.length === 0 ? (
            <TodayEmpty />
          ) : (
            <div className="flex flex-col gap-[22px]">
              {groups.sections.map((section) => (
                <TodaySection key={section.list.id} section={section} now={now} />
              ))}
            </div>
          ))}
        {groups && groups.done.length > 0 && <DoneTodaySection done={groups.done} />}
      </div>
    </ItemWorkspace>
  )
}
