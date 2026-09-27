/** Los siete colores de lista: se guarda el nombre del token, no el hex (documento 06). */
export const LIST_COLORS = ['coral', 'amber', 'teal', 'blue', 'pink', 'green', 'indigo'] as const
export type ListColor = (typeof LIST_COLORS)[number]

/**
 * Clase de fondo de cada color. Tailwind solo genera las clases que ve escritas enteras en el
 * código, así que `bg-list-${color}` no funcionaría: hace falta este mapa literal.
 */
export const LIST_COLOR_BG: Record<ListColor, string> = {
  coral: 'bg-list-coral',
  amber: 'bg-list-amber',
  teal: 'bg-list-teal',
  blue: 'bg-list-blue',
  pink: 'bg-list-pink',
  green: 'bg-list-green',
  indigo: 'bg-list-indigo',
}

/** Anillo del color elegido en el selector (diseño 04 Listas: hueco de 3 px y anillo de 2 px). */
export const LIST_COLOR_RING: Record<ListColor, string> = {
  coral: 'ring-list-coral',
  amber: 'ring-list-amber',
  teal: 'ring-list-teal',
  blue: 'ring-list-blue',
  pink: 'ring-list-pink',
  green: 'ring-list-green',
  indigo: 'ring-list-indigo',
}

/** Nombre de cada color para lectores de pantalla. */
export const LIST_COLOR_LABEL: Record<ListColor, string> = {
  coral: 'Coral',
  amber: 'Ámbar',
  teal: 'Verde azulado',
  blue: 'Azul',
  pink: 'Rosa',
  green: 'Verde',
  indigo: 'Índigo',
}

/** Orden del selector de color (diseño 04 Listas): índigo primero, que es el de la marca. */
export const LIST_COLOR_ORDER: readonly ListColor[] = [
  'indigo',
  'coral',
  'amber',
  'teal',
  'blue',
  'pink',
  'green',
]
