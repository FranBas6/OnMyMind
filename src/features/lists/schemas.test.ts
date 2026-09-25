import { afterEach, describe, expect, it, vi } from 'vitest'

import { mergeListsWithCounters } from './schemas'

const casa = {
  id: 'a',
  name: 'Casa',
  color: 'coral',
  icon: null,
  kind: 'tasks' as const,
  position: 2000,
}
const compras = {
  id: 'b',
  name: 'Compras',
  color: 'blue',
  icon: null,
  kind: 'shopping' as const,
  position: 3000,
}

describe('mergeListsWithCounters', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('une cada lista con sus contadores y conserva el orden de las filas', () => {
    const result = mergeListsWithCounters(
      [casa, compras],
      [
        { list_id: 'b', pending_count: 2, done_count: 1, pending_price_cents: 37800 },
        { list_id: 'a', pending_count: 4, done_count: 0, pending_price_cents: 0 },
      ],
    )
    expect(result.map((l) => l.id)).toEqual(['a', 'b'])
    expect(result[0]?.counters).toEqual({ pending: 4, done: 0, pendingPriceCents: 0 })
    expect(result[1]?.counters).toEqual({ pending: 2, done: 1, pendingPriceCents: 37800 })
  })

  it('una lista sin fila de contadores sale a cero', () => {
    const [only] = mergeListsWithCounters([casa], [])
    expect(only?.counters).toEqual({ pending: 0, done: 0, pendingPriceCents: 0 })
  })

  it('un color desconocido no rompe la pantalla: índigo y aviso en consola', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const [only] = mergeListsWithCounters([{ ...casa, color: 'morado' }], [])
    expect(only?.color).toBe('indigo')
    expect(warn).toHaveBeenCalledOnce()
  })
})
