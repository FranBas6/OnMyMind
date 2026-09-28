import { useQuery } from '@tanstack/react-query'
import { ArrowDownUp, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { InboxHeader, ListDetailHeader, useListActions, type List } from '@/features/lists'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { OFFLINE_MESSAGE } from '@/lib/errors'
import { showUndoToast } from '@/lib/undoToast'
import { cn } from '@/lib/utils'

import { addPlaceholder } from '../copy'
import {
  AGE_FILTER_OPTIONS,
  detailSummary,
  matchesAge,
  SORT_LABELS,
  splitItems,
  statusFilterOptions,
  type AgeFilter,
  type SortOrder,
  type StatusFilter,
} from '../filters'
import { useItems } from '../hooks/useItems'
import {
  nextItemPosition,
  useCreateItem,
  useDeleteItem,
  useMoveItem,
  useRestoreItem,
  useSetItemStatus,
  useUpdateItem,
} from '../hooks/useItemMutations'
import { useLingering } from '../hooks/useLingering'
import { movedFromInboxQueryOptions } from '../queries'
import { initialStatus, isFinalStatus, isOutOfMind, nextStatusOnToggle } from '../status'
import type { Item, ItemStatus, MovedItem } from '../types'
import { AddItemBar } from './AddItemBar'
import { FilterChips } from './FilterChips'
import { ItemActionsContext, type ItemActions } from './itemActionsContext'
import { ItemRow } from './ItemRow'
import { ItemRowMenuSheet } from './ItemRowMenu'
import { ItemSheet } from './ItemSheet'
import { AllDoneNote, FilterEmpty, InboxEmpty, NewListEmpty } from './ItemsEmptyState'
import { MoveToList, type MoveTarget } from './MoveToList'
import { OutOfMindSection } from './OutOfMindSection'

/** Lo que tarda un ítem recién completado en bajar a «Fuera de la cabeza» (06 §Interacción). */
const LINGER_MS = 400

interface ListDetailProps {
  list: List
  /** El ítem abierto en el detalle (`?item=` de la ruta). */
  openItemId: string | undefined
  /** Abre (con id) o cierra (sin él) el detalle: la ruta lo refleja en `?item=`. */
  onOpenItem: (itemId: string | undefined) => void
}

/**
 * Detalle de una lista (pantalla 4, D1 y diseños 05 y 06): cabecera, filtros, ítems, «Fuera de la
 * cabeza» y el campo de añadir, abajo en móvil y arriba en escritorio; y encima, el detalle de un
 * ítem, «Mover a…» y el menú de fila. «En mente» tiene su propia cabecera y filtra por antigüedad
 * en vez de por estado. Montarlo con `key={list.id}` reinicia filtros y orden al cambiar de lista.
 */
export function ListDetail({ list, openItemId, onOpenItem }: ListDetailProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const items = useItems(list.id)
  const movedQuery = useQuery({
    ...movedFromInboxQueryOptions(list.id),
    enabled: list.kind === 'inbox',
  })
  const createItem = useCreateItem(list.id)
  const statusMutation = useSetItemStatus(list.id)
  const updateItem = useUpdateItem(list.id)
  const moveItem = useMoveItem()
  const deleteItem = useDeleteItem(list.id)
  const restoreItem = useRestoreItem(list.id)
  const { openCreate } = useListActions()
  const { lingering, hold } = useLingering(LINGER_MS)
  const [menuItemId, setMenuItemId] = useState<string | undefined>(undefined)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all')
  const [sort, setSort] = useState<SortOrder>('newest')
  const inbox = list.kind === 'inbox'

  const all = items.data
  const { active, outOfMind } = splitItems(all ?? [], list.kind, { lingering, sort })
  // El resumen no espera a la animación: cuenta lo que ya está hecho aunque aún se vea arriba.
  const pending = all ? all.filter((item) => !isOutOfMind(item, list.kind)).length : 0
  const summary = all
    ? detailSummary(list.kind, pending, all.length - pending)
    : detailSummary(list.kind, list.counters.pending, list.counters.done)
  const empty = all?.length === 0

  const openItem = all?.find((item) => item.id === openItemId)
  const menuItem = all?.find((item) => item.id === menuItemId)

  // `?item=` de algo que ya no está en esta lista (borrado, movido, un enlace viejo): se quita.
  const staleItemId = all !== undefined && openItemId !== undefined && !openItem
  useEffect(() => {
    if (staleItemId) onOpenItem(undefined)
  }, [staleItemId, onOpenItem])

  const setStatus = (item: Item, status: ItemStatus) => {
    // Lo que se termina se queda un instante en su sitio antes de bajar (06 §Interacción).
    if (isFinalStatus(status) && !isFinalStatus(item.status)) hold(item.id)
    statusMutation.mutate({ item, status })
  }

  const move = (item: Item, to: List) => {
    if (item.id === openItemId) onOpenItem(undefined)
    moveItem.mutate({ item, from: list, to })
  }

  const remove = (item: Item) => {
    if (item.id === openItemId) onOpenItem(undefined)
    deleteItem.mutate(item)
    showUndoToast({
      icon: Trash2,
      message: `«${item.title}» borrada`,
      onUndo: () => {
        restoreItem.mutate(item)
      },
    })
  }

  const actions: ItemActions = {
    list,
    isDesktop,
    selectedId: openItemId,
    menuItemId,
    openDetail: (item) => {
      onOpenItem(item.id)
    },
    toggle: (item) => {
      setStatus(item, nextStatusOnToggle(list.kind, item.status))
    },
    setStatus,
    openMenu: (item) => {
      setMenuItemId(item.id)
    },
    startMove: (item, anchor) => {
      // En móvil, «Mover a…» sale sobre la lista (diseño 06, T6): el detalle se cierra antes.
      if (!isDesktop && item.id === openItemId) onOpenItem(undefined)
      setMoveTarget({ item, anchor })
    },
    remove,
  }

  const add = (title: string) => {
    createItem.mutate({
      id: crypto.randomUUID(),
      listId: list.id,
      title,
      status: initialStatus(list.kind),
      position: nextItemPosition(all),
    })
  }

  const showFilters = all !== undefined && (inbox ? active.length > 0 : !empty)
  const addBar = all && (
    <AddItemBar
      variant={isDesktop ? 'inline' : 'docked'}
      placeholder={addPlaceholder(list, empty)}
      autoFocus={empty}
      onAdd={add}
    />
  )

  return (
    <ItemActionsContext value={actions}>
      <div
        className={cn(
          'flex flex-1 flex-col md:min-h-[calc(100dvh-4.5rem)] md:gap-[22px]',
          inbox ? 'gap-2' : 'gap-4',
        )}
      >
        {inbox ? (
          <InboxHeader inbox={list} summary={summary} />
        ) : (
          <ListDetailHeader list={list} summary={summary} />
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

        {items.isPending &&
          (items.fetchStatus === 'paused' ? <FilterEmpty>{OFFLINE_MESSAGE}</FilterEmpty> : null)}
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
              active={active}
              outOfMind={outOfMind}
              filter={statusFilter}
              empty={empty}
              isDesktop={isDesktop}
            />
          ))}

        {!isDesktop && addBar}
      </div>

      <ItemSheet
        item={openItem}
        list={list}
        isDesktop={isDesktop}
        onToggle={actions.toggle}
        onUpdate={(item, patch) => {
          if (patch.status && isFinalStatus(patch.status) && !isFinalStatus(item.status)) {
            hold(item.id)
          }
          updateItem.mutate({ item, patch })
        }}
        onMove={actions.startMove}
        onDelete={remove}
        onClose={() => {
          onOpenItem(undefined)
        }}
      />
      {!isDesktop && (
        <ItemRowMenuSheet
          item={menuItem}
          onClose={() => {
            setMenuItemId(undefined)
          }}
        />
      )}
      <MoveToList
        from={list}
        target={moveTarget}
        isDesktop={isDesktop}
        onClose={() => {
          setMoveTarget(null)
        }}
        onMove={move}
        onMoveToNewList={(item) => {
          openCreate({
            onCreated: (created) => {
              move(item, created)
            },
          })
        }}
      />
    </ItemActionsContext>
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
}: ContentProps & { list: List; filter: StatusFilter }) {
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
