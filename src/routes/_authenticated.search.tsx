import { onlineManager } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { z } from 'zod'

import { archivedListsQueryOptions, listsQueryOptions } from '@/features/lists'
import { allItemsQueryOptions, SearchView } from '@/features/search'

/**
 * `?q=` precarga la búsqueda (un enlace o el campo del sidebar); `?item=` abre un resultado en su
 * detalle sin salir de Buscar. Un `q` vacío no se escribe en la URL.
 */
const searchSchema = z.object({
  q: z.string().max(200).optional().catch(undefined),
  item: z.uuid().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/search')({
  validateSearch: searchSchema,
  // En móvil la pantalla es el campo de búsqueda: sin el + de captura (diseño 08).
  staticData: { noFab: true },
  // Pide todo en paralelo antes de pintar; sin red no se espera y se busca en lo que haya en
  // caché. Escribir o abrir un resultado cambia la URL, pero no vuelve a cargar nada.
  loaderDeps: () => ({}),
  loader: async ({ context: { queryClient } }) => {
    if (!onlineManager.isOnline()) return
    await Promise.all([
      queryClient.query(listsQueryOptions).catch(() => undefined),
      queryClient.query(archivedListsQueryOptions).catch(() => undefined),
      queryClient.query(allItemsQueryOptions).catch(() => undefined),
    ])
  },
  component: SearchPage,
})

/** Buscar (pantalla 13): compone la vista de `features/search`. */
function SearchPage() {
  const { q, item } = Route.useSearch()
  const navigate = Route.useNavigate()
  // Escribir y abrir o cerrar un resultado no apilan historial.
  const setQuery = useCallback(
    (query: string) => {
      void navigate({
        search: (previous) => ({ ...previous, q: query.trim() ? query : undefined }),
        replace: true,
      })
    },
    [navigate],
  )
  const openItem = useCallback(
    (itemId: string | undefined) => {
      void navigate({ search: (previous) => ({ ...previous, item: itemId }), replace: true })
    },
    [navigate],
  )
  return (
    <SearchView query={q ?? ''} onQueryChange={setQuery} openItemId={item} onOpenItem={openItem} />
  )
}
