import { describe, expect, it } from 'vitest'

import { sharedItem } from './share'

const GRAFICA = 'https://www.pccomponentes.com/gigabyte-geforce-rtx-5070'
const link = (url: string) => ({ url, urlTitle: null, urlSite: null, imageUrl: null, price: null })

describe('lo que se guarda al compartir (4.7)', () => {
  it('Chrome en Android: el enlace en el texto y el título de la página en el título', () => {
    expect(
      sharedItem({ title: 'Gigabyte GeForce RTX 5070 Gaming OC 12GB', text: GRAFICA }),
    ).toEqual({
      title: 'Gigabyte GeForce RTX 5070 Gaming OC 12GB',
      link: link(GRAFICA),
      notes: null,
    })
  })

  it('una app que manda «Mira esto https://…»: el título es lo que acompaña al enlace', () => {
    expect(sharedItem({ text: `Mira esta gráfica ${GRAFICA}`, title: 'PcComponentes' })).toEqual({
      title: 'Mira esta gráfica',
      link: link(GRAFICA),
      notes: null,
    })
  })

  it('solo el enlace (el Atajo del iPhone): el dominio, hasta que llegue el de la página', () => {
    expect(sharedItem({ url: GRAFICA })).toEqual({
      title: 'pccomponentes.com',
      link: link(GRAFICA),
      notes: null,
    })
    // Un título que es el mismo enlace tampoco vale de título.
    expect(sharedItem({ url: GRAFICA, title: GRAFICA })?.title).toBe('pccomponentes.com')
    expect(sharedItem({ url: GRAFICA, text: `${GRAFICA}/` })?.title).toBe('pccomponentes.com')
  })

  it('con el enlace en `url` y un texto aparte, el texto es el título', () => {
    expect(sharedItem({ url: GRAFICA, text: 'Para el PC nuevo' })?.title).toBe('Para el PC nuevo')
  })

  it('un texto sin enlace es una nota; con varias líneas, el texto entero va en las notas', () => {
    expect(sharedItem({ text: '  Llamar al fontanero  ' })).toEqual({
      title: 'Llamar al fontanero',
      link: null,
      notes: null,
    })
    const receta = 'Bizcocho de yogur\n3 huevos\n1 yogur'
    expect(sharedItem({ text: receta })).toEqual({
      title: 'Bizcocho de yogur',
      link: null,
      notes: receta,
    })
    const largo = 'a'.repeat(400)
    expect(sharedItem({ text: largo })).toMatchObject({ title: 'a'.repeat(300), notes: largo })
  })

  it('sin nada, no se guarda nada', () => {
    expect(sharedItem({})).toBeNull()
    expect(sharedItem({ title: ' ', text: '\n' })).toBeNull()
  })
})
