import { describe, expect, it } from 'vitest'

import { rowActions } from './rowActions'

const labels = (...args: Parameters<typeof rowActions>) =>
  rowActions(...args).map((action) => action.label)

describe('rowActions', () => {
  it('una tarea pendiente se puede poner en curso o terminar', () => {
    expect(labels('tasks', 'pending')).toEqual(['Marcar en curso', 'Hecha', 'Mover a…', 'Borrar'])
  })

  it('en curso, la primera vuelve a pendiente (diseño 06, T9)', () => {
    expect(labels('tasks', 'in_progress')).toEqual([
      'Marcar pendiente',
      'Hecha',
      'Mover a…',
      'Borrar',
    ])
  })

  it('una hecha solo se reabre', () => {
    expect(labels('tasks', 'done')).toEqual(['Marcar pendiente', 'Mover a…', 'Borrar'])
  })

  it('en otros tipos no hay «en curso»', () => {
    expect(labels('inbox', 'pending')).toEqual(['Hecha', 'Mover a…', 'Borrar'])
    expect(labels('shopping', 'discarded')).toEqual(['Marcar pendiente', 'Mover a…', 'Borrar'])
    expect(labels('events', 'upcoming')).toEqual(['Cancelado', 'Mover a…', 'Borrar'])
  })

  it('cada acción de estado lleva a un estado válido del tipo', () => {
    expect(rowActions('shopping', 'pending')[0]).toMatchObject({ status: 'bought' })
    expect(rowActions('tasks', 'pending')[0]).toMatchObject({ status: 'in_progress' })
  })
})
