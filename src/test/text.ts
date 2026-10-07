import type { MatcherFunction } from '@testing-library/react'

/**
 * Un texto partido en varios elementos (una línea con una parte en negrita o un icono en medio):
 * encuentra el elemento más interno cuyo texto entero es ese. Para «Keychron · comprobado solo ·
 * hoy» (3.8), que lleva la tienda en otro color y el reloj delante del origen.
 */
export function lineText(expected: string): MatcherFunction {
  return (_content, element) =>
    element?.textContent === expected &&
    [...element.children].every((child) => child.textContent !== expected)
}
