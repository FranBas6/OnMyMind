import { describe, expect, it } from 'vitest'

import { hiddenBandLabel, hiddenSharedNote, hideSharedNote, shownToast } from './hidden'

const fran = { displayName: 'Fran' }
const marta = { displayName: 'Marta' }

describe('los textos de las listas ocultas (diseño 27)', () => {
  it('compartida: quién la sigue viendo (D7 y D7b)', () => {
    expect(hideSharedNote([fran])).toBe(
      'Solo se oculta para ti. Fran la sigue viendo en sus listas.',
    )
    expect(hideSharedNote([fran, marta])).toBe(
      'Solo se oculta para ti. Fran y Marta la siguen viendo en sus listas.',
    )
    expect(hiddenSharedNote([fran])).toBe(
      'Solo está oculta para ti. Fran la ve en sus listas, como siempre.',
    )
    expect(hiddenSharedNote([fran, marta])).toBe(
      'Solo está oculta para ti. Fran y Marta la ven en sus listas, como siempre.',
    )
  })

  it('la franja, en el móvil y en escritorio (D4 y E3)', () => {
    expect(hiddenBandLabel(5, false)).toBe('Desbloqueadas · se bloquean solas en 5 min')
    expect(hiddenBandLabel(3, true)).toBe(
      'Desbloqueadas · se bloquean solas en 3 min o al cerrar la pestaña',
    )
  })

  it('al mostrarla (D5c)', () => {
    expect(shownToast('Regalos de Marta')).toBe('«Regalos de Marta» vuelve a Mis listas')
  })
})
