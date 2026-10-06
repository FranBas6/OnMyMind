import { format, isSameYear } from 'date-fns'

import type { ListKind } from '@/features/lists/types'

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
