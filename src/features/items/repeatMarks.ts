import { useSyncExternalStore } from 'react'

/**
 * Lo que se ve al completar una tarea que se repite en su fila (diseño 21, B9 y B10): un segundo
 * marcada y tachada, con la fecha cambiando delante de ti («Hoy › Vie 9»), y después pendiente otra
 * vez con la fecha nueva y el borde índigo apagándose. La caché ya tiene la fecha nueva desde el
 * primer momento; esto solo cambia cómo se pinta la fila.
 */
export const DONE_MS = 1_000
/** Lo que tarda en apagarse el borde (la animación `arrive-still`). */
export const BACK_MS = 2_000

export type RepeatMark = { phase: 'done'; from: Date } | { phase: 'back' }

let marks: ReadonlyMap<string, RepeatMark> = new Map()
const listeners = new Set<() => void>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function set(itemId: string, mark: RepeatMark | null) {
  const next = new Map(marks)
  if (mark) next.set(itemId, mark)
  else next.delete(itemId)
  marks = next
  for (const listener of listeners) listener()
}

/** La fila de `itemId` acaba de completarse; `from` es la fecha que tenía. */
export function markRepeatDone(itemId: string, from: Date) {
  clearTimeout(timers.get(itemId))
  set(itemId, { phase: 'done', from })
  timers.set(
    itemId,
    setTimeout(() => {
      set(itemId, { phase: 'back' })
      timers.set(
        itemId,
        setTimeout(() => {
          set(itemId, null)
        }, BACK_MS),
      )
    }, DONE_MS),
  )
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useRepeatMark(itemId: string): RepeatMark | undefined {
  return useSyncExternalStore(subscribe, () => marks.get(itemId))
}
