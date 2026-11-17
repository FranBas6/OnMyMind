/** Hasta dónde se toma de las notas para la fila: el resto lo corta el ancho, con «…». */
const EXCERPT_MAX = 200

/**
 * El principio de las notas en una sola línea, para enseñarlo bajo el título de la fila (Fran,
 * 2026-10-11): sin saltos de línea ni espacios de más. `null` si no hay notas.
 */
export function notesExcerpt(notes: string | null): string | null {
  const text = (notes ?? '').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, EXCERPT_MAX) : null
}
