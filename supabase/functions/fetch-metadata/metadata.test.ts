import { describe, expect, it } from 'vitest'

import { allowedUrl, amountToCents, isUserToken, parseMetadata, parsePrice } from './metadata'

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
      price: null,
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
      price: null,
    })
  })

  it('solo mira el `<head>` y corta los títulos larguísimos', () => {
    const html = `<head><title>${'a'.repeat(400)}</title></head><body><meta property="og:title" content="No"></body>`
    expect(parseMetadata(html, PAGE).title).toHaveLength(300)
  })
})

describe('OpenGraph genérico', () => {
  it('Amazon: «Amazon» y su logo en cada producto no se guardan (mejor el dominio)', () => {
    const html = `<head>
      <meta property="og:title" content="Amazon"/>
      <meta property="og:image" content="https://m.media-amazon.com/images/G/01/share-icons/previewdoh/amazon.png"/>
      <meta property="og:sitename" content="Amazon"/>
    </head>`
    expect(parseMetadata(html, 'https://www.amazon.es/dp/B09B8X9RGM')).toMatchObject({
      title: null,
      image: null,
      siteName: 'Amazon',
    })
  })

  it('un título igual a `og:site_name` es el de la web, no el de la cosa', () => {
    const html = `<head><meta property="og:title" content="IKEA España"><meta property="og:site_name" content="IKEA España"><meta property="og:image" content="https://ikea.com/foto.jpg"></head>`
    expect(parseMetadata(html, 'https://www.ikea.com/es/es/')).toMatchObject({
      title: null,
      image: null,
    })
  })

  it('el logo de la tienda no es una foto; el título de su portada sí se queda', () => {
    const html = `<head><title>La Tienda Online Oficial del Real Madrid CF</title>
      <meta property="og:image" content="https://shop.realmadrid.com/cdn/shop/files/logo-oficial-store.webp?v=1"></head>`
    expect(parseMetadata(html, 'https://shop.realmadrid.com/es-es')).toMatchObject({
      title: 'La Tienda Online Oficial del Real Madrid CF',
      image: null,
    })
  })
})

describe('precio por capas', () => {
  const ld = (data: unknown) =>
    `<script type="application/ld+json">${JSON.stringify(data)}</script>`

  it('1 · JSON-LD de Shopify (tienda del Madrid): `Product` con `offers` en una lista', () => {
    const html = `<head><meta property="og:title" content="Guantes adidas Azul Marino"></head><body>${ld(
      {
        '@context': 'http://schema.org/',
        '@type': 'Product',
        name: 'Guantes adidas Azul Marino',
        offers: [
          { '@type': 'Offer', price: '28.00', priceCurrency: 'EUR' },
          { '@type': 'Offer', price: '30.00', priceCurrency: 'EUR' },
        ],
      },
    )}</body>`
    expect(parseMetadata(html, PAGE).price).toEqual({ cents: 2800, currency: 'EUR' })
  })

  it('dentro de `@graph`, de un `BuyAction` (MediaMarkt) y con el precio como número', () => {
    expect(
      parsePrice(
        ld({
          '@graph': [
            { '@type': 'WebPage' },
            { '@type': ['Product', 'Thing'], offers: { price: 279, priceCurrency: 'EUR' } },
          ],
        }),
      ),
    ).toEqual({ cents: 27900, currency: 'EUR' })
    expect(
      parsePrice(
        ld({
          '@type': 'BuyAction',
          object: { '@type': 'Product', offers: [{ price: 613.95, priceCurrency: 'EUR' }] },
        }),
      ),
    ).toEqual({ cents: 61395, currency: 'EUR' })
  })

  it('`AggregateOffer` da su `lowPrice`, y `priceSpecification` también vale', () => {
    expect(
      parsePrice(
        ld({
          '@type': 'Product',
          offers: { '@type': 'AggregateOffer', lowPrice: '1.299,50', priceCurrency: 'EUR' },
        }),
      ),
    ).toEqual({ cents: 129950, currency: 'EUR' })
    expect(
      parsePrice(
        ld({
          '@type': 'Product',
          offers: { priceSpecification: { price: '9.99', priceCurrency: 'GBP' } },
        }),
      ),
    ).toEqual({ cents: 999, currency: 'GBP' })
  })

  it('una tienda en dólares (Keychron) da su precio en dólares', () => {
    expect(
      parsePrice(ld({ '@type': 'Product', offers: { price: '69.99', priceCurrency: 'USD' } })),
    ).toEqual({ cents: 6999, currency: 'USD' })
  })

  it('un JSON-LD roto o sin producto no tapa a las capas siguientes', () => {
    const html = `<script type="application/ld+json">{ roto, </script>${ld({ '@type': 'BreadcrumbList' })}`
    const head = `<head><meta property="product:price:amount" content="19.95"><meta property="product:price:currency" content="EUR"></head>`
    expect(parseMetadata(head + html, PAGE).price).toEqual({ cents: 1995, currency: 'EUR' })
  })

  it('2 · las meta de producto y `og:price`', () => {
    expect(
      parseMetadata(
        `<head><meta property="og:price:amount" content="12,50"><meta property="og:price:currency" content="eur"></head>`,
        PAGE,
      ).price,
    ).toEqual({ cents: 1250, currency: 'EUR' })
  })

  it('3 · microdatos con `itemprop`', () => {
    expect(
      parsePrice(
        `<div itemscope itemtype="https://schema.org/Product"><meta itemprop="priceCurrency" content="EUR"><span itemprop="price" content="59.99">59,99 €</span></div>`,
      ),
    ).toEqual({ cents: 5999, currency: 'EUR' })
  })

  it('sin moneda, a cero o sin importe no hay precio: nunca se adivina', () => {
    expect(parsePrice(ld({ '@type': 'Product', offers: { price: '10.00' } }))).toBeNull()
    expect(
      parsePrice(ld({ '@type': 'Product', offers: { price: '0', priceCurrency: 'EUR' } })),
    ).toBeNull()
    expect(
      parsePrice(ld({ '@type': 'Product', offers: { price: 'Consultar', priceCurrency: 'EUR' } })),
    ).toBeNull()
    expect(parsePrice('<html><body>Un artículo cualquiera</body></html>')).toBeNull()
  })

  it('el precio puede estar en el cuerpo, lejos del `<head>` (IKEA)', () => {
    const html = `<head><title>BILLY</title></head><body>${'x'.repeat(100_000)}${ld({
      '@type': 'Product',
      offers: { price: '59.99', priceCurrency: 'EUR' },
    })}</body>`
    expect(parseMetadata(html, PAGE).price).toEqual({ cents: 5999, currency: 'EUR' })
  })
})

describe('amountToCents', () => {
  it.each([
    ['100.00', 10000],
    ['1299', 129900],
    ['1.299,50', 129950],
    ['1,299.50', 129950],
    ['19,99 €', 1999],
    ['1.299', 129900],
    ['12.5', 1250],
    ['1.234.567', 123456700],
  ])('«%s» → %i céntimos', (text, cents) => {
    expect(amountToCents(text)).toBe(cents)
  })

  it('lo que no es un importe da `null`', () => {
    expect(amountToCents('gratis')).toBeNull()
    expect(amountToCents('12.3456')).toBeNull()
    expect(amountToCents('1,2,3')).toBeNull()
  })
})

describe('isUserToken', () => {
  const token = (claims: object) =>
    `Bearer x.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.firma`

  it('deja pasar una sesión y no la clave pública `anon`', () => {
    expect(isUserToken(token({ role: 'authenticated', sub: 'u1' }))).toBe(true)
    expect(isUserToken(token({ role: 'anon' }))).toBe(false)
    expect(isUserToken(null)).toBe(false)
    expect(isUserToken('Bearer nada')).toBe(false)
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
