import { parseNaturalDate, type NaturalDate } from '@/lib/naturalDate'

import { ITEM_TITLE_MAX_LENGTH } from './schemas'
import type { ItemKind } from './status'
import { readsWrittenDates, writtenDateFields, type WrittenDate } from './writtenDate'

/**
 * Pegar varias líneas (4.3, diseño 23, B): de un texto pegado (una lista de WhatsApp, de Notas, de
 * un correo) a una cosa por línea, sin viñetas, números ni casillas. Lo usan la captura y la barra
 * de añadir.
 */

/** Cuántas cosas se añaden de una vez como mucho. */
export const PASTED_LINES_MAX = 50

export interface PastedLine {
  title: string
  /** Venía marcada («[x] », «☑ », «✅ »): se añade hecha. */
  done: boolean
}

export interface PastedList {
  lines: PastedLine[]
  /** Las que no caben, más allá de las 50. */
  overflow: number
}

/**
 * Viñetas y números: «- », «* », «+ » y «1. » o «1) » piden un espacio detrás (así «*negrita*» de
 * WhatsApp o «1.5 kg» se quedan como están); los símbolos («•», «·», «–»…), no.
 */
const BULLET = /^(?:[-*+]\s+|[•·–—▪◦‣●○]\s*|\d{1,3}[.)]\s+)/u
/** Casillas, solas o detrás de una viñeta: «[ ] », «[x] », «☐ », «☑ », «✅ »… */
const CHECKBOX = /^(?:\[\s?\]|\[[xX✓✔]\]|☐|☑|☒|✅|✔️?|✓)\s*/u
const CHECKED = /^(?:\[[xX✓✔]\]|☑|☒|✅|✔|✓)/u

/** Una línea sin su viñeta, número o casilla; `marked` si llevaba alguna. */
function cleanLine(raw: string): PastedLine & { marked: boolean } {
  let text = raw.trim()
  let marked = false
  const bullet = BULLET.exec(text)
  if (bullet) {
    text = text.slice(bullet[0].length)
    marked = true
  }
  let done = false
  const box = CHECKBOX.exec(text)
  if (box) {
    done = CHECKED.test(box[0])
    text = text.slice(box[0].length)
    marked = true
  }
  return { title: text.trim().slice(0, ITEM_TITLE_MAX_LENGTH).trim(), done, marked }
}

/**
 * Las cosas de un texto pegado, o `null` si no se ofrece (diseño 23, B7): hace falta que sean tres
 * líneas o más, o dos si alguna lleva viñeta. Una sola línea, aunque acabe en salto, se pega como
 * siempre. Se quitan las vacías y las repetidas seguidas; se corta en 50.
 */
export function pastedLines(text: string): PastedList | null {
  const cleaned = text
    .split(/\r\n|\r|\n/)
    .map(cleanLine)
    .filter((line) => line.title !== '')
  const lines: (PastedLine & { marked: boolean })[] = []
  for (const line of cleaned) {
    const previous = lines.at(-1)
    if (previous?.title.toLowerCase() === line.title.toLowerCase()) continue
    lines.push(line)
  }
  const offered = lines.length >= 3 || (lines.length === 2 && lines.some((line) => line.marked))
  if (!offered) return null
  return {
    lines: lines.slice(0, PASTED_LINES_MAX).map(({ title, done }) => ({ title, done })),
    overflow: Math.max(0, lines.length - PASTED_LINES_MAX),
  }
}

/** «7 cosas, una por línea». */
export function pastedLinesHeading(count: number): string {
  return count === 1 ? '1 cosa, una por línea' : `${String(count)} cosas, una por línea`
}

/** El aviso tras guardar (B3, B6): «6 cosas en Compras». */
export function pastedLinesSaved(count: number, where: string): string {
  return `${count === 1 ? '1 cosa' : `${String(count)} cosas`} en ${where}`
}

/** Una línea en la vista previa: se puede quitar (y recuperar) y deshacer su fecha. */
export interface PastedRow extends PastedLine {
  removed: boolean
  /** Se tocó su pastilla: se guarda tal cual, sin fecha. */
  dateUndone: boolean
}

export function pastedRows(list: PastedList): PastedRow[] {
  return list.lines.map((line) => ({ ...line, removed: false, dateUndone: false }))
}

/**
 * La fecha escrita de una línea («Llamar al fontanero mañana 10h»), si lo que se añade es una tarea
 * o un evento (las fechas escritas de la 3.5).
 */
export function lineDate(
  row: PastedLine,
  kind: ItemKind | null,
): { parsed: NaturalDate; written: WrittenDate } | null {
  if (!kind || !readsWrittenDates(kind)) return null
  const parsed = parseNaturalDate(row.title)
  const written = parsed ? writtenDateFields(parsed, kind) : null
  // Una línea que solo era la fecha («mañana») se queda como está: sin ella no habría título.
  return parsed && written && parsed.title.trim() !== '' ? { parsed, written } : null
}

/** Lo que se guarda de cada línea que queda: su título, si va hecha y su fecha. */
export interface LineToSave {
  title: string
  done: boolean
  written: WrittenDate | null
}

export function linesToSave(rows: readonly PastedRow[], kind: ItemKind | null): LineToSave[] {
  return rows
    .filter((row) => !row.removed)
    .map((row) => {
      const dated = row.dateUndone ? null : lineDate(row, kind)
      return {
        title: dated ? dated.parsed.title : row.title,
        done: row.done,
        written: dated?.written ?? null,
      }
    })
}
