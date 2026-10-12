import { startOfDay } from 'date-fns'

import type { KindTotals, List } from '@/features/lists'
import { formatDueDate } from '@/lib/date'

import { PRIORITY_LABELS } from './fields'
import { translateStatus } from './move'
import { isFinalStatus, STATUS_LABELS } from './status'
import type { Item, ItemKind, ItemPatch } from './types'

/**
 * Los tipos que se eligen al añadir o desde la fila «Tipo» del detalle (diseño 12, T2 y T5). Desde
 * la 5.4 (diseño 25, B5c) la nota es uno más, y el primero: es la cosa básica. La sublista se
 * añade aparte, al final del selector.
 */
export const CHOOSABLE_KINDS = ['note', 'task', 'shopping', 'event'] as const
export type ChoosableKind = (typeof CHOOSABLE_KINDS)[number]

/** Lo que se puede añadir desde el campo de una lista: los tipos y, fuera de una sublista, otra. */
export type AddableKind = ChoosableKind | 'sublist'

export function isChoosableKind(kind: ItemKind): kind is ChoosableKind {
  return (CHOOSABLE_KINDS as readonly ItemKind[]).includes(kind)
}

/** Nombre del tipo de un ítem en la interfaz (en singular: el tipo es de cada ítem). */
export const KIND_LABELS: Record<ItemKind, string> = {
  note: 'Nota',
  task: 'Tarea',
  shopping: 'Compra',
  event: 'Evento',
  sublist: 'Sublista',
}

/** Qué trae cada tipo, en una línea (diseño 25, B5c; la sublista, del 12). */
export const KIND_DESCRIPTIONS: Record<AddableKind, string> = {
  note: 'Texto, fotos y enlaces',
  task: 'Casilla, prioridad, fecha y aviso',
  shopping: 'Precio y tiendas',
  event: 'Día y hora',
  sublist: 'Un grupo con sus propias cosas dentro',
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
  // Desde la 3.6 las tareas también se repiten.
  task: { ...NONE, priority: true, dueAt: true, recurrence: true },
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

/**
 * Lo contrario de `changeKindPatch`, para «Deshacer» (diseño 25, B6b: «Ahora es una tarea ·
 * Deshacer»): vuelven el tipo, el estado y lo que se quitó.
 */
export function revertKindChange(
  item: KindChangeFields & Pick<Item, 'kind' | 'allDay' | 'priceSource'>,
  patch: ItemPatch,
): ItemPatch {
  return {
    kind: item.kind,
    status: item.status,
    ...('priority' in patch && { priority: item.priority }),
    ...('dueAt' in patch && { dueAt: item.dueAt, allDay: item.allDay }),
    ...('recurrence' in patch && { recurrence: item.recurrence }),
    ...('priceCents' in patch && { priceCents: item.priceCents, priceSource: item.priceSource }),
  }
}

/** «Ahora es una tarea», «Ahora es un evento»: el aviso tras cambiar el tipo (B6b). */
export function kindChangedMessage(kind: ItemKind): string {
  const noun = kind === 'event' ? 'un evento' : `una ${KIND_LABELS[kind].toLowerCase()}`
  return `Ahora es ${noun}`
}

/** Lo que tiene el ítem para decir qué se pierde: también su título y si tiene aviso. */
type NoticeFields = KindChangeFields & Pick<Item, 'kind' | 'title' | 'notes'>

/** «la prioridad Alta», «la fecha (hoy)», «el aviso»: lo que se quita, con lo que vale. */
function lostNouns(
  item: NoticeFields,
  to: ItemKind,
  { reminder = false, now = new Date() }: { reminder?: boolean; now?: Date },
): string[] {
  const loss = kindChangeLoss(item, to)
  const nouns: string[] = []
  if (loss.priority && item.priority) nouns.push(`la prioridad ${PRIORITY_LABELS[item.priority]}`)
  if (loss.dueAt && item.dueAt) {
    nouns.push(`la fecha (${formatDueDate(item.dueAt, now).text.toLowerCase()})`)
  }
  if (loss.recurrence) nouns.push('la repetición')
  if (loss.price) nouns.push('el precio')
  // El aviso es de tareas y eventos: la base lo borra al pasar a otra cosa.
  if (reminder && to !== 'task' && to !== 'event') nouns.push('el aviso')
  return nouns
}

/** «la prioridad», «la prioridad y la fecha», «la prioridad, la fecha y la repetición». */
function joinNouns(nouns: string[]): string {
  if (nouns.length <= 1) return nouns.join('')
  return `${nouns.slice(0, -1).join(', ')} y ${nouns.at(-1) ?? ''}`
}

/** El aviso antes de cambiar el tipo: lo que pasa con el texto, lo que se pierde y el estado. */
export interface KindChangeNotice {
  /** Lo que pasa con el título y las notas, al pasar de nota o a nota. */
  lead: string | null
  /** «Se quitan la prioridad Alta y la fecha (hoy).»: va en negrita (diseño 25, B6c). */
  lost: string | null
  /** El estado, o lo que gana. */
  rest: string
  /** Todo junto, para leerlo de una vez. */
  text: string
  losesSomething: boolean
}

/**
 * El aviso de la hoja «Tipo» (diseño 25, B6 y B6c; antes, diseño 12, T5):
 *   · de nota a tarea: «"Vuelo a Lisboa" será el título y el resto, sus notas. No se pierde nada:
 *     gana casilla y contará como pendiente.»;
 *   · de tarea a nota: «El título será la primera línea y sus notas, el resto. Se quitan la
 *     prioridad Alta, la fecha (hoy) y el aviso. Dejará de contar como pendiente.»;
 *   · entre los demás: «Se quita la prioridad Alta. Pendiente sigue siendo Pendiente.».
 * `reminder`: si el ítem tiene aviso (vive aparte, en `reminders`).
 */
export function kindChangeNotice(
  item: NoticeFields,
  to: ItemKind,
  options: { reminder?: boolean; now?: Date } = {},
): KindChangeNotice {
  const nouns = lostNouns(item, to, options)
  const lost =
    nouns.length > 0 ? `${nouns.length > 1 ? 'Se quitan' : 'Se quita'} ${joinNouns(nouns)}.` : null
  let lead: string | null = null
  let rest: string
  if (item.kind === 'note') {
    lead = item.notes
      ? `«${item.title}» será el título y el resto, sus notas.`
      : `«${item.title}» será el título.`
    rest =
      to === 'event'
        ? 'No se pierde nada: gana día y hora y contará como próximo.'
        : 'No se pierde nada: gana casilla y contará como pendiente.'
  } else if (to === 'note') {
    lead = 'El título será la primera línea y sus notas, el resto.'
    rest = isFinalStatus(item.status)
      ? 'Las notas no tienen estado: sale de «Fuera de la cabeza».'
      : 'Dejará de contar como pendiente.'
  } else {
    const from = STATUS_LABELS[item.status]
    const next = translateStatus(item.status, to)
    const status =
      next === item.status
        ? `${from} sigue siendo ${from}.`
        : `${from} pasa a ${STATUS_LABELS[next]}.`
    rest = lost ? status : `No se pierde nada. ${status}`
  }
  return {
    lead,
    lost,
    rest,
    text: [lead, lost, rest].filter(Boolean).join(' '),
    losesSomething: lost !== null,
  }
}

/** Cuántas cosas hay de cada tipo (las sublistas no cuentan), como `list_counters` (5.3). */
export function kindTotals(items: readonly Pick<Item, 'kind'>[]): KindTotals {
  const totals: KindTotals = { note: 0, task: 0, shopping: 0, event: 0 }
  for (const item of items) if (item.kind !== 'sublist') totals[item.kind] += 1
  return totals
}

/** A igualdad, el que va antes. Las notas no compiten: son lo de por defecto. */
const PROPOSED_ORDER = ['task', 'shopping', 'event'] as const

/** Por qué una lista propone lo que propone: lo dice el selector de tipo (diseño 25, B5c y D3). */
export type ProposalReason = 'inbox' | 'empty' | 'most'

/**
 * El tipo con el que nace lo que se añade a una lista (ADR-012) y por qué: las listas no tienen
 * tipo, así que es el que más hay de tareas, compras y eventos (una lista de la compra propone
 * compras; «Viajes», con tres notas y dos tareas, tarea: diseño 25, D1). Con `items` cuenta esos (lo
 * que se ve, también lo optimista); sin ellos, lo que dice `list_counters`. «En mente» propone
 * siempre nota. Sin nada de eso (vacía o con solo notas), Nota (5.4, diseño 25, B5), o Evento si se
 * ve como agenda.
 */
export function kindProposal(
  list: Pick<List, 'kind' | 'view' | 'counters'>,
  items?: readonly Pick<Item, 'kind'>[],
): { kind: ChoosableKind; reason: ProposalReason } {
  if (list.kind === 'inbox') return { kind: 'note', reason: 'inbox' }
  const totals = items ? kindTotals(items) : list.counters.kinds
  let best: ChoosableKind | null = null
  let most = 0
  for (const kind of PROPOSED_ORDER) {
    if (totals[kind] > most) {
      best = kind
      most = totals[kind]
    }
  }
  if (best) return { kind: best, reason: 'most' }
  return { kind: list.view === 'agenda' ? 'event' : 'note', reason: 'empty' }
}

/** El tipo que propone una lista (`kindProposal`), sin el porqué. */
export function proposedKind(
  list: Pick<List, 'kind' | 'view' | 'counters'>,
  items?: readonly Pick<Item, 'kind'>[],
): ChoosableKind {
  return kindProposal(list, items).kind
}

/**
 * Por qué propone eso, al pie del selector (diseño 25, B5c y D3): «Esta lista propone Compra porque
 * es lo que más tiene.». Vacía o en «En mente», lo dice así.
 */
export function proposalHint({
  kind,
  reason,
}: {
  kind: ChoosableKind
  reason: ProposalReason
}): string {
  if (reason === 'inbox') return 'En «En mente» todo empieza como nota.'
  if (reason === 'empty') {
    return kind === 'event'
      ? 'Una agenda vacía propone Evento.'
      : `Una lista vacía propone ${KIND_LABELS[kind]}.`
  }
  return `Esta lista propone ${KIND_LABELS[kind]} porque es lo que más tiene.`
}

/**
 * La marca del tipo en una fila que no tiene otra cosa que enseñar debajo del título (diseño 12,
 * T1): «Compra» en «Trabajo». Solo sale si el ítem no es del tipo que propone su lista: en una
 * lista de un solo tipo, nada nuevo.
 */
export function kindMark(kind: ItemKind, proposed: ItemKind): string | null {
  // La nota tiene su propia fila, con su hoja: no necesita marca.
  if (!isChoosableKind(kind) || kind === 'note' || kind === proposed) return null
  return KIND_LABELS[kind]
}

/** Prefijos rápidos del campo de añadir en escritorio (diseño 12, D2; «[ ] », diseño 25, D3). */
const KIND_PREFIXES: [prefix: string, kind: AddableKind][] = [
  ['[ ] ', 'task'],
  ['> ', 'shopping'],
  ['@ ', 'event'],
  ['/ ', 'sublist'],
]

/**
 * Lee un prefijo rápido al principio del texto: «[ ] llamar» es una tarea, «> cable HDMI», una
 * compra, «@ dentista», un evento, y «/ Lisboa», una sublista. La nota no tiene. Devuelve el tipo y
 * el título sin el prefijo, o `null` si no lleva ninguno.
 */
export function parseKindPrefix(text: string): { kind: AddableKind; title: string } | null {
  const start = text.trimStart()
  for (const [prefix, kind] of KIND_PREFIXES) {
    if (start.startsWith(prefix)) return { kind, title: start.slice(prefix.length) }
  }
  return null
}

/** El prefijo de cada tipo, a la derecha en el selector de escritorio (diseño 25, D3). */
export const KIND_PREFIX_LABELS: Record<AddableKind, string> = {
  note: 'sin prefijo',
  task: '«[ ] »',
  shopping: '«> »',
  event: '«@ »',
  sublist: '«/ »',
}
