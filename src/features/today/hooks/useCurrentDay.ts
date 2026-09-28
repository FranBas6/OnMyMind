import { addDays, parseISO, startOfDay } from 'date-fns'
import { useMemo, useSyncExternalStore } from 'react'

import { dayKey } from '../today'

/**
 * Avisa cuando cambia el día: un temporizador hasta la medianoche siguiente y, por si el
 * dispositivo se durmió o se cambió la hora del sistema, al volver a la pestaña. Un temporizador
 * no avanza con el Mac dormido, así que por sí solo llegaría tarde.
 */
function subscribe(onChange: () => void) {
  let timer = 0
  const schedule = () => {
    window.clearTimeout(timer)
    const now = new Date()
    const midnight = startOfDay(addDays(now, 1))
    // Un segundo de margen: que al saltar ya sea el día nuevo.
    timer = window.setTimeout(
      () => {
        onChange()
        schedule()
      },
      midnight.getTime() - now.getTime() + 1000,
    )
  }
  const recheck = () => {
    onChange()
    schedule()
  }
  schedule()
  window.addEventListener('focus', recheck)
  document.addEventListener('visibilitychange', recheck)
  return () => {
    window.clearTimeout(timer)
    window.removeEventListener('focus', recheck)
    document.removeEventListener('visibilitychange', recheck)
  }
}

const getSnapshot = () => dayKey(new Date())

/**
 * El día de hoy en la zona del dispositivo, como las 00:00 locales. Solo cambia (y solo vuelve a
 * pintar) al pasar la medianoche: el texto del día es lo que compara `useSyncExternalStore`.
 */
export function useCurrentDay(): Date {
  const day = useSyncExternalStore(subscribe, getSnapshot)
  return useMemo(() => parseISO(day), [day])
}
