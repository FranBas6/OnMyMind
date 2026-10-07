import { describe, expect, it } from 'vitest'

import {
  completedNote,
  expiresLabel,
  invitedListSummary,
  inviteMessage,
  personDetail,
  personName,
} from './copy'

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

describe('con quién (diseño 20, M2)', () => {
  it('nombra a los demás', async () => {
    const { withPeople } = await import('./copy')
    expect(withPeople([{ displayName: 'Marta' }])).toBe('con Marta')
    expect(withPeople([{ displayName: 'Marta' }, { displayName: 'Luis' }])).toBe('con Marta y Luis')
    expect(
      withPeople([{ displayName: 'Ana' }, { displayName: 'Luis' }, { displayName: null }]),
    ).toBe('con Ana, Luis y Alguien')
    expect(withPeople([])).toBe('')
  })
})

describe('una lista que ya no tienes (diseño 20, M9 y M10)', () => {
  it('dice qué pasó y quién', async () => {
    const { goneCopy } = await import('./copy')
    expect(goneCopy({ reason: 'removed', listName: 'Compras', ownerName: 'Fran' })).toEqual({
      title: 'Ya no estás en «Compras»',
      text: 'Fran te ha quitado de la lista. Lo que añadiste se queda en ella.',
    })
    expect(goneCopy({ reason: 'deleted', listName: 'Compras', ownerName: 'Fran' }).title).toBe(
      'Fran ha borrado «Compras»',
    )
    expect(goneCopy({ reason: 'archived', listName: 'Compras', ownerName: null }).title).toBe(
      'Alguien ha archivado «Compras»',
    )
  })
})

describe('lo que termina el otro en directo (diseño 20, M8)', () => {
  it('dice quién y qué, con el verbo de cada cosa', () => {
    expect(completedNote('Fran', 'bought')).toBe('Fran lo ha comprado')
    expect(completedNote('Marta', 'done')).toBe('Marta lo ha hecho')
    expect(completedNote(null, 'discarded')).toBe('Alguien lo ha descartado')
    expect(completedNote('Ana', 'cancelled')).toBe('Ana lo ha cancelado')
  })
})
