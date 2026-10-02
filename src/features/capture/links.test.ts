import { describe, expect, it } from 'vitest'

import { captureLink, capturedLink, captureTitle } from './links'

const CAMISETA = 'https://shop.realmadrid.com/camiseta-1-equipacion-26-27'
const camiseta = {
  title: 'Camiseta 1.ª equipación 26/27 · Real Madrid',
  image: 'https://cdn.realmadrid.com/camiseta.jpg',
  siteName: 'Real Madrid CF',
  price: { cents: 10000, currency: 'EUR' },
}

describe('captureLink', () => {
  it('lo pegado es solo un enlace', () => {
    expect(captureLink(`  ${CAMISETA} `)).toEqual({ url: CAMISETA, rest: '', onlyLink: true })
  })

  it('con texto alrededor, el texto queda aparte', () => {
    expect(captureLink(`Regalo para Ana: ${CAMISETA} antes del 20`)).toEqual({
      url: CAMISETA,
      rest: 'Regalo para Ana: antes del 20',
      onlyLink: false,
    })
  })

  it('vale con «www.», pero no cualquier cosa con un punto', () => {
    expect(captureLink('www.ikea.com/es')?.url).toBe('https://www.ikea.com/es')
    expect(captureLink('Aprender Node.js')).toBeNull()
    expect(captureLink('leer el.pais')).toBeNull()
    expect(captureLink('Llamar al fontanero')).toBeNull()
  })
})

describe('captureTitle', () => {
  const link = { url: CAMISETA, rest: '', onlyLink: true }

  it('el de la página o, sin él, el dominio', () => {
    expect(captureTitle(link, camiseta)).toBe('Camiseta 1.ª equipación 26/27 · Real Madrid')
    expect(captureTitle(link, null)).toBe('shop.realmadrid.com')
    expect(captureTitle(link, { title: null, image: null })).toBe('shop.realmadrid.com')
  })

  it('lo escrito además del enlace manda', () => {
    expect(captureTitle({ ...link, rest: 'Regalo Ana', onlyLink: false }, camiseta)).toBe(
      'Regalo Ana',
    )
  })
})

describe('capturedLink', () => {
  const link = { url: CAMISETA, rest: '', onlyLink: true }

  it('una compra se guarda con todo, también el precio', () => {
    expect(capturedLink(link, { state: 'ready', metadata: camiseta }, 'shopping')).toEqual({
      url: CAMISETA,
      urlTitle: 'Camiseta 1.ª equipación 26/27 · Real Madrid',
      urlSite: 'Real Madrid CF',
      imageUrl: 'https://cdn.realmadrid.com/camiseta.jpg',
      price: { cents: 10000, currency: 'EUR' },
    })
  })

  it('fuera de una compra, sin precio', () => {
    expect(capturedLink(link, { state: 'ready', metadata: camiseta }, 'task').price).toBeNull()
  })

  it('si la página no da título se apunta (`""`); si aún no se sabe, queda por buscar', () => {
    expect(
      capturedLink(link, { state: 'ready', metadata: { title: null, image: null } }, 'task')
        .urlTitle,
    ).toBe('')
    for (const state of ['searching', 'offline', 'failed'] as const) {
      expect(capturedLink(link, { state, metadata: null }, 'shopping')).toEqual({
        url: CAMISETA,
        urlTitle: null,
        urlSite: null,
        imageUrl: null,
        price: null,
      })
    }
  })
})
