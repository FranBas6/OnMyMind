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
