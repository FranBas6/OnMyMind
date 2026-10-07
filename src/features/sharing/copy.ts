import { format, isSameYear } from 'date-fns'

import type { ItemStatus } from '@/features/items/status'
import type { ListKind } from '@/features/lists/types'

import type { Departure } from './schemas'

/** El nombre de alguien en los textos; sin nombre en su perfil, «Alguien». */
export function personName(displayName: string | null | undefined): string {
  const name = displayName?.trim() ?? ''
  return name === '' ? 'Alguien' : name
}

/** El texto que acompaña al enlace en la hoja del sistema (diseño 20, S3). */
export function inviteMessage(inviter: string, listName: string): string {
  return `${inviter} te invita a «${listName}» en OnMyMind`
}

/** «Caduca el lunes 13 oct» (S4). */
export function expiresLabel(date: Date, now: Date = new Date()): string {
  return `Caduca el ${format(date, isSameYear(date, now) ? 'EEEE d MMM' : 'EEEE d MMM yyyy')}`
}

/** El día en que alguien entró: «3 oct». */
export function joinedDay(date: Date, now: Date = new Date()): string {
  return format(date, isSameYear(date, now) ? 'd MMM' : 'd MMM yyyy')
}

/**
 * Lo que va bajo el nombre de cada uno en «Quién está» (S2, S7, M4): «Tú · Creó la lista»,
 * «Creó la lista», «Entró el 3 oct» o «Tú · entraste el 3 oct».
 */
export function personDetail(
  person: { isOwner: boolean; joinedAt: Date | null },
  isMe: boolean,
  now: Date = new Date(),
): string {
  if (person.isOwner) return isMe ? 'Tú · Creó la lista' : 'Creó la lista'
  const day = person.joinedAt ? joinedDay(person.joinedAt, now) : null
  if (isMe) return day ? `Tú · entraste el ${day}` : 'Tú'
  return day ? `Entró el ${day}` : 'Entró hace poco'
}

const KIND_NAMES: Partial<Record<ListKind, string>> = {
  tasks: 'de tareas',
  shopping: 'de compras',
  events: 'de eventos',
}

/** «Una lista de compras con 7 cosas.» en la invitación (J2). */
export function invitedListSummary(kind: ListKind | null, pending: number): string {
  const kindName = kind ? KIND_NAMES[kind] : undefined
  const list = kindName ? `Una lista ${kindName}` : 'Una lista'
  if (pending === 0) return `${list}, aún vacía.`
  return `${list} con ${String(pending)} ${pending === 1 ? 'cosa' : 'cosas'}.`
}

/** «Marta», «Marta y Luis», «Ana, Luis y Marta». */
export function namesOf(people: readonly { displayName: string | null }[]): string {
  const names = people.map((person) => personName(person.displayName))
  const last = names.at(-1) ?? ''
  const rest = names.slice(0, -1)
  return rest.length > 0 ? `${rest.join(', ')} y ${last}` : last
}

/** «con Marta», «con Marta y Luis», «con Ana, Luis y Marta» (diseño 20, M2 y M6). */
export function withPeople(people: readonly { displayName: string | null }[]): string {
  return people.length === 0 ? '' : `con ${namesOf(people)}`
}

/**
 * Qué pasa con una lista compartida si borras tu cuenta (diseño 20, P1): la tuya se borra para
 * los demás; de la de otro, sales y lo tuyo se queda.
 */
export function deletionNote(
  listName: string,
  isOwner: boolean,
  others: readonly { displayName: string | null }[],
): string {
  return isOwner
    ? `«${listName}» se borrará también para ${namesOf(others)}.`
    : `Saldrás de «${listName}». Lo que añadiste se queda.`
}

/** Los textos de M9 y M10 (el archivado no está dibujado: el mismo patrón, nivel 1). */
export function goneCopy({ reason, listName, ownerName }: Departure): {
  title: string
  text: string
} {
  const owner = personName(ownerName)
  switch (reason) {
    case 'removed':
      return {
        title: `Ya no estás en «${listName}»`,
        text: `${owner} te ha quitado de la lista. Lo que añadiste se queda en ella.`,
      }
    case 'deleted':
      return { title: `${owner} ha borrado «${listName}»`, text: 'La lista ya no existe.' }
    case 'archived':
      return {
        title: `${owner} ha archivado «${listName}»`,
        text: 'Ya no la tienes entre tus listas. Si la desarchiva, volverá.',
      }
  }
}

const DONE_VERBS: Partial<Record<ItemStatus, string>> = {
  bought: 'lo ha comprado',
  done: 'lo ha hecho',
  discarded: 'lo ha descartado',
  cancelled: 'lo ha cancelado',
}

/**
 * Lo que dice la fila que otro acaba de terminar en directo (diseño 20, M8): «Fran lo ha
 * comprado». El diseño solo dibuja la compra; las demás, con su verbo. *(Nivel 1)*
 */
export function completedNote(displayName: string | null, status: ItemStatus): string {
  return `${personName(displayName)} ${DONE_VERBS[status] ?? 'lo ha terminado'}`
}
