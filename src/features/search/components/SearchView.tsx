import { useNavigate } from '@tanstack/react-router'
import { useState, type KeyboardEvent } from 'react'

import { FilterChips, ItemWorkspace, useLingering } from '@/features/items'
import { ARCHIVED_SECTION_ID, ArchivedListSheet, type List } from '@/features/lists'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { OFFLINE_MESSAGE } from '@/lib/errors'

import { useSearch } from '../hooks/useSearch'
import {
  otherFilterNote,
  resultsSummary,
  SEARCH_FILTERS,
  searchTerms,
  type SearchFilter,
} from '../search'
import { NoResults, SearchHint } from './SearchEmpty'
import { SearchField } from './SearchField'
import { SearchListsSection } from './SearchListsSection'
import { SearchSection } from './SearchSection'

/** Lo que tarda un resultado recién completado en irse de «Pendientes», como en las listas. */
const LINGER_MS = 400

interface SearchViewProps {
  /** `?q=` de la ruta. */
  query: string
  onQueryChange: (query: string) => void
  /** El ítem abierto en el detalle (`?item=`). */
  openItemId: string | undefined
  onOpenItem: (itemId: string | undefined) => void
}

/**
 * Buscar (02 §Buscar, pantalla 13 y diseño 08). En móvil, el campo, los filtros y el contador se
 * quedan arriba y los resultados pasan por debajo. En escritorio, «Buscar» con los filtros a la
 * derecha; Intro abre el primer resultado y las flechas pasan de uno a otro. Tocar un resultado
 * abre su detalle sin salir de aquí, como en Hoy. Arriba de todo, las listas cuyo nombre coincide.
 */
export function SearchView({ query, onQueryChange, openItemId, onOpenItem }: SearchViewProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [filter, setFilter] = useState<SearchFilter>('all')
  const { lingering, hold } = useLingering(LINGER_MS)
  // Lo escrito vive aquí y se copia a la URL. De la URL solo se toma lo que llega de fuera (la ×
  // del sidebar): si lo escrito va por delante de la URL, se está tecleando y manda el campo.
  const [text, setText] = useState(query)
  const [seen, setSeen] = useState(query)
  if (query !== seen) {
    setSeen(query)
    if (text === seen) setText(query)
  }
  const { items, outcome, listMatches, listOf } = useSearch({ query: text, filter, lingering })
  const navigate = useNavigate()
  const now = new Date()
  // La lista marcada con las flechas (escritorio) y la archivada con su hoja abierta (móvil).
  const [activeListId, setActiveListId] = useState<string | undefined>(undefined)
  const [archivedSheet, setArchivedSheet] = useState<List | undefined>(undefined)

  const change = (next: string) => {
    setText(next)
    setActiveListId(undefined)
    onQueryChange(next)
  }

  const typed = searchTerms(text).length > 0
  const results = outcome?.sections.flatMap((section) => section.results) ?? []

  const openList = (list: List) => {
    if (!list.archivedAt) {
      void navigate({ to: '/lists/$listId', params: { listId: list.id } })
    } else if (isDesktop) {
      // En escritorio las archivadas se desarchivan desde su sección de Inicio (diseño 04 Listas).
      void navigate({ to: '/', hash: ARCHIVED_SECTION_ID })
    } else {
      setArchivedSheet(list)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      // Con el panel abierto, Escape lo cierra él; si no, vacía y luego suelta el campo.
      if (openItemId) return
      if (text) change('')
      else event.currentTarget.blur()
      return
    }
    if (event.key === 'Enter' && !isDesktop) {
      // En el iPhone, «buscar» esconde el teclado para ver los resultados.
      event.currentTarget.blur()
      return
    }
    // Escritorio: las flechas recorren primero las listas y luego los resultados (estos se abren
    // en el panel según se llega); Intro abre el marcado o, si no hay ninguno, el primero.
    const entries = [
      ...listMatches.map(({ list }) => ({ list, itemId: undefined })),
      ...results.map((result) => ({ list: undefined, itemId: result.item.id })),
    ]
    if (!isDesktop || entries.length === 0) return
    const index = entries.findIndex((entry) =>
      openItemId
        ? entry.itemId === openItemId
        : activeListId !== undefined && entry.list?.id === activeListId,
    )
    const next =
      event.key === 'Enter'
        ? Math.max(index, 0)
        : event.key === 'ArrowDown'
          ? Math.min(index + 1, entries.length - 1)
          : event.key === 'ArrowUp' && index > 0
            ? index - 1
            : null
    const entry = next === null ? undefined : entries[next]
    if (!entry) return
    event.preventDefault()
    if (entry.list) {
      if (event.key === 'Enter') {
        openList(entry.list)
        return
      }
      setActiveListId(entry.list.id)
      if (openItemId) onOpenItem(undefined)
    } else {
      setActiveListId(undefined)
      onOpenItem(entry.itemId)
    }
  }

  const filters = typed && (
    <FilterChips
      label="Filtrar resultados"
      options={SEARCH_FILTERS}
      value={filter}
      onChange={setFilter}
    />
  )
  const summary =
    typed && outcome && outcome.count + listMatches.length > 0
      ? resultsSummary(outcome.count, outcome.sections.length, listMatches.length) +
        (isDesktop ? ' · también en notas, hechos y archivadas' : '')
      : null

  return (
    <ItemWorkspace
      items={items.data}
      listOf={listOf}
      openItemId={openItemId}
      onOpenItem={onOpenItem}
      onFinish={hold}
      onOpenSublist={(sublist) => {
        void navigate({
          to: '/lists/$listId/$sublistId',
          params: { listId: sublist.listId, sublistId: sublist.id },
        })
      }}
    >
      <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-7.75rem)] flex-col gap-3.5 md:min-h-[calc(100dvh-4.5rem)] md:gap-5">
        {isDesktop ? (
          <div className="flex items-center gap-4">
            <h1 className="leading-[1.1] md:text-[32px]">Buscar</h1>
            <div className="ml-auto">{filters}</div>
          </div>
        ) : (
          <h1 className="sr-only">Buscar</h1>
        )}

        {/* En móvil, fijo arriba (diseño 08, B3); lo de encima tapa lo que pasa bajo la muesca. */}
        <div className="sticky top-[env(safe-area-inset-top)] z-20 -mx-5 flex flex-col gap-3.5 bg-background px-5 pb-1 before:absolute before:inset-x-0 before:bottom-full before:h-[calc(env(safe-area-inset-top)+0.75rem)] before:bg-background before:content-[''] md:static md:mx-0 md:gap-5 md:px-0 md:pb-0 md:before:hidden">
          <SearchField value={text} onChange={change} onKeyDown={onKeyDown} isDesktop={isDesktop} />
          {!isDesktop && filters}
          {summary && <p className="px-1 text-[13px] text-muted-foreground">{summary}</p>}
        </div>

        {!typed && <SearchHint isDesktop={isDesktop} />}
        {typed && items.isPending && items.fetchStatus === 'paused' && (
          <p className="px-1 py-6 text-center text-[15px] text-muted-foreground">
            {OFFLINE_MESSAGE}
          </p>
        )}
        {typed && items.isError && (
          <p role="alert" className="px-1 text-[15px] text-muted-foreground">
            No hemos podido buscar. Prueba otra vez en un momento.
          </p>
        )}
        {typed && listMatches.length > 0 && (
          <SearchListsSection
            matches={listMatches}
            activeId={activeListId}
            onOpenArchived={openList}
          />
        )}
        {typed && outcome?.count === 0 && listMatches.length === 0 && (
          <NoResults
            query={text}
            otherNote={otherFilterNote(filter, outcome.otherCount)}
            onShowAll={() => {
              setFilter('all')
            }}
          />
        )}
        {typed && outcome && outcome.count > 0 && (
          <div className="-mt-1 flex flex-col gap-[18px]">
            {outcome.sections.map((section) => (
              <SearchSection key={section.list.id} section={section} now={now} />
            ))}
          </div>
        )}
      </div>
      {!isDesktop && (
        <ArchivedListSheet
          list={archivedSheet}
          onClose={() => {
            setArchivedSheet(undefined)
          }}
        />
      )}
      {/* Con muchos resultados, la lista se funde al llegar a la barra (diseño 08, B3). */}
      {!isDesktop && outcome && outcome.count > 0 && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-30 h-10 bg-linear-to-t from-background"
        />
      )}
    </ItemWorkspace>
  )
}
