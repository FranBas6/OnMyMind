import { describe, expect, it } from 'vitest'

import { expiresLabel, invitedListSummary, inviteMessage, personDetail, personName } from './copy'

const NOW = new Date(2026, 9, 6, 12)

describe('textos de compartir (diseño 20)', () => {
  it('el mensaje del enlace y el nombre de quien no lo tiene', () => {
    expect(inviteMessage('Fran', 'Compras')).toBe('Fran te invita a «Compras» en OnMyMind')
    expect(personName('  ')).toBe('Alguien')
    expect(personName(null)).toBe('Alguien')
  })

  it('cuándo caduca, con el año solo si es otro', () => {
    expect(expiresLabel(new Date(2026, 9, 13), NOW)).toBe('Caduca el martes 13 oct')
    expect(expiresLabel(new Date(2027, 0, 2), NOW)).toBe('Caduca el sábado 2 ene 2027')
  })

  it('lo que va bajo cada persona', () => {
    const owner = { isOwner: true, joinedAt: null }
    const marta = { isOwner: false, joinedAt: new Date(2026, 9, 3) }
    expect(personDetail(owner, true, NOW)).toBe('Tú · Creó la lista')
    expect(personDetail(owner, false, NOW)).toBe('Creó la lista')
    expect(personDetail(marta, false, NOW)).toBe('Entró el 3 oct')
    expect(personDetail(marta, true, NOW)).toBe('Tú · entraste el 3 oct')
  })

  it('la lista a la que te invitan', () => {
    expect(invitedListSummary('shopping', 7)).toBe('Una lista de compras con 7 cosas.')
    expect(invitedListSummary('tasks', 1)).toBe('Una lista de tareas con 1 cosa.')
    expect(invitedListSummary('events', 0)).toBe('Una lista de eventos, aún vacía.')
    expect(invitedListSummary(null, 2)).toBe('Una lista con 2 cosas.')
  })
})
