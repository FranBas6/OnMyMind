import type { List } from './types'

/**
 * Desde cuántas listas sale el buscador al elegir una donde no salen las sublistas (Perfil › «Lista
 * por defecto» en el móvil y «Exportar» en CSV; Fran, 2026-11-16): con menos, se ven todas sin
 * buscar y el campo sería ruido.
 */
export const LIST_SEARCH_FROM = 9

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Las listas cuyo nombre contiene lo escrito, sin tildes ni mayúsculas; sin nada escrito, todas. */
export function filterListsByName<T extends Pick<List, 'name'>>(
  lists: readonly T[],
  query: string,
): T[] {
  const term = plain(query.trim())
  if (!term) return [...lists]
  return lists.filter((list) => plain(list.name).includes(term))
}
