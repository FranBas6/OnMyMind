import { onlineManager } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'

import { itemsQueryOptions, ListDetail } from '@/features/items'
import { listsQueryOptions, useLists } from '@/features/lists'

export const Route = createFileRoute('/_authenticated/lists/$listId')({
  // En móvil, el campo de añadir va pegado encima de la barra y sustituye al FAB (06 §Layout).
  staticData: { addBar: true },
  // Pide la lista y sus ítems en paralelo antes de pintar. Como en Inicio, un fallo no se lanza:
  // se queda en la caché y lo cuenta la pantalla. Sin red no se espera: la pantalla enseña lo que
  // haya en caché en vez de quedarse en blanco hasta que vuelva la conexión.
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
  const lists = useLists()

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
  // de esta pantalla acaban aquí, y el aviso «Deshacer» sale ya en Inicio).
  if (!list) return <Navigate to="/" replace />

  return <ListDetail key={list.id} list={list} />
}
