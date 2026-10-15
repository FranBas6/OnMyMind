import { onlineManager } from '@tanstack/react-query'
import { createFileRoute, Navigate, useRouter } from '@tanstack/react-router'
import { useCallback, useRef } from 'react'
import { z } from 'zod'

import { itemsQueryOptions, ListDetail, useItems, useOpenSublist } from '@/features/items'
import type { List } from '@/features/lists'
import {
  hiddenListIdsQueryOptions,
  HiddenListGate,
  listsQueryOptions,
  useHiddenListIds,
  useLists,
} from '@/features/lists'
import { getUnlocked } from '@/features/private'
import { GoneList } from '@/features/sharing'

/**
 * `?item=` abre el detalle de algo de dentro, como en la lista; `?rename=` entra con el nombre de
 * la sublista listo para editar («Renombrar» desde el menú de su fila); `?comparar` compara sus
 * opciones (5.2), y Atrás lo cierra.
 */
const searchSchema = z.object({
  item: z.uuid().optional().catch(undefined),
  rename: z.number().optional().catch(undefined),
  comparar: z.boolean().optional().catch(undefined),
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
    // Lo de una lista oculta no se pide sin desbloquear (5.8).
    const hidden = await queryClient
      .query({ ...hiddenListIdsQueryOptions, staleTime: 'static' })
      .catch(() => [] as string[])
    const locked = hidden.includes(params.listId) && getUnlocked() === null
    await Promise.all([
      queryClient.query(listsQueryOptions).catch(() => undefined),
      locked
        ? undefined
        : queryClient.query(itemsQueryOptions(params.listId)).catch(() => undefined),
    ])
  },
  component: SublistPage,
})

function SublistPage() {
  const { listId } = Route.useParams()
  const lists = useLists()
  const hiddenIds = useHiddenListIds()

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
  if (list) return <SublistScreen list={list} />
  // De una lista oculta (5.8): desbloqueando, como siempre.
  if (hiddenIds.data?.includes(listId)) {
    return (
      <HiddenListGate listId={listId}>{(hidden) => <SublistScreen list={hidden} />}</HiddenListGate>
    )
  }
  if (hiddenIds.data === undefined && hiddenIds.fetchStatus === 'fetching') return null
  // Como en la lista: si era compartida y ya no la tienes, se dice por qué (3.3).
  return <GoneList listId={listId} />
}

/** La sublista, ya con su lista: lo de dentro se pide aquí, no antes de saber si se puede. */
function SublistScreen({ list }: { list: List }) {
  const { listId, sublistId } = Route.useParams()
  const { item, rename, comparar } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  // Comparar entra en el historial, así que Atrás lo cierra. Si se abrió aquí, la ✕ hace lo mismo
  // que Atrás; si se llegó con `?comparar` (un enlace, recargar), se quita sin salir de la app.
  const comparedHere = useRef(false)
  const items = useItems(listId)
  const openSublist = useOpenSublist(listId)

  const openItem = useCallback(
    (itemId: string | undefined) => {
      void navigate({ search: { item: itemId }, replace: true })
    },
    [navigate],
  )

  const compare = useCallback(
    (open: boolean) => {
      if (open) {
        comparedHere.current = true
        void navigate({ search: (prev) => ({ ...prev, comparar: true }) })
        return
      }
      if (comparedHere.current) {
        comparedHere.current = false
        router.history.back()
        return
      }
      void navigate({ search: (prev) => ({ ...prev, comparar: undefined }), replace: true })
    },
    [navigate, router],
  )

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
      comparing={comparar ?? false}
      onCompare={compare}
    />
  )
}
