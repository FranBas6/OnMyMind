import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownUp } from 'lucide-react'
import { useRef, useState } from 'react'

import { InboxHeader, ListDetailHeader, type List } from '@/features/lists'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useOnline } from '@/hooks/useOnline'
import { cn } from '@/lib/utils'

import { addPlaceholder } from '../copy'
import {
  AGE_FILTER_OPTIONS,
  detailSummary,
  listSummary,
  matchesAge,
  SORT_LABELS,
  splitItems,
  statusFilterOptions,
  type AgeFilter,
  type SortOrder,
  type StatusFilter,
} from '../filters'
import { useItems } from '../hooks/useItems'
import { nextItemPosition, useCreateItem, useUpdateItem } from '../hooks/useItemMutations'
import { useLingering } from '../hooks/useLingering'
import { itemsQueryOptions, movedFromInboxQueryOptions } from '../queries'
import { isChoosableKind, type AddableKind } from '../kind'
import { defaultItemKind, initialStatus } from '../status'
import { hasPrices, pendingTotals } from '../prices'
import { childrenOf, sublistSummary, topLevel } from '../sublists'
import type { Item, MovedItem } from '../types'
import { AddItemBar, type AddItemBarHandle } from './AddItemBar'
import { FilterChips } from './FilterChips'
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
}: ListDetailProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const items = useItems(list.id)
  const movedQuery = useQuery({
    ...movedFromInboxQueryOptions(list.id),
    enabled: list.kind === 'inbox',
  })
  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const addBarRef = useRef<AddItemBarHandle>(null)
  const queryClient = useQueryClient()
  const online = useOnline()
  const { lingering, hold } = useLingering(LINGER_MS)
  const listOf = () => list
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all')
  const [sort, setSort] = useState<SortOrder>('newest')
  const inbox = list.kind === 'inbox'

  const all = items.data
  // Lo de dentro de una sublista sale en su pantalla, no suelto en la lista (ADR-010).
  const shown = all && (sublist ? childrenOf(all, sublist.id) : topLevel(all))
  const { active, outOfMind } = splitItems(shown ?? [], list.kind, { lingering, sort })
  // El resumen no espera a la animación: cuenta lo que ya está hecho aunque aún se vea arriba.
  const summary = !all
    ? detailSummary(list.kind, list.counters.pending, list.counters.done)
    : sublist
      ? sublistSummary(sublist, shown ?? [], list.name)
      : listSummary(list.kind, all)
  const empty = shown?.length === 0
  // Con los ítems ya cargados, el total sigue a lo optimista; mientras, el de la vista.
  const total = !inbox && (
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

  const defaultKind = defaultItemKind(list.kind)
  const add = (title: string, chosen: AddableKind | undefined) => {
    const kind = chosen ?? defaultKind
    // Una lista aún sin descargar empieza vacía en caché, para que lo añadido se vea; al volver
    // la red se descarga entera. La posición la pone el servidor (no sabemos cuál es la última).
    if (!all) queryClient.setQueryData(itemsQueryOptions(list.id).queryKey, [])
    const id = crypto.randomUUID()
    createItem.mutate({
      id,
      listId: list.id,
      parentId: sublist?.id ?? null,
      title,
      kind,
      status: initialStatus(kind),
      position: all ? nextItemPosition(all) : undefined,
    })
    // Una sublista se crea para meterle cosas: se entra en ella (decisión de Fran; diseño 12, S3).
    if (kind === 'sublist') onOpenSublist(id)
  }

  const showFilters = all !== undefined && (inbox ? active.length > 0 : !empty)
  const addBar = (all ?? notDownloaded) && (
    <AddItemBar
      key={sublist?.id ?? list.id}
      handle={addBarRef}
      variant={isDesktop ? 'inline' : 'docked'}
      placeholder={sublist ? `Añadir a ${sublist.title}…` : addPlaceholder(list, empty)}
      autoFocus={empty && renameKey === undefined}
      onAdd={add}
      kinds={
        isChoosableKind(defaultKind)
          ? { defaultKind, listName: sublist?.title ?? list.name, sublists: !sublist }
          : undefined
      }
    />
  )

  return (
    <ItemWorkspace
      items={all}
      listOf={listOf}
      openItemId={openItemId}
      onOpenItem={onOpenItem}
      onFinish={hold}
      onOpenSublist={(item, options) => {
        onOpenSublist(item.id, options)
      }}
    >
      <ListScope list={list} prices={hasPrices(shown ?? [])}>
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
              ) : (
                <FilterChips
                  label="Filtrar por estado"
                  options={statusFilterOptions(list.kind)}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              )}
              {inbox && (
                <button
                  type="button"
                  onClick={() => {
                    setSort((current) => (current === 'newest' ? 'oldest' : 'newest'))
                  }}
                  aria-label={`Ordenar: ${SORT_LABELS[sort]}. Cambiar a ${SORT_LABELS[sort === 'newest' ? 'oldest' : 'newest']}`}
                  // Como el botón secundario de Inicio («+ Nueva lista»), a la altura de los filtros. En
                  // móvil no cabe el texto junto a las tres píldoras: solo el icono, de 36 px.
                  className="inline-flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[13px] font-semibold whitespace-nowrap outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50 md:w-auto md:px-3"
                >
                  <ArrowDownUp
                    aria-hidden
                    className="size-4 text-muted-foreground md:size-3.5"
                    strokeWidth={2.2}
                  />
                  <span aria-hidden className="hidden md:inline">
                    <span className="font-normal text-muted-foreground">Ordenar: </span>
                    {SORT_LABELS[sort]}
                  </span>
                </button>
              )}
            </div>
          )}

          {isDesktop && addBar}

          {notDownloaded && <NotDownloadedEmpty />}
          {items.isError && (
            <p role="alert" className="px-1 text-[15px] text-muted-foreground">
              No hemos podido cargar esta lista. Prueba otra vez en un momento.
            </p>
          )}

          {all &&
            (inbox ? (
              <InboxContent
                active={active.filter((item) => matchesAge(item, ageFilter))}
                hasPending={active.length > 0}
                ageFilter={ageFilter}
                outOfMind={outOfMind}
                moved={movedQuery.data ?? []}
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
              />
            ))}

          {!isDesktop && addBar}
        </div>
      </ListScope>
    </ItemWorkspace>
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
}: ContentProps & { list: List; sublist: Item | undefined; filter: StatusFilter }) {
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

function Rows({ items }: { items: Item[] }) {
  return (
    <ul aria-label="Ítems" className="flex flex-col gap-2">
      {items.map((item) => (
        <ItemRow key={item.id} item={item} />
      ))}
    </ul>
  )
}
