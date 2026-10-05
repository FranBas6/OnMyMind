import { onlineManager } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { isSameDay } from 'date-fns'
import { useCallback } from 'react'
import { z } from 'zod'

import { listsQueryOptions } from '@/features/lists'
import {
  dayKey,
  daysQueryOptions,
  parseDayKey,
  stripMonth,
  TodayView,
  todayQueryOptions,
} from '@/features/today'

/**
 * `?item=<id>` abre el detalle de un ítem sin salir de Hoy, como en el detalle de lista.
 * `?day=2026-10-14` es otro día (2.5); sin él, o si no es una fecha, hoy.
 */
const searchSchema = z.object({
  item: z.uuid().optional().catch(undefined),
  day: z
    .string()
    .refine((text) => parseDayKey(text) !== null)
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/_authenticated/today')({
  validateSearch: searchSchema,
  // Al entrar, pide las listas, Hoy y el mes del día en paralelo antes de pintar; un fallo se
  // queda en la caché y lo cuenta la pantalla. Sin red no se espera. Abrir o cerrar un detalle no
  // vuelve a cargar nada. Cambiar de día (`stay`) solo espera si su mes no está aún en caché: lo
  // que ya está se pinta y se refresca solo.
  loaderDeps: ({ search }) => ({ day: search.day }),
  loader: async ({ context: { queryClient }, deps, cause }) => {
    if (!onlineManager.isOnline()) return
    const day = (deps.day ? parseDayKey(deps.day) : null) ?? new Date()
    const month = queryClient
      .query({ ...daysQueryOptions(stripMonth(day)), staleTime: 'static' })
      .catch(() => undefined)
    if (cause === 'stay') {
      await month
      return
    }
    await Promise.all([
      queryClient.query(listsQueryOptions).catch(() => undefined),
      queryClient.query(todayQueryOptions(new Date())).catch(() => undefined),
      month,
    ])
  },
  component: TodayPage,
})

/** Hoy (pantalla 7 y diseño 17): compone la vista de `features/today`. */
function TodayPage() {
  const { item, day } = Route.useSearch()
  const navigate = Route.useNavigate()
  // Como en el detalle de lista: abrir y cerrar el detalle no apila historial.
  const openItem = useCallback(
    (itemId: string | undefined) => {
      void navigate({ search: (search) => ({ ...search, item: itemId }), replace: true })
    },
    [navigate],
  )
  // Cambiar de día sí lo apila, para que «atrás» vuelva al de antes. Hoy va sin `?day=`.
  const selectDay = useCallback(
    (next: Date) => {
      void navigate({
        search: { day: isSameDay(next, new Date()) ? undefined : dayKey(next) },
      })
    },
    [navigate],
  )
  return (
    <TodayView
      day={(day ? parseDayKey(day) : null) ?? undefined}
      onSelectDay={selectDay}
      openItemId={item}
      onOpenItem={openItem}
    />
  )
}
