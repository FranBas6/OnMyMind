import { describe, expect, it } from 'vitest'

import { protectionBlock } from './protection'

const plain = { images: [], imagePath: null, imageUrl: null, url: null, links: [] }
const photo = (id: string) => ({ id, path: `u/i/${id}.webp`, position: 1000 })

describe('proteger una nota (protection.ts, diseño 26)', () => {
  it('una nota de solo texto se protege', () => {
    expect(protectionBlock(plain, [])).toBeNull()
  })

  it('en una lista compartida, no: los demás no tienen tu clave (C9)', () => {
    expect(protectionBlock(plain, ['Fran'])).toBe(
      'En una lista compartida no se puede proteger: Fran no tiene tu clave.',
    )
    expect(protectionBlock(plain, ['Fran', 'Bea', 'Luis'])).toBe(
      'En una lista compartida no se puede proteger: Fran, Bea y Luis no tienen tu clave.',
    )
  })

  it('con fotos o enlaces, aún no (C6d)', () => {
    const twoPhotos = { ...plain, images: [photo('a'), photo('b')], imagePath: 'u/i/a.webp' }
    expect(protectionBlock(twoPhotos, [])).toBe(
      'Esta nota tiene 2 fotos. De momento, una nota protegida es solo texto: quítalas para protegerla.',
    )
    expect(protectionBlock({ ...plain, url: 'https://example.com', imageUrl: 'x' }, [])).toBe(
      'Esta nota tiene 1 enlace. De momento, una nota protegida es solo texto: quítalos para protegerla.',
    )
    expect(
      protectionBlock({ ...plain, images: [photo('a')], url: 'https://example.com' }, []),
    ).toBe(
      'Esta nota tiene 1 foto y 1 enlace. De momento, una nota protegida es solo texto: quítalos para protegerla.',
    )
  })
})
