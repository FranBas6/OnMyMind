import { addDays } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { useSidePanel } from '@/components/layout/sidePanel'
import { ItemWorkspace, ListScope, useLingering } from '@/features/items'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatHeaderDate } from '@/lib/date'
import { OFFLINE_MESSAGE } from '@/lib/errors'

import { useCurrentDay } from '../hooks/useCurrentDay'
import { useOtherDay, useToday } from '../hooks/useToday'
import {
  dayEyebrow,
  dayTense,
  dayTitle,
  emptyDay,
  pausedNote,
  type DayTense,
  type TodayEvent,
} from '../today'
import { AgendaRow } from './AgendaRow'
import { DayAside, DayStrip } from './DayCalendar'
import { DoneSection, NotedSection } from './DayLog'
import { TodayEmpty } from './TodayEmpty'
import { TodaySection } from './TodaySection'

/** Lo que tarda una tarea recién completada en irse de su sección, como en el detalle de lista. */
const LINGER_MS = 400

interface TodayViewProps {
  /** El día que se ve (`?day=` de la ruta); sin él, hoy. */
  day: Date | undefined
  /** Ir a otro día: la ruta lo refleja en `?day=`, y «atrás» vuelve al de antes. */
  onSelectDay: (day: Date) => void
  /** El ítem abierto en el detalle (`?item=` de la ruta). */
  openItemId: string | undefined
  onOpenItem: (itemId: string | undefined) => void
}

/**
 * Hoy (02 §Hoy, pantalla 7): la fecha, y por listas lo que vence hoy o está atrasado. Se completa
 * aquí mismo; tocar una fila abre su detalle sin salir de Hoy (hoja en móvil, panel en
 * escritorio). Arriba, la «Agenda» con los eventos de hoy de cualquier lista, por hora (diseño
 * 17, H1; solo si hay alguno). Al final, plegado, lo hecho y lo apuntado hoy.
 *
 * Desde la 2.5 (diseño 17, C1–C7 y D4–D8) deja ver cualquier día: en el móvil, con la tira de la
 * semana y el mes bajo el título; en escritorio, con ‹ › junto al título, el mes a la derecha y
 * las teclas ← → y T. Un día que viene enseña sus eventos y lo que vence; uno pasado, sus eventos
 * atenuados, «Hecho ese día» y «Apuntado ese día».
 */
export function TodayView({ day, onSelectDay, openItemId, onOpenItem }: TodayViewProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const panel = useSidePanel()
  const { lingering, hold } = useLingering(LINGER_MS)
  const today = useCurrentDay()
  const selected = day ?? today
  const tense = dayTense(selected, today)
  const todayData = useToday({ lingering })
  const other = useOtherDay(selected, { enabled: tense !== 'today', lingering })
  const query = tense === 'today' ? todayData.query : other.query

  useDayKeys({ enabled: isDesktop && openItemId === undefined, selected, today, onSelectDay })

  const calendar = { selected, today, onSelect: onSelectDay }
  const eyebrow = dayEyebrow(selected, today) ?? formatHeaderDate(today)

  return (
    <ItemWorkspace
      items={query.data}
      listOf={todayData.listOf}
      openItemId={openItemId}
      onOpenItem={onOpenItem}
      onFinish={hold}
    >
      <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-7.75rem)] flex-col gap-4 md:min-h-[calc(100dvh-4.5rem)] md:gap-[22px]">
        <div className="flex flex-col gap-3.5">
          <PageHeader
            eyebrow={eyebrow}
            title={dayTitle(selected, today)}
            trailing={isDesktop && <DayArrows selected={selected} onSelectDay={onSelectDay} />}
          />
          {!isDesktop && <DayStrip {...calendar} />}
        </div>

        {query.isPending && query.fetchStatus === 'paused' && (
          <p className="px-1 py-6 text-center text-[15px] text-muted-foreground">
            {OFFLINE_MESSAGE}
          </p>
        )}
        {query.isError && (
          <p role="alert" className="px-1 text-[15px] text-muted-foreground">
            No hemos podido cargar {tense === 'today' ? 'Hoy' : 'este día'}. Prueba otra vez en un
            momento.
          </p>
        )}

        {tense === 'today' ? (
          <TodayContent groups={todayData.groups} now={today} />
        ) : (
          other.groups &&
          (other.groups.agenda.length === 0 &&
          other.groups.sections.length === 0 &&
          other.groups.done.length === 0 &&
          other.groups.noted.length === 0 ? (
            <TodayEmpty {...emptyDay(selected, today)} />
          ) : (
            <div className="flex flex-col gap-[22px]">
              {other.groups.agenda.length > 0 && (
                <Agenda events={other.groups.agenda} tense={tense} />
              )}
              {other.groups.sections.map((section) => (
                <TodaySection key={section.list.id} section={section} now={today} otherDay />
              ))}
              {other.groups.done.length > 0 && (
                <DoneSection done={other.groups.done} tense="past" />
              )}
              {other.groups.noted.length > 0 && (
                <NotedSection notes={other.groups.noted} tense="past" />
              )}
            </div>
          ))
        )}
      </div>
      {isDesktop &&
        panel &&
        openItemId === undefined &&
        createPortal(<DayAside {...calendar} />, panel)}
    </ItemWorkspace>
  )
}

/** Hoy de siempre: la «Agenda», las tareas por lista, lo pausado, «Hecho hoy» y «Apuntado hoy». */
function TodayContent({
  groups,
  now,
}: {
  groups: ReturnType<typeof useToday>['groups']
  now: Date
}) {
  if (!groups) return null
  const nothingPending = groups.sections.length === 0 && groups.agenda.length === 0
  const logged = groups.done.length > 0 || groups.noted.length > 0
  return (
    <>
      {nothingPending ? (
        <TodayEmpty compact={logged} />
      ) : (
        <div className="flex flex-col gap-[22px]">
          {groups.agenda.length > 0 && <Agenda events={groups.agenda} tense="today" />}
          {groups.sections.map((section) => (
            <TodaySection key={section.list.id} section={section} now={now} />
          ))}
        </div>
      )}
      {pausedNote(groups.paused) && (
        <p className="-mt-2 px-1 text-[13px] text-subtle-foreground">{pausedNote(groups.paused)}</p>
      )}
      {(groups.done.length > 0 || groups.noted.length > 0) && (
        <div className="flex flex-col">
          {groups.done.length > 0 && (
            <DoneSection done={groups.done} tense="today" defaultOpen={nothingPending} />
          )}
          {groups.noted.length > 0 && <NotedSection notes={groups.noted} tense="today" />}
        </div>
      )}
    </>
  )
}

/** ‹ › junto al título en escritorio (diseño 17, D4): el día anterior y el siguiente. */
function DayArrows({
  selected,
  onSelectDay,
}: {
  selected: Date
  onSelectDay: (day: Date) => void
}) {
  const button =
    'grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50'
  return (
    <div className="flex shrink-0 gap-1">
      <button
        type="button"
        aria-label="Día anterior"
        onClick={() => {
          onSelectDay(addDays(selected, -1))
        }}
        className={button}
      >
        <ChevronLeft aria-hidden className="size-[18px]" strokeWidth={2.2} />
      </button>
      <button
        type="button"
        aria-label="Día siguiente"
        onClick={() => {
          onSelectDay(addDays(selected, 1))
        }}
        className={button}
      >
        <ChevronRight aria-hidden className="size-[18px]" strokeWidth={2.2} />
      </button>
    </div>
  )
}

/**
 * Las teclas de escritorio (diseño 17, D4): ← y → cambian de día, T vuelve a hoy. No cuando se
 * escribe, ni con un menú, un diálogo o la ficha de un ítem abiertos, ni con modificadores (⌘K,
 * ⌘⇧Espacio).
 */
function useDayKeys({
  enabled,
  selected,
  today,
  onSelectDay,
}: {
  enabled: boolean
  selected: Date
  today: Date
  onSelectDay: (day: Date) => void
}) {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target instanceof Element ? event.target : null
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]',
        )
      ) {
        return
      }
      if (event.key === 'ArrowLeft') onSelectDay(addDays(selected, -1))
      else if (event.key === 'ArrowRight') onSelectDay(addDays(selected, 1))
      else if (event.key === 't' || event.key === 'T') onSelectDay(today)
      else return
      event.preventDefault()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [enabled, selected, today, onSelectDay])
}

/**
 * «Agenda» (diseño 17, H1): la etiqueta sin cuadrado de color, porque mezcla listas; cada fila lleva
 * el color de la suya en su barra.
 */
function Agenda({ events, tense }: { events: TodayEvent[]; tense: DayTense }) {
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
            <AgendaRow item={item} tense={tense} />
          </ListScope>
        ))}
      </ul>
    </section>
  )
}
