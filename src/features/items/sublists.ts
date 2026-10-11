import { chosenLabel, chosenOption, chosenSummary, isChoosing, optionsMeta } from './chooseOne'
import { ITEM_TITLE_MAX_LENGTH } from './schemas'
import { initialStatus, isActiveSublistStatus, isOutOfMind, STATUS_LABELS } from './status'
import { withLinks } from './stores'
import type { Item } from './types'

/**
 * Lo que cuenta una lista o una sublista: lo pendiente, lo que ya está fuera de la cabeza y las
 * notas, que no son algo por hacer y van aparte (5.3).
 */
export interface Counts {
  pending: number
  done: number
  notes: number
}

/**
 * Lo que cuentan los ítems de una lista, con las mismas reglas que la vista `list_counters`
 * (ADR-010): la sublista en sí no cuenta (es un contenedor), lo de dentro de una sublista activa
 * cuenta como cualquier ítem, y lo de dentro de una pausada o hecha se calla. Las opciones
 * pendientes de una «para elegir una» (5.1) cuentan como una sola cosa: solo se va a hacer una.
 * Las notas van aparte (5.3). Con esto se calculan los cambios optimistas de los contadores de
 * Inicio y el sidebar.
 */
export function countItems(items: readonly Item[], now: Date = new Date()): Counts {
  const parents = new Map(
    items.filter((item) => item.kind === 'sublist').map((item) => [item.id, item]),
  )
  const counts: Counts = { pending: 0, done: 0, notes: 0 }
  const choosing = new Set<string>()
  for (const item of items) {
    if (item.kind === 'sublist') continue
    const parent = item.parentId === null ? undefined : parents.get(item.parentId)
    if (parent && !isActiveSublistStatus(parent.status)) continue
    if (isOutOfMind(item, now)) counts.done += 1
    else if (parent && isChoosing(parent)) choosing.add(parent.id)
    else if (item.kind === 'note') counts.notes += 1
    else counts.pending += 1
  }
  counts.pending += choosing.size
  return counts
}

/** Lo de dentro de una sublista, en los ítems de su lista. */
export function childrenOf(items: readonly Item[], sublistId: string): Item[] {
  return items.filter((item) => item.parentId === sublistId)
}

/** Lo que está suelto en la lista, fuera de cualquier sublista: lo que enseña su pantalla. */
export function topLevel(items: readonly Item[]): Item[] {
  return items.filter((item) => item.parentId === null)
}

/** Lo de dentro, contado por su cuenta (en la fila de la sublista cuenta aunque esté pausada). */
export function countChildren(children: readonly Item[], now: Date = new Date()): Counts {
  const done = children.filter((item) => isOutOfMind(item, now)).length
  const notes = children.filter((item) => item.kind === 'note').length
  return { pending: children.length - done - notes, done, notes }
}

/** Lo que miran la meta y el resumen de una sublista: su estado y si es «para elegir una». */
type SublistState = Pick<Item, 'status'> & Partial<Pick<Item, 'kind' | 'chooseOne' | 'chosenId'>>

const choiceOf = (sublist: SublistState) => ({
  kind: sublist.kind ?? 'sublist',
  status: sublist.status,
  chooseOne: sublist.chooseOne ?? false,
  chosenId: sublist.chosenId ?? null,
})

const plural = (count: number, one: string, other: string) =>
  `${count} ${count === 1 ? one : other}`

/**
 * La meta de la fila de una sublista (diseño 12, S1): «5 pendientes · En curso», «3 pendientes ·
 * Pausada», «7 cosas» si ya no queda nada pendiente, «Vacía» si no tiene nada y, hecha, «Hecha · 6
 * dentro». Pendiente no se dice: es lo normal.
 */
export function sublistMeta(sublist: SublistState, children: readonly Item[]): string {
  // «Para elegir una» (5.1, diseño 24): «2 opciones · desde 199 €» y, hecha, «Elegida Logitech G29».
  const chosen = chosenOption(choiceOf(sublist), children)
  if (chosen && sublist.status === 'done') return chosenLabel(chosen)
  const options = isChoosing(choiceOf(sublist)) ? optionsMeta(choiceOf(sublist), children) : null
  if (options)
    return sublist.status === 'pending' ? options : `${options} · ${STATUS_LABELS[sublist.status]}`
  const { pending } = countChildren(children)
  if (sublist.status === 'done') {
    return children.length > 0 ? `Hecha · ${children.length} dentro` : 'Hecha'
  }
  const content =
    pending > 0
      ? plural(pending, 'pendiente', 'pendientes')
      : children.length > 0
        ? plural(children.length, 'cosa', 'cosas')
        : 'Vacía'
  return sublist.status === 'pending' ? content : `${content} · ${STATUS_LABELS[sublist.status]}`
}

/**
 * El subtítulo de la pantalla de una sublista (diseño 12, S2 y S3): «5 pendientes · 2 hechas · En
 * curso», o «Sublista de Viajes» si aún está vacía.
 */
export function sublistSummary(
  sublist: SublistState,
  children: readonly Item[],
  listName: string,
): string {
  if (children.length === 0) return `Sublista de ${listName}`
  // «Para elegir una» (diseño 24, A2 y A4b): «2 opciones · desde 199 €», «Hecha · elegida G29».
  const chosen = chosenOption(choiceOf(sublist), children)
  if (chosen && sublist.status === 'done') return chosenSummary(chosen)
  const options = isChoosing(choiceOf(sublist)) ? optionsMeta(choiceOf(sublist), children) : null
  if (options)
    return sublist.status === 'pending' ? options : `${options} · ${STATUS_LABELS[sublist.status]}`
  const { pending, done } = countChildren(children)
  const parts = [plural(pending, 'pendiente', 'pendientes')]
  if (done > 0) parts.push(plural(done, 'hecha', 'hechas'))
  if (sublist.status !== 'pending') parts.push(STATUS_LABELS[sublist.status])
  return parts.join(' · ')
}

/** «· 3 sublistas» del subtítulo de la lista (S1): las que no están hechas. */
export function openSublistsLabel(items: readonly Item[]): string | null {
  const open = items.filter((item) => item.kind === 'sublist' && item.status !== 'done').length
  return open > 0 ? plural(open, 'sublista', 'sublistas') : null
}

/**
 * La confirmación de borrar una sublista con cosas dentro (diseño 12, S5): «Se borran también las
 * 7 cosas de dentro, 2 de ellas ya hechas. Tendrás cinco segundos para deshacer.».
 */
export function deleteSublistMessage(children: readonly Item[]): string {
  const { done } = countChildren(children)
  const total = children.length
  const inside = total === 1 ? 'la cosa de dentro' : `las ${total} cosas de dentro`
  const doneNote =
    done === 0
      ? ''
      : done === total
        ? ', ya hechas'
        : `, ${done} de ellas ya ${done === 1 ? 'hecha' : 'hechas'}`
  return `Se borra${total === 1 ? '' : 'n'} también ${inside}${doneNote}. Tendrás cinco segundos para deshacer.`
}

/** «Borrar sublista y 7 cosas». */
export function deleteSublistLabel(children: readonly Item[]): string {
  return `Borrar sublista y ${plural(children.length, 'cosa', 'cosas')}`
}

/** «Maleta (copia)», sin pasarse del límite del título. */
export function copyTitle(title: string): string {
  const suffix = ' (copia)'
  return title.slice(0, ITEM_TITLE_MAX_LENGTH - suffix.length) + suffix
}

/**
 * Duplica una sublista con lo de dentro (la maleta de cada viaje, diseño 12, S6): la copia va justo
 * debajo de la original, pendiente, y lo de dentro se copia en su orden, todo pendiente. `newId`
 * da los ids (en la app, `crypto.randomUUID`), así que la copia optimista es la que se guarda.
 * Una compra con varias tiendas se copia con todas (4.1), con ids nuevos y, como ya no está
 * comprada, con el precio de la más barata, como lo pondrá `item_links_sync`.
 */
export function duplicateSublist(
  sublist: Item,
  children: readonly Item[],
  { newId, position, now = new Date() }: { newId: () => string; position: number; now?: Date },
): Item[] {
  const fresh = (item: Item, overrides: Partial<Item>): Item => {
    const copy: Item = {
      ...item,
      id: newId(),
      status: initialStatus(item.kind),
      completedAt: null,
      createdAt: now,
      leftInboxId: null,
      leftInboxAt: null,
      links: [],
      // Las fotos van con ella, con ids nuevos; comparten archivo, y `orphan_photos` lo tiene en
      // cuenta (4.5).
      images: item.images.map((image) => ({ ...image, id: newId() })),
      priceLinkId: null,
      priceStore: null,
      ...overrides,
    }
    if (item.links.length === 0) return copy
    return withLinks(
      copy,
      item.links.map((link) => ({ ...link, id: newId() })),
      now,
    )
  }
  // «Para elegir una» se copia, sin la elección (5.1).
  const copy = fresh(sublist, {
    title: copyTitle(sublist.title),
    position,
    parentId: null,
    chosenId: null,
  })
  return [copy, ...children.map((child) => fresh(child, { parentId: copy.id }))]
}

/**
 * La posición de la copia: entre la original y la siguiente de la lista, para que salga justo
 * debajo. Las posiciones son enteras y van de 1000 en 1000: a la mitad hay sitio de sobra.
 */
export function positionAfter(items: readonly Item[], item: Pick<Item, 'position'>): number {
  const next = items
    .map((entry) => entry.position)
    .filter((position) => position > item.position)
    .reduce((min, position) => Math.min(min, position), Number.POSITIVE_INFINITY)
  if (!Number.isFinite(next)) return item.position + 1000
  return Math.max(item.position + 1, Math.floor((item.position + next) / 2))
}
