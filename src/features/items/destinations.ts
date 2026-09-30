import type { List } from '@/features/lists'

import type { Item } from './types'

/**
 * A dónde puede ir algo: una lista o una sublista suya (diseño 12, A3 y A5). `id` es el de la
 * sublista si la hay, o el de la lista: así la captura y «Mover a…» eligen por un solo id.
 */
export interface Destination {
  id: string
  list: List
  sublist: Item | null
}

export const listDestination = (list: List): Destination => ({ id: list.id, list, sublist: null })

/**
 * Los destinos en su orden: «En mente», y cada lista seguida de sus sublistas no hechas, en el
 * orden de la lista (filas planas bajo su lista, sin sangrías: un solo nivel). Una sublista hecha
 * ya no es destino; una pausada sí, atenuada.
 */
export function destinationsOf(lists: readonly List[], sublists: readonly Item[]): Destination[] {
  const byList = new Map<string, Item[]>()
  for (const sublist of sublists) {
    if (sublist.kind !== 'sublist' || sublist.status === 'done') continue
    byList.set(sublist.listId, [...(byList.get(sublist.listId) ?? []), sublist])
  }
  const ordered = [
    ...lists.filter((list) => list.kind === 'inbox'),
    ...lists.filter((list) => list.kind !== 'inbox'),
  ]
  return ordered.flatMap((list) => [
    listDestination(list),
    ...(byList.get(list.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((sublist) => ({ id: sublist.id, list, sublist })),
  ])
}

/** «Viajes › Lisboa», o el nombre de la lista. */
export function destinationName(destination: Destination): string {
  return destination.sublist
    ? `${destination.list.name} › ${destination.sublist.title}`
    : destination.list.name
}

/** El nombre corto: la sublista sola («Guardado en Lisboa», «Desde Lisboa»). */
export function destinationShortName(destination: Destination): string {
  return destination.sublist?.title ?? destination.list.name
}

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * Buscador de «Buscar lista o sublista…»: sin acentos ni mayúsculas, por el nombre de la lista o
 * el de la sublista. Una lista que coincide trae también sus sublistas (se buscaba «Viajes»).
 */
export function filterDestinations(
  destinations: readonly Destination[],
  query: string,
): Destination[] {
  const term = plain(query.trim())
  if (!term) return [...destinations]
  return destinations.filter(
    (destination) =>
      plain(destination.list.name).includes(term) ||
      (destination.sublist !== null && plain(destination.sublist.title).includes(term)),
  )
}
