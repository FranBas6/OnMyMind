import { ITEM_NOTES_MAX_LENGTH, ITEM_TITLE_MAX_LENGTH } from './schemas'
import type { Item } from './types'

/**
 * Una nota se escribe como un solo texto, sin título aparte, como en Notas del iPhone (5.4, diseño
 * 25): la primera línea hace de título. Por debajo no cambia nada: se guarda partida, la primera
 * línea en `title` y el resto en `notes`, así que las filas, Buscar, compartir y exportar siguen
 * igual.
 */

/** Lo que va al título y a las notas de un texto; `null` si no hay nada escrito. */
export interface SplitNote {
  title: string
  notes: string | null
}

/** Las líneas en blanco del principio no cuentan: la primera línea es la primera con algo. */
const LEADING_BLANK_LINES = /^(?:[ \t]*\n)+/

/**
 * Parte el texto de una nota: la primera línea a `title` y el resto a `notes`. Si la primera línea
 * no cabe en un título (300 caracteres), se corta en una palabra y lo que sobra empieza las notas.
 */
export function splitNoteText(text: string): SplitNote | null {
  const normalized = text.replace(/\r\n?/g, '\n').replace(LEADING_BLANK_LINES, '')
  const end = normalized.indexOf('\n')
  let title = (end < 0 ? normalized : normalized.slice(0, end)).trim()
  let rest = end < 0 ? '' : normalized.slice(end + 1)
  if (!title) return null
  if (title.length > ITEM_TITLE_MAX_LENGTH) {
    const space = title.lastIndexOf(' ', ITEM_TITLE_MAX_LENGTH)
    const cut = space > 0 ? space : ITEM_TITLE_MAX_LENGTH
    const overflow = title.slice(cut).trim()
    title = title.slice(0, cut).trim()
    rest = rest ? `${overflow}\n${rest}` : overflow
  }
  const notes = rest.trimEnd().slice(0, ITEM_NOTES_MAX_LENGTH).trimEnd()
  return { title, notes: notes.trim() ? notes : null }
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim()

/**
 * Las notas de una nota sin el título repetido. Lo compartido antes de la 5.4 guardaba el texto
 * entero en las notas, con la primera línea también en el título (4.7): esa primera línea no se
 * enseña dos veces.
 */
export function noteBody({ title, notes }: Pick<Item, 'title' | 'notes'>): string {
  if (!notes) return ''
  const end = notes.indexOf('\n')
  const first = clean(end < 0 ? notes : notes.slice(0, end))
  const rest = end < 0 ? '' : notes.slice(end + 1)
  if (first === title) return rest
  // Un texto de una línea más largo que el título: el título es su principio, cortado.
  if (title.length === ITEM_TITLE_MAX_LENGTH && first.startsWith(title)) {
    const tail = first.slice(title.length).trim()
    return rest ? `${tail}\n${rest}` : tail
  }
  return notes
}

/** El texto entero de una nota, como se escribe: la primera línea y, debajo, el resto. */
export function noteText(item: Pick<Item, 'title' | 'notes'>): string {
  const body = noteBody(item)
  return body ? `${item.title}\n${body}` : item.title
}

/** La primera línea y el resto mientras se escriben (`NoteEditor`), sin partir ni limpiar. */
export interface NoteDraft {
  title: string
  body: string
}

/** El texto entero de lo que se escribe: la primera línea y, debajo, el resto. */
export function joinNoteDraft({ title, body }: NoteDraft): string {
  return body ? `${title}\n${body}` : title
}

/** Un texto partido en la primera línea y el resto, tal cual (sin quitar nada). */
export function noteDraftOf(text: string): NoteDraft {
  const end = text.indexOf('\n')
  return end < 0
    ? { title: text, body: '' }
    : { title: text.slice(0, end), body: text.slice(end + 1) }
}
