import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { createCalendarToken, fetchCalendarToken, rotateCalendarToken } from '../api'
import { calendarFeedUrl, subscribeUrl } from '../calendar'

/**
 * Crear y cambiar el enlace piden conexión (diseño 21, C6): no se guardan para luego, como los
 * ítems. Sin red, la hoja ya los desactiva; copiar sigue funcionando con el enlace guardado.
 */
const NEEDS_NETWORK = { networkMode: 'online' } as const

/**
 * Tu enlace del Calendario: `token` (`null` si aún no tienes), su dirección `webcal://` (`url`), la
 * que se suscribe en Apple, y la `https://` (`httpsUrl`), la que se pega en Google Calendar o en
 * Outlook (4.2). Se guarda con la caché, así que sin red se sigue viendo y copiando.
 */
export function useCalendarFeed() {
  const token = useQuery({ queryKey: queryKeys.calendarToken, queryFn: fetchCalendarToken })
  const value = token.data ?? null
  const httpsUrl = value ? calendarFeedUrl(value, import.meta.env.VITE_SUPABASE_URL ?? '') : null
  return {
    ...token,
    url: httpsUrl ? subscribeUrl(httpsUrl) : null,
    httpsUrl,
  }
}

/** Crea tu enlace si no tenías (al abrir la hoja la primera vez). */
export function useCreateCalendarFeed() {
  const queryClient = useQueryClient()
  return useMutation({
    ...NEEDS_NETWORK,
    mutationFn: createCalendarToken,
    onSuccess: (token) => {
      queryClient.setQueryData(queryKeys.calendarToken, token)
    },
  })
}

/** «Cambiar enlace» (C4, C5): desde ya, el anterior da 404. */
export function useRotateCalendarFeed() {
  const queryClient = useQueryClient()
  return useMutation({
    ...NEEDS_NETWORK,
    mutationFn: rotateCalendarToken,
    onSuccess: (token) => {
      queryClient.setQueryData(queryKeys.calendarToken, token)
    },
  })
}
