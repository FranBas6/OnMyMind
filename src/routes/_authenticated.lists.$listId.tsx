import { onlineManager } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { z } from 'zod'

import { itemsQueryOptions, ListDetail, useOpenSublist } from '@/features/items'
import { listsQueryOptions, useLists } from '@/features/lists'
import { GoneList } from '@/features/sharing'

/**
 * `?item=<id>` abre el detalle de un ítem (04 §Rutas): un enlace directo o, en fase 2, una
 * notificación. El router valida la URL con este esquema antes de pintar, y el resultado es un
 * objeto tipado: `Route.useSearch()` devuelve `{ item?: string }`, y cualquier `Link` o
 * `navigate` a esta ruta solo acepta ese parámetro. Un valor que no es un uuid se descarta
 * (`catch`) en vez de romper la pantalla.
 */
const searchSchema = z.object({
  item: z.uuid().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/lists/$listId')({
  validateSearch: searchSchema,
  // En móvil, el campo de añadir va pegado encima de la barra y sustituye al FAB (06 §Layout).
  staticData: { addBar: true },
  // Pide la lista y sus ítems en paralelo antes de pintar. Como en Inicio, un fallo no se lanza:
  // se queda en la caché y lo cuenta la pantalla. Sin red no se espera: la pantalla enseña lo que
  // haya en caché en vez de quedarse en blanco hasta que vuelva la conexión. `loaderDeps` deja el
  // loader al margen de `?item=`: abrir o cerrar un detalle no vuelve a cargar nada.
  loaderDeps: () => ({}),
  loader: async ({ context: { queryClient }, params }) => {
    if (!onlineManager.isOnline()) return
    await Promise.all([
      queryClient.query(listsQueryOptions).catch(() => undefined),
      queryClient.query(itemsQueryOptions(params.listId)).catch(() => undefined),
    ])
  },
  component: ListDetailPage,
})

/** Detalle de lista: busca la lista entre las del usuario y compone la pantalla de `features/items`. */
function ListDetailPage() {
  const { listId } = Route.useParams()
  const { item } = Route.useSearch()
  const navigate = Route.useNavigate()
  const lists = useLists()

  // Abrir y cerrar el detalle cambia la URL sin apilar historial: pasar de un ítem a otro en el
  // panel de escritorio no llena el botón «atrás».
  const openItem = useCallback(
    (itemId: string | undefined) => {
      void navigate({ search: { item: itemId }, replace: true })
    },
    [navigate],
  )
  const openSublist = useOpenSublist(listId)

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
  // Borrada, archivada o de otra persona: de vuelta a Inicio (archivar y borrar desde el menú
  // de esta pantalla acaban aquí, y el aviso «Deshacer» sale ya en Inicio). Si era una lista
  // compartida contigo y te quitaron, o quien la creó la borró o archivó, antes se dice (3.3).
  if (!list) return <GoneList listId={listId} />

  return (
    <ListDetail
      key={list.id}
      list={list}
      openItemId={item}
      onOpenItem={openItem}
      onOpenSublist={openSublist}
    />
  )
}
