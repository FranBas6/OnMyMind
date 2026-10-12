import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useRef, useState } from 'react'

import {
  InboxHeader,
  ListDetailHeader,
  useUpdateListView,
  type List,
  type ListStyle,
  type ListView,
} from '@/features/lists'
import { useProfile } from '@/features/profile/hooks/useProfile'
import { useWithCompletedLive } from '@/features/sharing/liveRows'
import { useUpdateSettings } from '@/features/profile/hooks/useProfileMutations'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useOnline } from '@/hooks/useOnline'
import { dropNeighbors, reorder, stepNeighbors, type Neighbors } from '@/lib/reorder'
import { formatCents } from '@/lib/money'
import { showUndoToast } from '@/lib/undoToast'
import { cn } from '@/lib/utils'

import { choicePrice, isChoosing, openOptions, optionMarks, optionsMeta } from '../chooseOne'
import { compareOptions, leadingOption } from '../compare'
import { addPlaceholder } from '../copy'
import {
  AGE_FILTER_OPTIONS,
  byPosition,
  EVENT_FILTER_OPTIONS,
  agendaSummary,
  detailSummary,
  listSummary,
  matchesAge,
  splitItems,
  statusFilterOptions,
  type AgeFilter,
  type EventFilter,
  type StatusFilter,
} from '../filters'
import { useItems } from '../hooks/useItems'
import { useCreateWithDate } from '../hooks/useCreateWithDate'
import {
  nextItemPosition,
  useDeleteItem,
  useReorderItems,
  useUpdateItem,
} from '../hooks/useItemMutations'
import { useLingering } from '../hooks/useLingering'
import { itemsQueryOptions, movedFromInboxQueryOptions } from '../queries'
import { kindProposal, type AddableKind } from '../kind'
import type { WrittenDate } from '../writtenDate'
import { pastedLinesSaved, type LineToSave } from '../pastedLines'
import { firstFinalStatus, initialStatus } from '../status'
import { hasPrices, pendingTotals } from '../prices'
import { childrenOf, sublistSummary, topLevel } from '../sublists'
import type { Item, MovedItem } from '../types'
import { AddItemBar, type AddItemBarHandle } from './AddItemBar'
import { ChoiceContext, type Choice } from './choiceContext'
import { CompareColumns, CompareSheet } from './CompareView'
import { EventsList } from './EventsList'
import { FilterChips } from './FilterChips'
import { InboxSortMenu } from './InboxSortMenu'
import { useItemActions, type RowOrder } from './itemActionsContext'
import { ItemRow } from './ItemRow'
import {
  AllDoneNote,
  FilterEmpty,
  InboxEmpty,
  NewListEmpty,
  NotDownloadedEmpty,
  SublistEmpty,
} from './ItemsEmptyState'
import { ItemWorkspace, ListScope } from './ItemWorkspace'
import { OutOfMindSection } from './OutOfMindSection'
import { PriceTotal } from './PriceTotal'
import { SortableRows } from './SortableRows'
import { SublistHeader } from './SublistHeader'

/** Lo que tarda un ítem recién completado en bajar a «Fuera de la cabeza» (06 §Interacción). */
const LINGER_MS = 400

interface ListDetailProps {
  list: List
  /**
   * La pantalla de una sublista de esta lista (diseño 12, S2): la misma pantalla con lo de dentro,
   * su cabecera con «‹ Viajes» y su campo de añadir, que mete lo nuevo dentro. Quien la monta
   * comprueba que existe (si no, vuelve a la lista).
   */
  sublist?: Item
  /** El ítem abierto en el detalle (`?item=` de la ruta). */
  openItemId: string | undefined
  /** Abre (con id) o cierra (sin él) el detalle: la ruta lo refleja en `?item=`. */
  onOpenItem: (itemId: string | undefined) => void
  /** Entra en una sublista; con `rename`, con el nombre listo para editar. */
  onOpenSublist: (sublistId: string, options?: { rename?: boolean }) => void
  /**
   * Se entró con «Renombrar» (`?rename=` de la ruta, un número distinto cada vez): el nombre de la
   * sublista aparece enfocado y seleccionado.
   */
  renameKey?: number
  /** Comparar las opciones de una sublista «para elegir una» (`?comparar` de la ruta, 5.2). */
  comparing?: boolean
  /** Abre o cierra Comparar: la ruta lo refleja, y Atrás la cierra. */
  onCompare?: (open: boolean) => void
}

/**
 * Detalle de una lista (pantalla 4, D1 y diseños 05 y 06): cabecera, filtros, ítems, «Fuera de la
 * cabeza» y el campo de añadir, abajo en móvil y arriba en escritorio; y encima, el detalle de un
 * ítem, «Mover a…» y el menú de fila. «En mente» tiene su propia cabecera y filtra por antigüedad
 * en vez de por estado. Montarlo con `key={list.id}` reinicia filtros y orden al cambiar de lista.
 */
export function ListDetail({
  list,
  sublist,
  openItemId,
  onOpenItem,
  onOpenSublist,
  renameKey,
  comparing: comparingRequested = false,
  onCompare,
}: ListDetailProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const items = useItems(list.id)
  const movedQuery = useQuery({
    ...movedFromInboxQueryOptions(list.id),
    enabled: list.kind === 'inbox',
  })
  const createItem = useCreateWithDate()
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()
  const addBarRef = useRef<AddItemBarHandle>(null)
  const queryClient = useQueryClient()
  const online = useOnline()
  const { lingering, hold } = useLingering(LINGER_MS)
  const listOf = () => list
  const [pickedFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [eventFilter, setEventFilter] = useState<EventFilter>('all')
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all')
  const profile = useProfile()
  const updateSettings = useUpdateSettings()
  const reorderItems = useReorderItems()
  // El orden de «En mente» se recuerda en la cuenta (diseño 14, E2).
  const sort = profile.data?.settings.inboxSort ?? 'newest'
  const inbox = list.kind === 'inbox'
  // «Lista · Agenda» (5.5, diseño 25, B10 y D5): la lista recuerda cómo se ve. En una compartida
  // contigo no se guarda (la lista es de quien la creó): vale mientras estás en ella.
  const updateView = useUpdateListView()
  const [pickedView, setPickedView] = useState<{ listId: string; view: ListView } | null>(null)
  const view = pickedView?.listId === list.id ? pickedView.view : list.view
  const changeView = (next: ListView) => {
    setPickedView({ listId: list.id, view: next })
    if (list.isOwner) updateView.mutate({ listId: list.id, view: next })
  }
  // Una lista que se ve como agenda se agrupa por días y tiene sus filtros (diseño 17); también
  // sus sublistas. Desde la 5.3 lo dice su vista, no su tipo.
  const events = !inbox && view === 'agenda'
  const style: ListStyle = inbox ? 'inbox' : view

  const all = items.data
  // Con eventos, el cambio de vista y los contadores de la agenda (diseño 25, B10).
  const hasEvents = all ? all.some((item) => item.kind === 'event') : list.counters.kinds.event > 0
  const viewSwitch =
    !inbox && !sublist && (hasEvents || list.view === 'agenda')
      ? { value: view, onChange: changeView }
      : undefined
  // Lo de dentro de una sublista sale en su pantalla, no suelto en la lista (ADR-010).
  const shown = all && (sublist ? childrenOf(all, sublist.id) : topLevel(all))
  // Una sublista «para elegir una» (5.1, diseño 24): sus opciones dicen cuál es la elegida y cuál la
  // más barata. Sin filtros: se ve todo lo que se compara (A2).
  const chooseOne = sublist?.chooseOne ?? false
  const choice: Choice | null =
    sublist && chooseOne ? { sublist, marks: optionMarks(sublist, shown ?? []) } : null
  const statusFilter = chooseOne ? 'all' : pickedFilter
  // Lo que termina otra persona en directo se queda un momento, como lo tuyo (diseño 20, M8).
  const staying = useWithCompletedLive(lingering)
  const { active, outOfMind } = splitItems(shown ?? [], list.kind, { lingering: staying, sort })
  // El resumen no espera a la animación: cuenta lo que ya está hecho aunque aún se vea arriba.
  const summary = !all
    ? detailSummary(style, list.counters)
    : sublist
      ? sublistSummary(sublist, shown ?? [], list.name)
      : !inbox && hasEvents
        ? agendaSummary(all)
        : listSummary(style, all)
  const empty = shown?.length === 0

  // Ordenar a mano (2.9, diseño 14): lo que se ve de lo pendiente, salvo en las listas de eventos,
  // que van por día y hora (decisión de Fran, 2026-10-06). Con un filtro, se ordena entre lo que
  // se ve (R9); lo escondido conserva su sitio.
  const visible = inbox ? active.filter((item) => matchesAge(item, ageFilter)) : active
  const sortableIds = statusFilter === 'closed' && !inbox ? [] : visible.map((item) => item.id)
  const place = (movedId: string, neighbors: Neighbors) => {
    // Arrastrar en «En mente» con otro orden puesto pasa a «A mi manera» con el orden que se veía
    // (E3, E4): se fija entero y se avisa, porque cambia algo que no se tocó directamente.
    if (inbox && sort !== 'manual') {
      const changes = reorder(active, movedId, neighbors, { renumber: true })
      reorderItems.mutate({ listId: list.id, changes })
      const previous = sort
      updateSettings.mutate({ inboxSort: 'manual' })
      showUndoToast({
        message: 'Orden: a mi manera',
        onUndo: () => {
          updateSettings.mutate({ inboxSort: previous })
        },
      })
      return
    }
    const siblings = [...(shown ?? [])].sort(byPosition)
    const changes = reorder(siblings, movedId, neighbors)
    if (changes.length > 0) reorderItems.mutate({ listId: list.id, changes })
  }
  const order: RowOrder | undefined =
    events || !all
      ? undefined
      : {
          ids: sortableIds,
          drop: (movedId, overId) => {
            const neighbors = dropNeighbors(sortableIds, movedId, overId)
            if (neighbors) place(movedId, neighbors)
          },
          step: (item, direction) => {
            const neighbors = stepNeighbors(sortableIds, item.id, direction)
            if (neighbors) place(item.id, neighbors)
          },
        }
  // Con los ítems ya cargados, el total sigue a lo optimista; mientras, el de la vista. Una sublista
  // «para elegir una» lo dice en una línea bajo su cabecera (A2, A4b).
  // Comparar (5.2, diseño 24): con dos opciones en juego o más. En el móvil, una hoja a pantalla
  // completa; en escritorio, columnas en vez de las filas, sin la línea de lo que cuenta ni el campo.
  const choosing = sublist !== undefined && isChoosing(sublist)
  const compared = choosing && shown ? compareOptions(shown) : []
  const comparing = comparingRequested && compared.length >= 2
  const comparingHere = comparing && isDesktop
  const compareProps = sublist &&
    choice && {
      sublist,
      options: compared,
      marks: choice.marks,
      leadingId: leadingOption(sublist, shown ?? []),
      summary: optionsMeta(sublist, shown ?? []) ?? sublist.title,
    }
  const price = sublist && chooseOne && shown ? choicePrice(sublist, shown) : null
  const counts = price && {
    label: price.paid ? 'Pagaste' : `Cuenta en ${list.name}`,
    amount: formatCents(price.cents, price.currency),
  }
  const total = !inbox && !chooseOne && (
    <PriceTotal
      totals={
        all && shown
          ? pendingTotals(sublist ? shown : all)
          : { euros: list.counters.pendingPriceCents, others: [] }
      }
    />
  )

  // Sin red y sin nada de esta lista en caché (nunca se abrió aquí): se puede añadir igual.
  // (Sin esperar a que la consulta quede en pausa, que tarda lo que su primer intento.)
  const notDownloaded = items.isPending && (items.fetchStatus === 'paused' || !online)

  // El tipo que más hay (ADR-012): en una sublista, el de lo de dentro; vacía, el de su lista.
  const proposal = kindProposal(list, sublist && shown && shown.length > 0 ? shown : all)
  const defaultKind = proposal.kind
  const add = (
    title: string,
    chosen: AddableKind | undefined,
    written: WrittenDate | null,
    notes?: string | null,
  ) => {
    const kind = chosen ?? defaultKind
    // Una lista aún sin descargar empieza vacía en caché, para que lo añadido se vea; al volver
    // la red se descarga entera. La posición la pone el servidor (no sabemos cuál es la última).
    if (!all) queryClient.setQueryData(itemsQueryOptions(list.id).queryKey, [])
    const id = crypto.randomUUID()
    createItem(
      {
        id,
        listId: list.id,
        parentId: sublist?.id ?? null,
        title,
        ...(notes && { notes }),
        kind,
        status: initialStatus(kind),
        position: all ? nextItemPosition(all) : undefined,
      },
      written,
    )
    // Una sublista se crea para meterle cosas: se entra en ella (decisión de Fran; diseño 12, S3).
    if (kind === 'sublist') onOpenSublist(id)
  }

  // Pegar varias líneas (4.3, diseño 23, B6): una cosa por línea, en orden y al final de la lista,
  // y un solo aviso («3 cosas en Casa») cuyo «Deshacer» las borra todas. Una sublista pegada no se
  // abre: son varias.
  const addMany = (lines: LineToSave[], chosen: AddableKind | undefined) => {
    const kind = chosen ?? defaultKind
    if (!all) queryClient.setQueryData(itemsQueryOptions(list.id).queryKey, [])
    const first = all ? nextItemPosition(all) : undefined
    const items = lines.map((line, index) =>
      createItem(
        {
          id: crypto.randomUUID(),
          listId: list.id,
          parentId: sublist?.id ?? null,
          title: line.title,
          kind,
          status: line.done ? firstFinalStatus(kind) : initialStatus(kind),
          position: first === undefined ? undefined : first + index * 1000,
        },
        line.written,
      ),
    )
    showUndoToast({
      icon: Check,
      message: pastedLinesSaved(items.length, sublist?.title ?? list.name),
      onUndo: () => {
        for (const item of items) deleteItem.mutate(item)
      },
    })
  }

  const showFilters = all !== undefined && !chooseOne && (inbox ? active.length > 0 : !empty)
  const addBar = (all ?? notDownloaded) && (
    <AddItemBar
      key={sublist?.id ?? list.id}
      handle={addBarRef}
      variant={isDesktop ? 'inline' : 'docked'}
      placeholder={
        sublist
          ? isChoosing(sublist)
            ? `Añadir una opción a ${sublist.title}…`
            : `Añadir a ${sublist.title}…`
          : addPlaceholder(list)
      }
      autoFocus={empty && renameKey === undefined}
      onAdd={add}
      onAddMany={addMany}
      kinds={{ proposal, listName: sublist?.title ?? list.name, sublists: !sublist && !inbox }}
    />
  )

  return (
    <ChoiceContext value={choice}>
      <ItemWorkspace
        items={all}
        listOf={listOf}
        openItemId={openItemId}
        onOpenItem={onOpenItem}
        onFinish={hold}
        onOpenSublist={(item, options) => {
          onOpenSublist(item.id, options)
        }}
        order={order}
      >
        <ListScope list={list} prices={hasPrices(shown ?? []) || (choice?.marks.size ?? 0) > 0}>
          <div
            className={cn(
              'flex flex-1 flex-col md:min-h-[calc(100dvh-4.5rem)] md:gap-[22px]',
              inbox ? 'gap-2' : 'gap-4',
            )}
          >
            {inbox ? (
              <InboxHeader inbox={list} summary={summary} />
            ) : sublist ? (
              <SublistHeader
                sublist={sublist}
                list={list}
                summary={summary}
                total={total}
                counts={comparingHere ? null : counts}
                compare={
                  choosing
                    ? {
                        active: comparingHere,
                        disabled: compared.length < 2,
                        onToggle: () => onCompare?.(!comparing),
                      }
                    : undefined
                }
                renameKey={renameKey}
                onRename={(title) => {
                  updateItem.mutate({ item: sublist, patch: { title } })
                }}
              />
            ) : (
              <ListDetailHeader
                list={list}
                summary={summary}
                total={total}
                view={viewSwitch}
                onNewSublist={() => {
                  // Después de que el menú se cierre y devuelva el foco a su botón.
                  window.setTimeout(() => {
                    addBarRef.current?.startWith('sublist')
                  }, 350)
                }}
              />
            )}

            {showFilters && (
              <div className="flex items-center justify-between gap-3">
                {inbox ? (
                  <FilterChips
                    label="Filtrar por antigüedad"
                    options={AGE_FILTER_OPTIONS}
                    value={ageFilter}
                    onChange={setAgeFilter}
                  />
                ) : events ? (
                  <FilterChips
                    label="Filtrar eventos"
                    options={EVENT_FILTER_OPTIONS}
                    value={eventFilter}
                    onChange={setEventFilter}
                  />
                ) : (
                  <FilterChips
                    label="Filtrar por estado"
                    options={statusFilterOptions(style)}
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />
                )}
                {inbox && (
                  <InboxSortMenu
                    value={sort}
                    onChange={(next) => {
                      updateSettings.mutate({ inboxSort: next })
                    }}
                  />
                )}
              </div>
            )}

            {isDesktop && !comparingHere && addBar}

            {notDownloaded && <NotDownloadedEmpty />}
            {items.isError && (
              <p role="alert" className="px-1 text-[15px] text-muted-foreground">
                No hemos podido cargar esta lista. Prueba otra vez en un momento.
              </p>
            )}

            {all &&
              (comparingHere && compareProps ? (
                <CompareColumns {...compareProps} />
              ) : inbox ? (
                <InboxContent
                  active={active.filter((item) => matchesAge(item, ageFilter))}
                  hasPending={active.length > 0}
                  ageFilter={ageFilter}
                  outOfMind={outOfMind}
                  moved={movedQuery.data ?? []}
                  empty={empty}
                  isDesktop={isDesktop}
                />
              ) : events && !(sublist && empty) ? (
                <EventsList
                  active={active}
                  outOfMind={outOfMind}
                  all={shown ?? []}
                  filter={eventFilter}
                  empty={empty}
                  isDesktop={isDesktop}
                />
              ) : (
                <ListContent
                  list={list}
                  sublist={sublist}
                  active={active}
                  outOfMind={outOfMind}
                  filter={statusFilter}
                  empty={empty}
                  isDesktop={isDesktop}
                  hint={
                    sublist && isChoosing(sublist) && openOptions(shown ?? []).length === 1
                      ? 'Añade otra opción para comparar.'
                      : undefined
                  }
                />
              ))}

            {!isDesktop && addBar}
            {!isDesktop && compareProps && compared.length >= 2 && (
              <CompareSheet
                {...compareProps}
                open={comparing}
                onOpenChange={(open) => {
                  if (!open) onCompare?.(false)
                }}
              />
            )}
          </div>
        </ListScope>
      </ItemWorkspace>
    </ChoiceContext>
  )
}

interface ContentProps {
  active: Item[]
  outOfMind: Item[]
  empty: boolean
  isDesktop: boolean
}

/** Listas normales: los ítems, y «Fuera de la cabeza» salvo con el filtro «Pendientes». */
function ListContent({
  list,
  active,
  outOfMind,
  filter,
  empty,
  isDesktop,
  sublist,
  hint,
}: ContentProps & {
  list: List
  sublist: Item | undefined
  filter: StatusFilter
  /** Una línea bajo las filas («Añade otra opción para comparar.», diseño 24, A8b). */
  hint?: string | undefined
}) {
  if (empty && sublist) return <SublistEmpty sublist={sublist} list={list} />
  if (empty) return <NewListEmpty list={list} isDesktop={isDesktop} />

  if (filter === 'closed') {
    return outOfMind.length > 0 ? (
      <OutOfMindSection items={outOfMind} defaultOpen collapsible={false} />
    ) : (
      <FilterEmpty>Aún no hay nada fuera de la cabeza.</FilterEmpty>
    )
  }

  return (
    <>
      {active.length > 0 ? <Rows items={active} /> : <AllDoneNote withHint={filter === 'all'} />}
      {hint && <p className="px-1 text-[15px] text-muted-foreground">{hint}</p>}
      {filter === 'all' && outOfMind.length > 0 && (
        <OutOfMindSection items={outOfMind} defaultOpen />
      )}
    </>
  )
}

/**
 * «En mente»: sus capturas por antigüedad. Sin nada pendiente, «Nada en mente.» y lo hecho y lo
 * movido plegados al fondo (E3); los filtros solo afectan a lo pendiente.
 */
function InboxContent({
  active,
  hasPending,
  ageFilter,
  outOfMind,
  moved,
  empty,
  isDesktop,
}: ContentProps & { hasPending: boolean; ageFilter: AgeFilter; moved: MovedItem[] }) {
  const section = (outOfMind.length > 0 || moved.length > 0) && (
    <OutOfMindSection items={outOfMind} moved={moved} defaultOpen={hasPending} />
  )

  if (empty || !hasPending) {
    return (
      <>
        <InboxEmpty isDesktop={isDesktop} />
        {section}
      </>
    )
  }

  return (
    <>
      {active.length > 0 ? (
        <Rows items={active} />
      ) : (
        <FilterEmpty>
          {ageFilter === 'week'
            ? 'Nada capturado en los últimos siete días.'
            : 'Nada lleva más de una semana esperando.'}
        </FilterEmpty>
      )}
      {section}
    </>
  )
}

/** Las filas: donde se ordena a mano (2.9), con el arrastre; si no, tal cual. */
function Rows({ items }: { items: Item[] }) {
  const { order } = useItemActions()
  if (order) return <SortableRows items={items} order={order} />
  return (
    <ul aria-label="Ítems" className="flex flex-col gap-2">
      {items.map((item) => (
        <ItemRow key={item.id} item={item} />
      ))}
    </ul>
  )
}
