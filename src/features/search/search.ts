import { format, isSameYear } from 'date-fns'

import { isOutOfMind, STATUS_LABELS, type Item } from '@/features/items'
import type { List } from '@/features/lists'
import { formatCaptureAge, formatDueDate } from '@/lib/date'

/** Todo / Pendientes / Hechas (pantalla 13). «Hechas» es lo que está fuera de la cabeza. */
export type SearchFilter = 'all' | 'open' | 'done'

export const SEARCH_FILTERS: readonly { value: SearchFilter; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'open', label: 'Pendientes' },
  { value: 'done', label: 'Hechas' },
]

/** Un trozo `[start, end)` del texto original que coincide con lo buscado. */
export type Range = readonly [start: number, end: number]

/**
 * Texto sin acentos ni mayúsculas, carácter a carácter, con un mapa de vuelta al original: así
 * se busca en la versión plana («cafe») y se resalta en la de verdad («café»). No basta con
 * normalizar el texto entero: `é` en NFD son dos caracteres y las posiciones dejarían de cuadrar.
 */
function fold(text: string): { folded: string; starts: number[]; ends: number[] } {
  let folded = ''
  const starts: number[] = []
  const ends: number[] = []
  let index = 0
  for (const char of text) {
    const plain = char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    // Una entrada por unidad de `plain` (su `length`), que es como cuenta `indexOf`.
    starts.push(...new Array<number>(plain.length).fill(index))
    ends.push(...new Array<number>(plain.length).fill(index + char.length))
    folded += plain
    index += char.length
  }
  return { folded, starts, ends }
}

/** Las palabras de la búsqueda, ya aplanadas. Vacío si solo hay espacios. */
export function searchTerms(query: string): string[] {
  return fold(query).folded.split(/\s+/).filter(Boolean)
}

/** Dónde aparece cada palabra en `text`, en orden y sin solaparse. */
export function findRanges(text: string, terms: readonly string[]): Range[] {
  if (terms.length === 0) return []
  const { folded, starts, ends } = fold(text)
  const hits: [number, number][] = []
  for (const term of terms) {
    let from = folded.indexOf(term)
    while (from !== -1) {
      hits.push([starts[from] ?? 0, ends[from + term.length - 1] ?? text.length])
      from = folded.indexOf(term, from + term.length)
    }
  }
  hits.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const hit of hits) {
    const previous = merged.at(-1)
    if (previous && hit[0] <= previous[1]) previous[1] = Math.max(previous[1], hit[1])
    else merged.push(hit)
  }
  return merged
}

const contains = (text: string, term: string) => fold(text).folded.includes(term)

/** Letras que se enseñan antes de la coincidencia en el fragmento de la nota. */
const SNIPPET_LEAD = 20

export interface Snippet {
  text: string
  ranges: Range[]
}

/**
 * Fragmento de la nota para una coincidencia que no está (entera) en el título (diseño 08, B2):
 * una sola línea, empezando un poco antes de la primera coincidencia en un límite de palabra, con
 * «…» delante si se corta. El final lo recorta el CSS con sus puntos suspensivos.
 */
export function noteSnippet(notes: string, terms: readonly string[]): Snippet | null {
  const line = notes.replace(/\s+/g, ' ').trim()
  const first = findRanges(line, terms)[0]
  if (!first) return null
  let start = Math.max(0, first[0] - SNIPPET_LEAD)
  if (start > 0) {
    const space = line.indexOf(' ', start)
    start = space !== -1 && space < first[0] ? space + 1 : start
  }
  const prefix = start > 0 ? '…' : ''
  const text = prefix + line.slice(start)
  const shift = prefix.length - start
  return {
    text,
    ranges: findRanges(line, terms)
      .filter(([from]) => from >= start)
      .map(([from, to]) => [from + shift, to + shift] as const),
  }
}

export interface SearchResult {
  item: Item
  /** Dónde resaltar en el título. */
  titleRanges: Range[]
  /** Solo si alguna palabra está en las notas y no en el título. */
  snippet: Snippet | null
  /** Terminado (fuera de la cabeza): va tachado y cuenta para «Hechas». */
  done: boolean
}

export interface SearchSection {
  list: List
  results: SearchResult[]
}

export interface SearchOutcome {
  sections: SearchSection[]
  /** Resultados con el filtro elegido. */
  count: number
  /** Con el filtro «Pendientes» o «Hechas», cuántos hay en el otro (para «Hay 4 en Hechas»). */
  otherCount: number
}

interface SearchOptions {
  filter: SearchFilter
  now?: Date
  /** Recién terminados que se quedan un momento donde estaban (06 §Interacción). */
  lingering?: ReadonlySet<string>
}

/** «En mente» primero, luego las listas en su orden y las archivadas al final. */
function sectionOrder(list: List): [number, number] {
  if (list.kind === 'inbox') return [0, 0]
  return [list.archivedAt ? 2 : 1, list.position]
}

/**
 * Busca en el título y las notas de todos los ítems (02 §Buscar): cada palabra tiene que estar
 * en uno de los dos, sin acentos ni mayúsculas. Agrupa por lista; dentro, lo pendiente antes, lo
 * que coincide en el título antes que lo que solo coincide en las notas, y lo más reciente antes.
 * Los ítems de listas que no están en caché (de otra cuenta, recién borradas) no salen.
 */
export function searchItems(
  items: readonly Item[],
  lists: readonly List[],
  query: string,
  { filter, now = new Date(), lingering }: SearchOptions,
): SearchOutcome {
  const terms = searchTerms(query)
  const byId = new Map(lists.map((list) => [list.id, list]))
  const sections = new Map<string, SearchSection>()
  let open = 0
  let done = 0
  if (terms.length === 0) return { sections: [], count: 0, otherCount: 0 }

  for (const item of items) {
    const list = byId.get(item.listId)
    if (!list) continue
    const inTitle = terms.filter((term) => contains(item.title, term))
    const rest = terms.filter((term) => !inTitle.includes(term))
    if (
      rest.length > 0 &&
      !(item.notes && rest.every((term) => contains(item.notes ?? '', term)))
    ) {
      continue
    }
    const isDone = isOutOfMind(item, now) && !lingering?.has(item.id)
    if (isDone) done++
    else open++
    if ((filter === 'open' && isDone) || (filter === 'done' && !isDone)) continue

    const section = sections.get(list.id) ?? { list, results: [] }
    section.results.push({
      item,
      titleRanges: findRanges(item.title, terms),
      snippet: rest.length > 0 && item.notes ? noteSnippet(item.notes, terms) : null,
      done: isDone,
    })
    sections.set(list.id, section)
  }

  const ordered = [...sections.values()].sort((a, b) => {
    const [groupA, positionA] = sectionOrder(a.list)
    const [groupB, positionB] = sectionOrder(b.list)
    return groupA - groupB || positionA - positionB
  })
  for (const section of ordered) {
    section.results.sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        Number(a.snippet !== null) - Number(b.snippet !== null) ||
        b.item.createdAt.getTime() - a.item.createdAt.getTime(),
    )
  }

  const count = ordered.reduce((total, section) => total + section.results.length, 0)
  const otherCount = filter === 'open' ? done : filter === 'done' ? open : 0
  return { sections: ordered, count, otherCount }
}

/** Cuántas listas se enseñan arriba como mucho: es un atajo, no un listado. */
export const LIST_MATCHES_MAX = 3

export interface ListMatch {
  list: List
  /** Dónde resaltar en el nombre. */
  ranges: Range[]
}

/**
 * Listas cuyo nombre tiene todas las palabras (Buscar para todo, decisión de Fran en 1.12): van
 * arriba, en el orden de las secciones («En mente», las listas y las archivadas al final), tres
 * como mucho.
 */
export function searchLists(lists: readonly List[], query: string): ListMatch[] {
  const terms = searchTerms(query)
  if (terms.length === 0) return []
  return lists
    .filter((list) => terms.every((term) => contains(list.name, term)))
    .sort((a, b) => {
      const [groupA, positionA] = sectionOrder(a)
      const [groupB, positionB] = sectionOrder(b)
      return groupA - groupB || positionA - positionB
    })
    .slice(0, LIST_MATCHES_MAX)
    .map((list) => ({ list, ranges: findRanges(list.name, terms) }))
}

const shortDate = (date: Date, now: Date) =>
  format(date, isSameYear(date, now) ? 'd MMM' : 'd MMM yyyy')

/**
 * La línea bajo el título de un resultado (pantalla 13 y diseño 08): el estado y su fecha.
 * «En curso · Mañana», «Pendiente · 15 oct», «Hecha · 2 sep», «Descartado · 12 ago» y, en «En
 * mente», «Sin ordenar · hace 3 días». Lo terminado lleva la fecha en que se terminó.
 */
export function resultMeta(item: Item, now: Date = new Date()): string {
  if (item.kind === 'note' && item.status === 'pending') {
    return `Sin ordenar · ${formatCaptureAge(item.createdAt, now)}`
  }
  const label = STATUS_LABELS[item.status]
  const date = item.completedAt
    ? shortDate(item.completedAt, now)
    : item.dueAt && item.kind === 'task'
      ? formatDueDate(item.dueAt, now).text
      : null
  return date ? `${label} · ${date}` : label
}

const listsLabel = (count: number) => `${count} ${count === 1 ? 'lista' : 'listas'}`

/**
 * «7 resultados en 6 listas», «1 resultado en 1 lista». Si también coinciden listas por su nombre,
 * van delante: «2 listas · 1 resultado en 1 lista», o solo «2 listas».
 */
export function resultsSummary(count: number, sections: number, listMatches = 0): string {
  const items =
    count > 0
      ? `${count} ${count === 1 ? 'resultado' : 'resultados'} en ${listsLabel(sections)}`
      : null
  const lists = listMatches > 0 ? listsLabel(listMatches) : null
  return [lists, items].filter(Boolean).join(' · ')
}

/**
 * Sin resultados con un filtro puesto pero con alguno en el otro (diseño 08, B6): «Nada
 * pendiente. Hay 4 en Hechas.».
 */
export function otherFilterNote(filter: SearchFilter, otherCount: number): string | null {
  if (filter === 'all' || otherCount === 0) return null
  return filter === 'open'
    ? `Nada pendiente. Hay ${otherCount} en Hechas.`
    : `Nada hecho. Hay ${otherCount} en Pendientes.`
}
