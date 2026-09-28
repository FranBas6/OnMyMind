import { onlineManager } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { z } from 'zod'

import { listsQueryOptions } from '@/features/lists'
import { TodayView, todayQueryOptions } from '@/features/today'

/** `?item=<id>` abre el detalle de una tarea sin salir de Hoy, como en el detalle de lista. */
const searchSchema = z.object({
  item: z.uuid().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/today')({
  validateSearch: searchSchema,
  // Pide las listas y Hoy en paralelo antes de pintar; un fallo se queda en la caché y lo cuenta
  // la pantalla. Sin red no se espera. Abrir o cerrar un detalle no vuelve a cargar nada.
  loaderDeps: () => ({}),
  loader: async ({ context: { queryClient } }) => {
    if (!onlineManager.isOnline()) return
    await Promise.all([
      queryClient.query(listsQueryOptions).catch(() => undefined),
      queryClient.query(todayQueryOptions(new Date())).catch(() => undefined),
    ])
  },
  component: TodayPage,
})

/** Hoy (pantalla 7): compone la vista de `features/today`. */
function TodayPage() {
  const { item } = Route.useSearch()
  const navigate = Route.useNavigate()
  // Como en el detalle de lista: abrir y cerrar el detalle no apila historial.
  const openItem = useCallback(
    (itemId: string | undefined) => {
      void navigate({ search: { item: itemId }, replace: true })
    },
    [navigate],
  )
  return <TodayView openItemId={item} onOpenItem={openItem} />
}
