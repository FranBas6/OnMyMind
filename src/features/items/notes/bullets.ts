/**
 * Viñetas sencillas al escribir una nota (5.4, diseño 25, B2b): una línea que empieza por «- » pasa
 * a «• », Intro en una viñeta sigue con otra y un Intro en una viñeta vacía la termina. Es texto
 * plano: la viñeta es el carácter «•», sin editor enriquecido.
 */

export const BULLET = '• '

/** «- » o «* » al principio de una línea (con su sangría), que pasan a ser una viñeta. */
const TYPED_BULLET = /^([ \t]*)[-*] /gm

/**
 * Cambia «- » y «* » del principio de cada línea por «• ». Tienen el mismo largo, así que el cursor
 * se queda donde estaba.
 */
export function withBullets(text: string): string {
  return text.replace(TYPED_BULLET, `$1${BULLET}`)
}

/** Un texto con el cursor (o la selección) en él. */
export interface TextEdit {
  value: string
  start: number
  end: number
}

/**
 * Intro con el cursor en una viñeta: la siguiente línea empieza con otra; en una viñeta vacía, la
 * viñeta se quita y la lista se acaba. `null` si la línea no es una viñeta (Intro hace lo de
 * siempre).
 */
export function enterInBullet({ value, start, end }: TextEdit): TextEdit | null {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', start)
  const lineEnd = nextBreak < 0 ? value.length : nextBreak
  const line = value.slice(lineStart, lineEnd)
  const indent = /^[ \t]*/.exec(line)?.[0] ?? ''
  if (!line.slice(indent.length).startsWith(BULLET.trimEnd())) return null
  // Con el cursor antes de la viñeta, Intro solo baja la línea.
  if (start < lineStart + indent.length + 1) return null

  if (line.slice(indent.length + 1).trim() === '' && end <= lineEnd) {
    const caret = lineStart
    return { value: value.slice(0, lineStart) + value.slice(lineEnd), start: caret, end: caret }
  }
  const inserted = `\n${indent}${BULLET}`
  const caret = start + inserted.length
  return { value: value.slice(0, start) + inserted + value.slice(end), start: caret, end: caret }
}
