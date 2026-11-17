import { describe, expect, it } from 'vitest'

import { linkDomain, linkPath, linkTitle, normalizeLink } from './links'

describe('normalizeLink', () => {
  it('acepta enlaces con y sin https', () => {
    expect(normalizeLink('https://shop.realmadrid.com/es-es/camiseta')).toBe(
      'https://shop.realmadrid.com/es-es/camiseta',
    )
    expect(normalizeLink('  amazon.es/dp/B0  ')).toBe('https://amazon.es/dp/B0')
    expect(normalizeLink('http://example.com')).toBe('http://example.com/')
  })

  it('saca el enlace de un texto que lo lleva dentro (compartir desde otra app)', () => {
    expect(normalizeLink('Mira esto: https://dribbble.com/shots/123 está chulo')).toBe(
      'https://dribbble.com/shots/123',
    )
  })

  it.each([
    '',
    '   ',
    'camiseta madrid talla m',
    'hola',
    'ftp://example.com',
    'javascript:alert(1)',
  ])('«%s» no parece un enlace', (text) => {
    expect(normalizeLink(text)).toBeNull()
  })
})

describe('textos del enlace', () => {
  it('el dominio sin www, y la ruta para cuando no hay título', () => {
    expect(linkDomain('https://www.shop.realmadrid.com/x')).toBe('shop.realmadrid.com')
    expect(linkPath('https://tiendamadridista.es/p/1024/')).toBe('tiendamadridista.es/p/1024')
    expect(linkPath('https://dribbble.com/')).toBe('dribbble.com')
  })

  it('el título de la página o, si no lo da (o aún no se sabe), el dominio', () => {
    expect(linkTitle({ url: 'https://shop.realmadrid.com/c', urlTitle: 'Camiseta' })).toBe(
      'Camiseta',
    )
    expect(linkTitle({ url: 'https://shop.realmadrid.com/c', urlTitle: '' })).toBe(
      'shop.realmadrid.com',
    )
    expect(linkTitle({ url: 'https://shop.realmadrid.com/c', urlTitle: null })).toBe(
      'shop.realmadrid.com',
    )
    expect(linkTitle({ url: null, urlTitle: null })).toBeNull()
  })
})
