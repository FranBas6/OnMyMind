import { describe, expect, it } from 'vitest'

import { canStep, dropNeighbors, reorder, stepNeighbors, withPositions } from './reorder'

const list = (...positions: number[]) =>
  positions.map((position, index) => ({ id: String.fromCharCode(97 + index), position }))

describe('dónde cae lo que se suelta (2.9)', () => {
  it('ocupa el sitio de aquello sobre lo que se suelta, como arrayMove', () => {
    const ids = ['a', 'b', 'c', 'd']
    expect(dropNeighbors(ids, 'a', 'c')).toEqual({ prevId: 'c', nextId: 'd' })
    expect(dropNeighbors(ids, 'd', 'b')).toEqual({ prevId: 'a', nextId: 'b' })
    expect(dropNeighbors(ids, 'c', 'a')).toEqual({ prevId: null, nextId: 'a' })
    expect(dropNeighbors(ids, 'a', 'd')).toEqual({ prevId: 'd', nextId: null })
    expect(dropNeighbors(ids, 'b', 'b')).toBeNull()
  })

  it('entre dos, el punto medio: se guarda una sola fila', () => {
    const order = list(1000, 2000, 3000, 4000)
    expect(reorder(order, 'd', { prevId: 'a', nextId: 'b' })).toEqual([{ id: 'd', position: 1500 }])
    expect(reorder(order, 'a', { prevId: 'd', nextId: null })).toEqual([
      { id: 'a', position: 5000 },
    ])
    expect(reorder(order, 'c', { prevId: null, nextId: 'a' })).toEqual([{ id: 'c', position: 0 }])
  })

  it('si no cabe un entero entre los dos, renumera todos y devuelve solo lo que cambia', () => {
    const order = list(1000, 1001, 3000)
    expect(reorder(order, 'c', { prevId: 'a', nextId: 'b' })).toEqual([
      { id: 'c', position: 2000 },
      { id: 'b', position: 3000 },
    ])
  })

  it('posiciones repetidas (de antes de poder ordenar) también se resuelven', () => {
    const order = list(1000, 1000, 1000)
    expect(reorder(order, 'c', { prevId: 'a', nextId: 'b' })).toEqual([
      { id: 'c', position: 2000 },
      { id: 'b', position: 3000 },
    ])
  })

  it('lo escondido por un filtro conserva su sitio (diseño 14, R9)', () => {
    // b está hecha y no se ve: se sube d por encima de c, que es lo que se ve.
    const order = list(1000, 2000, 3000, 4000)
    const visible = ['a', 'c', 'd']
    const neighbors = dropNeighbors(visible, 'd', 'c')
    expect(neighbors).toEqual({ prevId: 'a', nextId: 'c' })
    // Justo tras a: entre a (1000) y b (2000), que sigue donde estaba.
    expect(reorder(order, 'd', neighbors ?? { prevId: null, nextId: null })).toEqual([
      { id: 'd', position: 1500 },
    ])
  })

  it('al pasar a «A mi manera», fija el orden que se ve', () => {
    // En «más reciente primero» se ve c, b, a; se sube a por encima de b.
    const shown = [
      { id: 'c', position: 3000 },
      { id: 'b', position: 2000 },
      { id: 'a', position: 1000 },
    ]
    expect(reorder(shown, 'a', { prevId: 'c', nextId: 'b' }, { renumber: true })).toEqual([
      { id: 'c', position: 1000 },
      { id: 'a', position: 2000 },
      { id: 'b', position: 3000 },
    ])
  })

  it('subir y bajar uno, y no pasar de los extremos', () => {
    const ids = ['a', 'b', 'c']
    expect(stepNeighbors(ids, 'b', 'up')).toEqual({ prevId: null, nextId: 'a' })
    expect(stepNeighbors(ids, 'b', 'down')).toEqual({ prevId: 'c', nextId: null })
    expect(stepNeighbors(ids, 'a', 'up')).toBeNull()
    expect(canStep(ids, 'a', 'up')).toBe(false)
    expect(canStep(ids, 'a', 'down')).toBe(true)
    expect(canStep(ids, 'c', 'down')).toBe(false)
  })

  it('aplica las posiciones nuevas sin tocar lo demás', () => {
    const entries = [
      { id: 'a', position: 1000, title: 'A' },
      { id: 'b', position: 2000, title: 'B' },
    ]
    expect(withPositions(entries, [{ id: 'b', position: 500 }])).toEqual([
      { id: 'a', position: 1000, title: 'A' },
      { id: 'b', position: 500, title: 'B' },
    ])
  })
})
