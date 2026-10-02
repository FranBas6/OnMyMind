import { startOfDay } from 'date-fns'

import type { ListKind } from '@/features/lists'

import { translateStatus } from './move'
import { defaultItemKind, STATUS_LABELS } from './status'
import type { Item, ItemKind, ItemPatch } from './types'

/**
 * Los tipos que se eligen al añadir o desde la fila «Tipo» del detalle (diseño 12, T2 y T5).
 * `note` es lo de «En mente», que no se elige; la sublista llega a los selectores en la 2a.4.
 */
export const CHOOSABLE_KINDS = ['task', 'shopping', 'event'] as const
export type ChoosableKind = (typeof CHOOSABLE_KINDS)[number]

/** Lo que se puede añadir desde el campo de una lista: los tipos y, fuera de una sublista, otra. */
export type AddableKind = ChoosableKind | 'sublist'

export function isChoosableKind(kind: ItemKind): kind is ChoosableKind {
  return (CHOOSABLE_KINDS as readonly ItemKind[]).includes(kind)
}

/** Nombre del tipo de un ítem en la interfaz (en singular: el tipo es de cada ítem). */
export const KIND_LABELS: Record<ItemKind, string> = {
  note: 'Sin tipo',
  task: 'Tarea',
  shopping: 'Compra',
  event: 'Evento',
  sublist: 'Sublista',
}

/** Qué trae cada tipo, en una línea (diseño 12, T2 y T5). */
export const KIND_DESCRIPTIONS: Record<AddableKind, string> = {
  task: 'Prioridad, fecha y estado.',
  shopping: 'Precio, tienda y foto.',
  event: 'Fecha y hora.',
  sublist: 'Un grupo con sus propias cosas dentro.',
}

/** Los campos que usa cada tipo hoy. Lo que el tipo nuevo no usa se quita al cambiar. */
interface KindFields {
  priority: boolean
  dueAt: boolean
  recurrence: boolean
  price: boolean
}

const NONE: KindFields = { priority: false, dueAt: false, recurrence: false, price: false }

/** La foto y el enlace (2a.6) los usan todos, así que no se pierden nunca. */
const KIND_FIELDS: Record<ItemKind, KindFields> = {
  note: NONE,
  task: { ...NONE, priority: true, dueAt: true },
  // Solo las compras tienen precio (plan 02-fase-2, decisión 5).
  shopping: { ...NONE, price: true },
  event: { ...NONE, dueAt: true, recurrence: true },
  sublist: NONE,
}

/** Lo que se pierde al cambiar el tipo: lo que el ítem tiene y el tipo nuevo no usa. */
export type KindChangeLoss = KindFields

type KindChangeFields = Pick<Item, 'status' | 'priority' | 'dueAt' | 'recurrence' | 'priceCents'>

export function kindChangeLoss(
  item: Omit<KindChangeFields, 'status'>,
  to: ItemKind,
): KindChangeLoss {
  const uses = KIND_FIELDS[to]
  return {
    priority: item.priority !== null && !uses.priority,
    dueAt: item.dueAt !== null && !uses.dueAt,
    recurrence: item.recurrence !== null && !uses.recurrence,
    price: item.priceCents !== null && !uses.price,
  }
}

/**
 * Cambia el tipo de un ítem desde su detalle (plan 02a, decisión 4). El estado se traduce con la
 * misma regla que al mover (`translateStatus`) y lo que el tipo nuevo no usa se quita; lo demás se
 * queda como estaba: una tarea con fecha pasa a ser un evento ese mismo día.
 */
export function changeKindPatch(item: KindChangeFields, to: ItemKind): ItemPatch {
  const loss = kindChangeLoss(item, to)
  const patch: ItemPatch = { kind: to, status: translateStatus(item.status, to) }
  if (loss.priority) patch.priority = null
  if (loss.dueAt) patch.dueAt = null
  // Un evento que pasa a tarea se queda con su día como fecha límite, sin hora (2.4).
  else if (to === 'task' && item.dueAt) patch.dueAt = startOfDay(item.dueAt)
  if (loss.recurrence) patch.recurrence = null
  // El histórico se queda en la base: si vuelve a ser compra, vuelve con él.
  if (loss.price) {
    patch.priceCents = null
    patch.priceSource = null
  }
  return patch
}

const LOSS_NOUNS: [keyof KindChangeLoss, string][] = [
  ['priority', 'la prioridad'],
  ['dueAt', 'la fecha'],
  ['recurrence', 'la repetición'],
  ['price', 'el precio'],
]

/** «la prioridad», «la prioridad y la fecha», «la prioridad, la fecha y la repetición». */
function joinNouns(nouns: string[]): string {
  if (nouns.length <= 1) return nouns.join('')
  return `${nouns.slice(0, -1).join(', ')} y ${nouns.at(-1) ?? ''}`
}

/**
 * El aviso antes de confirmar (diseño 12, T5): «Al pasar a Compra se quita la prioridad.
 * Pendiente sigue siendo Pendiente.». Si no se pierde nada, lo dice, y el estado va siempre, siga
 * igual o cambie («En curso pasa a Pendiente.»).
 */
export function kindChangeNotice(
  item: KindChangeFields,
  to: ItemKind,
): { text: string; losesSomething: boolean } {
  const loss = kindChangeLoss(item, to)
  const nouns = LOSS_NOUNS.filter(([field]) => loss[field]).map(([, noun]) => noun)
  const verb = nouns.length > 1 ? 'se quitan' : 'se quita'
  const lost =
    nouns.length > 0
      ? `Al pasar a ${KIND_LABELS[to]} ${verb} ${joinNouns(nouns)}.`
      : `Al pasar a ${KIND_LABELS[to]} no se pierde nada.`
  const from = STATUS_LABELS[item.status]
  const next = translateStatus(item.status, to)
  const status =
    next === item.status
      ? `${from} sigue siendo ${from}.`
      : `${from} pasa a ${STATUS_LABELS[next]}.`
  return { text: `${lost} ${status}`, losesSomething: nouns.length > 0 }
}

/**
 * La marca del tipo en una fila que no tiene otra cosa que enseñar debajo del título (diseño 12,
 * T1): «Compra» en «Trabajo». Solo sale si el ítem no es del tipo por defecto de su lista: en una
 * lista de un solo tipo, nada nuevo.
 */
export function kindMark(kind: ItemKind, listKind: ListKind): string | null {
  if (!isChoosableKind(kind) || kind === defaultItemKind(listKind)) return null
  return KIND_LABELS[kind]
}

/** Prefijos rápidos del campo de añadir en escritorio (diseño 12, D2). */
const KIND_PREFIXES: [prefix: string, kind: AddableKind][] = [
  ['> ', 'shopping'],
  ['@ ', 'event'],
  ['/ ', 'sublist'],
]

/**
 * Lee un prefijo rápido al principio del texto: «> cable HDMI» es una compra, «@ dentista», un
 * evento, y «/ Lisboa», una sublista. Devuelve el tipo y el título sin el prefijo, o `null` si no lleva ninguno.
 */
export function parseKindPrefix(text: string): { kind: AddableKind; title: string } | null {
  const start = text.trimStart()
  for (const [prefix, kind] of KIND_PREFIXES) {
    if (start.startsWith(prefix)) return { kind, title: start.slice(prefix.length) }
  }
  return null
}

/** «para una tarea», «para una compra», «para un evento»: la pista del selector de escritorio. */
export const KIND_ARTICLE_NOUN: Record<ChoosableKind, string> = {
  task: 'una tarea',
  shopping: 'una compra',
  event: 'un evento',
}
