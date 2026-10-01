import { describe, expect, it } from 'vitest'

import { allowedUrl, parseMetadata } from './metadata'

const PAGE = 'https://shop.realmadrid.com/es-es/camiseta-1'

describe('parseMetadata', () => {
  it('toma el título, la imagen y el sitio de OpenGraph', () => {
    const html = `<html><head>
      <title>Tienda oficial</title>
      <meta property="og:title" content="Camiseta 1.ª equipación 25/26">
      <meta property="og:image" content="https://cdn.realmadrid.com/camiseta.jpg" />
      <meta property="og:site_name" content="Real Madrid">
    </head><body>…</body></html>`
    expect(parseMetadata(html, PAGE)).toEqual({
      title: 'Camiseta 1.ª equipación 25/26',
      image: 'https://cdn.realmadrid.com/camiseta.jpg',
      siteName: 'Real Madrid',
    })
  })

  it('sin OpenGraph, usa las de Twitter o el `<title>`', () => {
    expect(
      parseMetadata(
        `<head><meta name="twitter:title" content="Recetas"><meta name="twitter:image" content="/r.png"></head>`,
        PAGE,
      ),
    ).toMatchObject({ title: 'Recetas', image: 'https://shop.realmadrid.com/r.png' })
    expect(parseMetadata('<head><title>\n  Mi   web \n</title></head>', PAGE).title).toBe('Mi web')
  })

  it('decodifica entidades y acepta comillas simples, atributos en otro orden y mayúsculas', () => {
    const html = `<HEAD><META content='Tom &amp; Jerry &#8211; &quot;todo&quot;' PROPERTY='og:title'></HEAD>`
    expect(parseMetadata(html, PAGE).title).toBe('Tom & Jerry – "todo"')
  })

  it('resuelve una imagen relativa y descarta la que no es http(s)', () => {
    expect(
      parseMetadata('<head><meta property="og:image" content="img/a.jpg"></head>', PAGE).image,
    ).toBe('https://shop.realmadrid.com/es-es/img/a.jpg')
    expect(
      parseMetadata(
        '<head><meta property="og:image" content="data:image/png;base64,AAA"></head>',
        PAGE,
      ).image,
    ).toBeNull()
  })

  it('una página sin nada da todo `null` (se queda el dominio)', () => {
    expect(parseMetadata('<html><body>Hola</body></html>', PAGE)).toEqual({
      title: null,
      image: null,
      siteName: null,
    })
  })

  it('solo mira el `<head>` y corta los títulos larguísimos', () => {
    const html = `<head><title>${'a'.repeat(400)}</title></head><body><meta property="og:title" content="No"></body>`
    expect(parseMetadata(html, PAGE).title).toHaveLength(300)
  })
})

describe('allowedUrl', () => {
  it('acepta webs normales', () => {
    expect(allowedUrl('https://www.amazon.es/dp/B0')?.hostname).toBe('www.amazon.es')
    expect(allowedUrl('http://example.com:443/x')).not.toBeNull()
  })

  it.each([
    'ftp://example.com',
    'javascript:alert(1)',
    'https://user:pass@example.com',
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://10.0.0.5',
    'http://192.168.1.1',
    'http://172.20.0.1',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/',
    'http://intranet',
    'https://example.com:8080',
    'no es una url',
  ])('rechaza %s', (url) => {
    expect(allowedUrl(url)).toBeNull()
  })
})
