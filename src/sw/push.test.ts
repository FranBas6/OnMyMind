import { describe, expect, it } from 'vitest'

import { isSkipWaiting, parsePush, safePath } from './push'

describe('el mensaje de un push', () => {
  it('lee el título, el texto, la ruta y la etiqueta', () => {
    const raw = JSON.stringify({
      title: 'Dentista',
      body: 'En 1 h · 10:00 · Agenda',
      url: '/lists/agenda?item=abc',
      tag: 'reminder:abc',
    })
    expect(parsePush(raw)).toEqual({
      title: 'Dentista',
      body: 'En 1 h · 10:00 · Agenda',
      url: '/lists/agenda?item=abc',
      tag: 'reminder:abc',
    })
  })

  it('sin título, vacío o roto, un aviso genérico que lleva a Hoy', () => {
    const fallback = { title: 'OnMyMind', body: 'Tienes algo pendiente.', url: '/today' }
    expect(parsePush(null)).toEqual(fallback)
    expect(parsePush('no es json')).toEqual(fallback)
    expect(parsePush(JSON.stringify({ body: 'sin título' }))).toEqual(fallback)
    expect(parsePush(JSON.stringify(['Dentista']))).toEqual(fallback)
  })

  it('sin ruta lleva a Hoy, y nunca fuera de la app', () => {
    expect(parsePush(JSON.stringify({ title: 'Resumen' })).url).toBe('/today')
    expect(safePath('https://otra.web/x')).toBe('/today')
    expect(safePath('//otra.web/x')).toBe('/today')
    expect(safePath('javascript:alert(1)')).toBe('/today')
    expect(safePath('/today?day=2026-10-14')).toBe('/today?day=2026-10-14')
  })

  it('«Actualizar» manda SKIP_WAITING', () => {
    expect(isSkipWaiting({ type: 'SKIP_WAITING' })).toBe(true)
    expect(isSkipWaiting('SKIP_WAITING')).toBe(false)
    expect(isSkipWaiting(null)).toBe(false)
  })
})
