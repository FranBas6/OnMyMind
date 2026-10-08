import { LIST_NAME_MAX_LENGTH } from './schemas'

/**
 * Duplicar una lista (4.4, diseño 23, C): el nombre que se propone para la copia y los textos de
 * su hoja y de su aviso.
 */

/** Cuenta las copias: «Maleta de viaje (2)» vuelve a «Maleta de viaje» y su 2. */
const NUMBERED = /^(.*\S)\s+\((\d{1,3})\)$/

/** Cabe en el límite de un nombre, cortando la base y no el «(2)». */
function fit(base: string, suffix: string): string {
  return base.slice(0, LIST_NAME_MAX_LENGTH - suffix.length).trimEnd() + suffix
}

/**
 * El nombre de la copia (C2, C5):
 * - De una lista tuya, «Maleta de viaje (2)», o el siguiente número libre entre tus listas.
 * - De una compartida contigo, «Compras de Fran», y si ya lo tienes, «Compras de Fran (2)».
 */
export function copyName(
  name: string,
  taken: readonly string[],
  ownerName: string | null = null,
): string {
  const used = new Set(taken.map((entry) => entry.trim().toLowerCase()))
  const free = (candidate: string) => !used.has(candidate.toLowerCase())

  if (ownerName) {
    const shared = fit(name, ` de ${ownerName}`)
    if (free(shared)) return shared
    return numbered(shared, 2, free)
  }
  const match = NUMBERED.exec(name)
  const base = match?.[1] ?? name
  const start = match?.[2] ? Number(match[2]) + 1 : 2
  return numbered(base, start, free)
}

function numbered(base: string, start: number, free: (candidate: string) => boolean): string {
  for (let number = start; number < start + 999; number++) {
    const candidate = fit(base, ` (${String(number)})`)
    if (free(candidate)) return candidate
  }
  return fit(base, ` (${String(start)})`)
}

/** «Se copia» (C2): cuántas cosas y con qué. */
export function copiedSummary(count: number): string {
  const what = 'con sus notas, tipos, sublistas, fotos, enlaces, tiendas, precios y repeticiones.'
  if (count === 0) return 'La lista, vacía: su nombre, su color y su icono.'
  if (count === 1) return `1 cosa, pendiente, ${what}`
  return `${String(count)} cosas, todas pendientes, ${what}`
}

/** «No se copia» (C2, C5). */
export function notCopiedSummary(shared: boolean): string {
  return shared
    ? 'Fechas, avisos y personas: la copia es solo tuya.'
    : 'Fechas, avisos y personas con quien se comparte.'
}

/** El aviso al terminar (C3): «Copia creada · 24 cosas pendientes». */
export function duplicatedMessage(count: number): string {
  if (count === 0) return 'Copia creada'
  return `Copia creada · ${count === 1 ? '1 cosa pendiente' : `${String(count)} cosas pendientes`}`
}
