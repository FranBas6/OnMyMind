/**
 * Lo que copia el botón de una línea de una nota protegida (5.7): en «Contraseña: 123456», solo
 * `123456`; en una línea sin etiqueta, la línea entera. Las viñetas no se copian.
 */

/** «Contraseña: 123456», «Usuario:@francisco». La etiqueta no lleva «/» (así un enlace no lo es). */
const LABELED = /^([^:/]{1,40}):\s*(?!\/\/)(\S.*)$/

/** Lo que se copia de una línea, y su etiqueta si la tiene; `null` si la línea está vacía. */
export function lineValue(line: string): { label: string | null; value: string } | null {
  const text = line.replace(/^\s*[•-]\s+/, '').trim()
  if (!text) return null
  const match = LABELED.exec(text)
  const label = match?.[1]?.trim()
  const value = match?.[2]?.trim()
  return label && value ? { label, value } : { label: null, value: text }
}
