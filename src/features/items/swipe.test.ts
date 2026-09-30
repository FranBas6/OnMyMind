import { describe, expect, it } from 'vitest'

import { decideAxis, LEFT_OPEN_PX, releaseOutcome, resist, rightActions, rightStage } from './swipe'

describe('decideAxis', () => {
  it('no decide hasta moverse 10 px', () => {
    expect(decideAxis(6, 3)).toBeNull()
  })

  it('más de lado que hacia abajo es deslizar; si no, es scroll', () => {
    expect(decideAxis(12, 4)).toBe('x')
    expect(decideAxis(-12, 4)).toBe('x')
    expect(decideAxis(4, 12)).toBe('y')
    expect(decideAxis(8, 8)).toBe('y')
  })
})

describe('resist', () => {
  const limits = { right: 160, left: LEFT_OPEN_PX }

  it('sigue al dedo hasta el límite', () => {
    expect(resist(100, limits)).toBe(100)
    expect(resist(-120, limits)).toBe(-120)
  })

  it('pasado el límite, cuesta más', () => {
    expect(resist(260, limits)).toBe(195)
    expect(resist(-260, limits)).toBe(-195)
  })

  it('un lado sin acciones no se mueve', () => {
    expect(resist(50, { right: 0, left: 160 })).toBe(0)
    expect(resist(-50, { right: 80, left: 0 })).toBe(0)
  })
})

describe('rightActions', () => {
  const labels = (...args: Parameters<typeof rightActions>) =>
    rightActions(...args).map((action) => action.label)

  it('una tarea pendiente tiene dos tramos: en curso y hecha', () => {
    expect(labels('task', 'pending')).toEqual(['En curso', 'Hecha'])
  })

  it('en curso, solo terminarla; hecha, volver a pendiente', () => {
    expect(labels('task', 'in_progress')).toEqual(['Hecha'])
    expect(labels('task', 'done')).toEqual(['Pendiente'])
  })

  it('fuera de Tareas, un tramo con el final del tipo', () => {
    expect(labels('note', 'pending')).toEqual(['Hecha'])
    expect(labels('shopping', 'pending')).toEqual(['Comprado'])
    expect(labels('event', 'upcoming')).toEqual(['Cancelado'])
    expect(labels('shopping', 'bought')).toEqual(['Pendiente'])
  })

  it('cada acción lleva su color', () => {
    expect(rightActions('task', 'pending').map((action) => action.tone)).toEqual([
      'progress',
      'done',
    ])
    expect(rightActions('task', 'done')[0]?.tone).toBe('reopen')
  })
})

describe('al soltar', () => {
  const task = { rightStages: 2, hasLeft: true }

  it('a la derecha 40 px vuelve sin hacer nada; 100 px, primer tramo; 170 px, segundo', () => {
    expect(releaseOutcome(40, task)).toEqual({ type: 'close' })
    expect(releaseOutcome(100, task)).toEqual({ type: 'status', stage: 1 })
    expect(releaseOutcome(170, task)).toEqual({ type: 'status', stage: 2 })
  })

  it('con un solo tramo, ir más lejos sigue siendo el primero', () => {
    expect(releaseOutcome(220, { rightStages: 1, hasLeft: true })).toEqual({
      type: 'status',
      stage: 1,
    })
  })

  it('a la izquierda, pasado el umbral, se queda abierta', () => {
    expect(releaseOutcome(-60, task)).toEqual({ type: 'close' })
    expect(releaseOutcome(-90, task)).toEqual({ type: 'open-left' })
  })

  it('el tramo activo mientras se arrastra', () => {
    expect(rightStage(79, 2)).toBe(0)
    expect(rightStage(80, 2)).toBe(1)
    expect(rightStage(160, 2)).toBe(2)
    expect(rightStage(300, 1)).toBe(1)
  })
})
