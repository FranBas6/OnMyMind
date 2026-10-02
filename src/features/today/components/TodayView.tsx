import { PageHeader } from '@/components/layout/PageHeader'
import { ItemWorkspace, ListScope, useLingering } from '@/features/items'
import { formatHeaderDate } from '@/lib/date'
import { OFFLINE_MESSAGE } from '@/lib/errors'

import { useToday } from '../hooks/useToday'
import { pausedNote, type TodayEvent } from '../today'
import { AgendaRow } from './AgendaRow'
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
 * escritorio). Arriba, la «Agenda» con los eventos de hoy de cualquier lista, por hora (diseño
 * 17, H1; solo si hay alguno). Al final, plegado, lo hecho hoy.
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
          (groups.sections.length === 0 && groups.agenda.length === 0 ? (
            <TodayEmpty />
          ) : (
            <div className="flex flex-col gap-[22px]">
              {groups.agenda.length > 0 && <Agenda events={groups.agenda} />}
              {groups.sections.map((section) => (
                <TodaySection key={section.list.id} section={section} now={now} />
              ))}
            </div>
          ))}
        {groups && pausedNote(groups.paused) && (
          <p className="-mt-2 px-1 text-[13px] text-subtle-foreground">
            {pausedNote(groups.paused)}
          </p>
        )}
        {groups && groups.done.length > 0 && <DoneTodaySection done={groups.done} />}
      </div>
    </ItemWorkspace>
  )
}

/**
 * «Agenda» (diseño 17, H1): la etiqueta sin cuadrado de color, porque mezcla listas; cada fila lleva
 * el color de la suya en su barra.
 */
function Agenda({ events }: { events: TodayEvent[] }) {
  return (
    <section aria-labelledby="hoy-agenda" className="flex flex-col gap-2.5">
      <h2
        id="hoy-agenda"
        className="px-1 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase"
      >
        Agenda
      </h2>
      <ul aria-label="Agenda" className="flex flex-col gap-2.5">
        {events.map(({ item, list }) => (
          <ListScope key={item.id} list={list}>
            <AgendaRow item={item} />
          </ListScope>
        ))}
      </ul>
    </section>
  )
}
