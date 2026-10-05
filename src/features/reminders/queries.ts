import { queryOptions } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { fetchReminders } from './api'
import { readPushState } from './push'

export const remindersQueryOptions = queryOptions({
  queryKey: queryKeys.reminders,
  queryFn: fetchReminders,
})

/**
 * Cómo está este dispositivo. Se vuelve a mirar al volver a la app (`staleTime: 0`): el permiso
 * se cambia en los ajustes del sistema, fuera de ella. Sin red no se espera (`always`): lo sabe
 * el navegador.
 */
export const pushStateQueryOptions = queryOptions({
  queryKey: queryKeys.push,
  queryFn: readPushState,
  staleTime: 0,
  networkMode: 'always',
})
