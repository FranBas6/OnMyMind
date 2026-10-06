import { onlineManager } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { z } from 'zod'

import { itemsQueryOptions, ListDetail, useItems, useOpenSublist } from '@/features/items'
import { listsQueryOptions, useLists } from '@/features/lists'
import { GoneList } from '@/features/sharing'

/**
 * `?item=` abre el detalle de algo de dentro, como en la lista; `?rename=` entra con el nombre de
 * la sublista listo para editar («Renombrar» desde el menú de su fila).
 */
const searchSchema = z.object({
  item: z.uuid().optional().catch(undefined),
  rename: z.number().optional().catch(undefined),
})

/**
 * Pantalla de una sublista (diseño 12, S2): `$listId_` la deja fuera de la ruta de la lista (no
 * es una pantalla dentro de otra, sino al lado). Lo de dentro viene con los ítems de la lista, que
 * ya los trae: se pide lo mismo que allí.
 */
export const Route = createFileRoute('/_authenticated/lists/$listId_/$sublistId')({
  validateSearch: searchSchema,
  staticData: { addBar: true },
  loaderDeps: () => ({}),
  loader: async ({ context: { queryClient }, params }) => {
    if (!onlineManager.isOnline()) return
    await Promise.all([
      queryClient.query(listsQueryOptions).catch(() => undefined),
      queryClient.query(itemsQueryOptions(params.listId)).catch(() => undefined),
    ])
  },
  component: SublistPage,
})

function SublistPage() {
  const { listId, sublistId } = Route.useParams()
  const { item, rename } = Route.useSearch()
  const navigate = Route.useNavigate()
  const lists = useLists()
  const items = useItems(listId)
  const openSublist = useOpenSublist(listId)

  const openItem = useCallback(
    (itemId: string | undefined) => {
      void navigate({ search: { item: itemId }, replace: true })
    },
    [navigate],
  )

  if (lists.isError) {
    return (
      <p role="alert" className="px-1 text-[15px] text-muted-foreground">
        No hemos podido cargar esta lista. Prueba otra vez en un momento.
      </p>
    )
  }
  if (!lists.data) return null

  const { inbox, lists: others } = lists.data
  const list = inbox?.id === listId ? inbox : others.find((entry) => entry.id === listId)
  // Como en la lista: si era compartida y ya no la tienes, se dice por qué (3.3).
  if (!list) return <GoneList listId={listId} />

  // Sin los ítems de la lista aún no se sabe si existe; sin red y sin caché, a la lista, que lo
  // explica. Borrada o movida a otra lista (también desde su propio menú): de vuelta a su lista.
  if (!items.data) {
    if (items.isError || items.fetchStatus === 'paused') {
      return <Navigate to="/lists/$listId" params={{ listId }} replace />
    }
    return null
  }
  const sublist = items.data.find((entry) => entry.id === sublistId && entry.kind === 'sublist')
  if (!sublist) return <Navigate to="/lists/$listId" params={{ listId }} replace />

  return (
    <ListDetail
      key={sublist.id}
      list={list}
      sublist={sublist}
      openItemId={item}
      onOpenItem={openItem}
      onOpenSublist={openSublist}
      renameKey={rename}
    />
  )
}
