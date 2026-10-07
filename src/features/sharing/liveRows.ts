import { useMemo, useSyncExternalStore } from 'react'

/**
 * Las filas que se notan porque las tocó otro en directo (diseño 20, nota 11):
 * - **Entra** (M7): lo que añade el otro aparece con fondo y borde índigo y se apaga en dos
 *   segundos. La animación es de CSS y empieza al pintarse la fila, que llega con la consulta un
 *   momento después del mensaje; la marca dura algo más para cubrir esa espera.
 * - **Lo termina** (M8): se queda en su sitio, tachado y con «Fran lo ha comprado», unos segundos,
 *   y luego baja a «Fuera de la cabeza».
 * Si la lista no está abierta, no se ve nada de esto: al volver a ella, lo nuevo ya está.
 */
export const ARRIVED_MS = 4_000
export const COMPLETED_MS = 3_000

type Marks = ReadonlySet<string>

let arrived: Marks = new Set()
let completed: Marks = new Set()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function hold(which: 'arrived' | 'completed', ids: readonly string[], ms: number) {
  if (ids.length === 0) return
  const update = (change: (marks: Set<string>) => void) => {
    const next = new Set(which === 'arrived' ? arrived : completed)
    change(next)
    if (which === 'arrived') arrived = next
    else completed = next
    emit()
  }
  update((marks) => {
    for (const id of ids) marks.add(id)
  })
  setTimeout(() => {
    update((marks) => {
      for (const id of ids) marks.delete(id)
    })
  }, ms)
}

export function markArrived(ids: readonly string[]) {
  hold('arrived', ids, ARRIVED_MS)
}

export function markCompleted(ids: readonly string[]) {
  hold('completed', ids, COMPLETED_MS)
}

/** Si esta fila acaba de entrar de otro (M7). */
export function useArrived(itemId: string): boolean {
  return useSyncExternalStore(subscribe, () => arrived.has(itemId))
}

/** Lo que otro acaba de terminar y se queda un momento en su sitio (M8). */
export function useCompletedLive(): Marks {
  return useSyncExternalStore(subscribe, () => completed)
}

/**
 * Lo que se queda un momento en su sitio en el detalle de una lista: lo que acabas de terminar tú
 * (`useLingering`) y lo que acaba de terminar otro (M8).
 */
export function useWithCompletedLive(lingering: Marks): Marks {
  const live = useCompletedLive()
  return useMemo(
    () => (live.size === 0 ? lingering : new Set([...lingering, ...live])),
    [lingering, live],
  )
}

/** Los tests empiezan sin marcas. */
export function resetLiveRows() {
  arrived = new Set()
  completed = new Set()
  emit()
}
