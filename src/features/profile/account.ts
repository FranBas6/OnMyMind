import type { AccountCounts } from './api'

/** Un trozo del texto de la confirmación; los números van en negrita (diseño 18, P9). */
export interface Segment {
  text: string
  strong?: boolean
}

const TAIL =
  ', con sus fotos, enlaces, precios y avisos, en todos tus dispositivos. No hay vuelta atrás.'

/**
 * Lo que se borra con la cuenta (diseño 18, P9): «Se borran tus 6 listas y las 214 cosas que hay
 * dentro, con sus fotos, enlaces, precios y avisos, en todos tus dispositivos. No hay vuelta
 * atrás.». Mientras se cuentan (o si no se pudo), lo mismo sin números.
 */
export function deleteSummary(counts: AccountCounts | undefined): Segment[] {
  if (!counts) return [{ text: `Se borran tus listas y todo lo que hay dentro${TAIL}` }]
  const lists = counts.lists === 1 ? '1 lista' : `${counts.lists} listas`
  const items = counts.items === 1 ? '1 cosa' : `${counts.items} cosas`
  if (counts.lists === 0 && counts.items === 0) {
    return [{ text: 'Se borra tu cuenta, en todos tus dispositivos. No hay vuelta atrás.' }]
  }
  if (counts.lists === 0) {
    return [
      { text: counts.items === 1 ? 'Se borra ' : 'Se borran ' },
      { text: `${counts.items === 1 ? 'la' : 'las'} ` },
      { text: items, strong: true },
      { text: ` que tienes${TAIL}` },
    ]
  }
  if (counts.items === 0) {
    return [
      { text: counts.lists === 1 ? 'Se borra tu ' : 'Se borran tus ' },
      { text: lists, strong: true },
      { text: ', en todos tus dispositivos. No hay vuelta atrás.' },
    ]
  }
  return [
    { text: `Se borran ${counts.lists === 1 ? 'tu' : 'tus'} ` },
    { text: lists, strong: true },
    { text: ` y ${counts.items === 1 ? 'la' : 'las'} ` },
    { text: items, strong: true },
    { text: ` que hay dentro${TAIL}` },
  ]
}

/** La palabra que confirma: «borrar», da igual mayúsculas o espacios alrededor. */
export function confirmsDeletion(text: string): boolean {
  return text.trim().toLocaleLowerCase('es') === 'borrar'
}
