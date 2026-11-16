import { describe, expect, it } from 'vitest'

import { filterListsByName } from './filterLists'

const lists = [
  { name: 'Casa' },
  { name: 'Viaje a Lisboa' },
  { name: 'Cumpleaños' },
  { name: 'Compras' },
]

describe('filterListsByName', () => {
  it('sin nada escrito, todas', () => {
    expect(filterListsByName(lists, '  ')).toEqual(lists)
  })

  it('por una parte del nombre, sin tildes ni mayúsculas', () => {
    expect(filterListsByName(lists, 'CUMPLEANOS').map((list) => list.name)).toEqual(['Cumpleaños'])
    expect(filterListsByName(lists, 'lisbóa').map((list) => list.name)).toEqual(['Viaje a Lisboa'])
    expect(filterListsByName(lists, 'c').map((list) => list.name)).toEqual([
      'Casa',
      'Cumpleaños',
      'Compras',
    ])
  })
})
