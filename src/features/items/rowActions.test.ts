import { describe, expect, it } from 'vitest'

import { rowActions } from './rowActions'

const labels = (...args: Parameters<typeof rowActions>) =>
  rowActions(...args).map((action) => action.label)

describe('rowActions', () => {
  it('una tarea pendiente se puede poner en curso o terminar', () => {
    expect(labels('task', 'pending')).toEqual(['Marcar en curso', 'Hecha', 'Mover a…', 'Borrar'])
  })

  it('en curso, la primera vuelve a pendiente (diseño 06, T9)', () => {
    expect(labels('task', 'in_progress')).toEqual([
      'Marcar pendiente',
      'Hecha',
      'Mover a…',
      'Borrar',
    ])
  })

  it('una hecha solo se reabre', () => {
    expect(labels('task', 'done')).toEqual(['Marcar pendiente', 'Mover a…', 'Borrar'])
  })

  it('en otros tipos no hay «en curso»', () => {
    expect(labels('note', 'pending')).toEqual(['Hecha', 'Mover a…', 'Borrar'])
    expect(labels('shopping', 'discarded')).toEqual(['Marcar pendiente', 'Mover a…', 'Borrar'])
    expect(labels('event', 'upcoming')).toEqual(['Cancelado', 'Mover a…', 'Borrar'])
  })

  it('cada acción de estado lleva a un estado válido del tipo', () => {
    expect(rowActions('shopping', 'pending')[0]).toMatchObject({ status: 'bought' })
    expect(rowActions('task', 'pending')[0]).toMatchObject({ status: 'in_progress' })
  })
})

describe('acciones de una sublista (diseño 12, S4)', () => {
  it('en curso: pendiente, pausar y hecha; luego edición y borrar', () => {
    expect(labels('sublist', 'in_progress')).toEqual([
      'Marcar pendiente',
      'Pausar',
      'Hecha',
      'Renombrar',
      'Duplicar',
      'Mover a…',
      'Borrar',
    ])
    expect(rowActions('sublist', 'in_progress').find((a) => a.id === 'rename')?.separated).toBe(
      true,
    )
  })

  it('pausada se reanuda en curso; hecha solo se reabre', () => {
    expect(rowActions('sublist', 'paused').slice(0, 2)).toMatchObject([
      { label: 'Reanudar', status: 'in_progress' },
      { label: 'Hecha', status: 'done' },
    ])
    expect(labels('sublist', 'done').slice(0, 2)).toEqual(['Marcar pendiente', 'Renombrar'])
  })

  it('pendiente se pone en curso, como una tarea', () => {
    expect(labels('sublist', 'pending').slice(0, 3)).toEqual(['Marcar en curso', 'Pausar', 'Hecha'])
  })
})
