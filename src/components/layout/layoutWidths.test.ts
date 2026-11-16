import { afterEach, describe, expect, it } from 'vitest'

import { clampWidth, PANEL_WIDTH, readWidth, SIDEBAR_WIDTH } from './layoutWidths'

afterEach(() => {
  localStorage.clear()
})

describe('el ancho de los paneles (layoutWidths.ts)', () => {
  it('entre su mínimo y su máximo, o el sitio que quede si es menos', () => {
    expect(clampWidth(100, SIDEBAR_WIDTH)).toBe(272)
    expect(clampWidth(999, SIDEBAR_WIDTH)).toBe(400)
    expect(clampWidth(300.4, SIDEBAR_WIDTH)).toBe(300)
    expect(clampWidth(700, PANEL_WIDTH, 500)).toBe(500)
    // Sin sitio, se queda en su mínimo: el contenido se estrecha antes que desaparecer el panel.
    expect(clampWidth(700, PANEL_WIDTH, 100)).toBe(360)
  })

  it('se recuerda en el navegador; sin nada guardado o con basura, el de siempre', () => {
    expect(readWidth(SIDEBAR_WIDTH)).toBe(272)
    localStorage.setItem(SIDEBAR_WIDTH.key, '200')
    expect(readWidth(SIDEBAR_WIDTH)).toBe(272)
    localStorage.setItem(SIDEBAR_WIDTH.key, '320')
    expect(readWidth(SIDEBAR_WIDTH)).toBe(320)
    localStorage.setItem(PANEL_WIDTH.key, 'ancho')
    expect(readWidth(PANEL_WIDTH)).toBe(420)
    localStorage.setItem(PANEL_WIDTH.key, '5000')
    expect(readWidth(PANEL_WIDTH)).toBe(720)
  })
})
