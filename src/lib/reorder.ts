/**
 * Ordenar a mano (sesión 2.9, diseño 14): dónde cae lo que se suelta. Ítems y listas guardan su
 * orden en `position`, un entero con huecos de 1000 (04 §Gestos). Al soltar entre dos, toma el
 * punto medio; si ya no cabe un entero entre los dos, se renumeran todos (1000, 2000…). Así casi
 * siempre se guarda una sola fila.
 */

export const POSITION_STEP = 1000

export interface Positioned {
  id: string
  position: number
}

/** Los vecinos que tendrá lo que se mueve, entre lo que se ve. `null` es el principio o el final. */
export interface Neighbors {
  prevId: string | null
  nextId: string | null
}

/**
 * Los vecinos tras soltar `movedId` sobre `overId` en una lista de ids a la vista (como
 * `arrayMove` de dnd-kit: ocupa el sitio de `overId`). `null` si no cambia nada.
 */
export function dropNeighbors(
  visibleIds: readonly string[],
  movedId: string,
  overId: string,
): Neighbors | null {
  const from = visibleIds.indexOf(movedId)
  const to = visibleIds.indexOf(overId)
  if (from < 0 || to < 0 || from === to) return null
  const rest = visibleIds.filter((id) => id !== movedId)
  rest.splice(to, 0, movedId)
  return { prevId: rest[to - 1] ?? null, nextId: rest[to + 1] ?? null }
}

/** Los vecinos al subir o bajar uno (el «Subir» y «Bajar» del menú, y ⌥↑ ⌥↓). */
export function stepNeighbors(
  visibleIds: readonly string[],
  movedId: string,
  direction: 'up' | 'down',
): Neighbors | null {
  const index = visibleIds.indexOf(movedId)
  if (index < 0) return null
  const target = direction === 'up' ? index - 1 : index + 1
  const over = visibleIds[target]
  return over === undefined ? null : dropNeighbors(visibleIds, movedId, over)
}

/** Si se puede subir o bajar (para apagar «Subir» en la primera y «Bajar» en la última). */
export function canStep(
  visibleIds: readonly string[],
  id: string,
  direction: 'up' | 'down',
): boolean {
  const index = visibleIds.indexOf(id)
  if (index < 0) return false
  return direction === 'up' ? index > 0 : index < visibleIds.length - 1
}

/**
 * Las posiciones nuevas al poner `movedId` entre `prevId` y `nextId`. `order` son todos sus
 * hermanos (también los que un filtro esconde) en el orden en que se ven; lo escondido conserva su
 * sitio. Devuelve solo lo que cambia: casi siempre, una fila. Con `renumber` (pasar «En mente» a
 * «A mi manera», que fija el orden que se ve), o si no cabe, renumera todos.
 */
export function reorder(
  order: readonly Positioned[],
  movedId: string,
  { prevId, nextId }: Neighbors,
  { renumber = false }: { renumber?: boolean } = {},
): Positioned[] {
  const moved = order.find((entry) => entry.id === movedId)
  if (!moved) return []
  const rest = order.filter((entry) => entry.id !== movedId)
  const afterPrev = prevId === null ? -1 : rest.findIndex((entry) => entry.id === prevId)
  const beforeNext = nextId === null ? rest.length : rest.findIndex((entry) => entry.id === nextId)
  // Tras su vecino de arriba; si no tiene (va el primero de lo que se ve), justo antes del de abajo.
  const at = prevId !== null && afterPrev >= 0 ? afterPrev + 1 : Math.max(0, beforeNext)
  const next = [...rest.slice(0, at), moved, ...rest.slice(at)]

  const before = next[at - 1]
  const after = next[at + 1]
  if (!renumber) {
    if (before && after) {
      if (after.position - before.position >= 2) {
        return [
          {
            id: movedId,
            position: before.position + Math.floor((after.position - before.position) / 2),
          },
        ]
      }
    } else if (before) {
      return [{ id: movedId, position: before.position + POSITION_STEP }]
    } else if (after) {
      return [{ id: movedId, position: after.position - POSITION_STEP }]
    } else {
      return []
    }
  }
  return next
    .map((entry, index) => ({ id: entry.id, position: (index + 1) * POSITION_STEP }))
    .filter((entry, index) => entry.position !== next[index]?.position)
}

/** Aplica posiciones nuevas a una lista de cosas con `id` y `position`. */
export function withPositions<T extends Positioned>(
  entries: readonly T[],
  changes: readonly Positioned[],
): T[] {
  if (changes.length === 0) return [...entries]
  const byId = new Map(changes.map((change) => [change.id, change.position]))
  return entries.map((entry) => {
    const position = byId.get(entry.id)
    return position === undefined ? entry : { ...entry, position }
  })
}
