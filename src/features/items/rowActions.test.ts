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
    // La nota no se marca hecha (5.3).
    expect(labels('note', 'pending')).toEqual(['Mover a…', 'Borrar'])
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
      'Elegir una',
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
    expect(labels('sublist', 'done').slice(0, 3)).toEqual([
      'Marcar pendiente',
      'Elegir una',
      'Renombrar',
    ])
  })

  it('pendiente se pone en curso, como una tarea', () => {
    expect(labels('sublist', 'pending').slice(0, 3)).toEqual(['Marcar en curso', 'Pausar', 'Hecha'])
  })
})

describe('elegir una (5.1, diseño 24)', () => {
  const option = { note: 'Pasa a contar en el total.', chosen: false }

  it('la sublista se pone «para elegir una» y se quita (A1)', () => {
    expect(rowActions('sublist', 'pending').find((a) => a.id === 'chooseOne')).toMatchObject({
      label: 'Elegir una',
      hint: 'cuenta la más barata',
    })
    expect(
      rowActions('sublist', 'pending', { chooseOne: true }).find((a) => a.id === 'chooseOne'),
    ).toMatchObject({ label: 'Dejar de elegir una', hint: 'vuelve a sumar todo' })
  })

  it('una opción se elige arriba del todo, y se sigue pudiendo comprar como siempre (A4)', () => {
    expect(labels('shopping', 'pending', { option })).toEqual([
      'Elegir esta',
      'Comprado',
      'Mover a…',
      'Borrar',
    ])
    expect(rowActions('shopping', 'pending', { option })[0]).toMatchObject({
      highlight: { note: 'Pasa a contar en el total.' },
    })
    expect(labels('task', 'pending', { option })).toEqual([
      'Elegir esta',
      'Marcar en curso',
      'Hecha',
      'Mover a…',
      'Borrar',
    ])
  })

  it('en la elegida, «Quitar elección»', () => {
    expect(labels('shopping', 'pending', { option: { ...option, chosen: true } })[0]).toBe(
      'Quitar elección',
    )
  })
})
